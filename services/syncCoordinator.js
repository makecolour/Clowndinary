const cluster = require('cluster');
const EventEmitter = require('events');

class SyncCoordinator extends EventEmitter {
  constructor() {
    super();
    this.activeSyncJobs = new Map();
    this.workerAssignments = new Map();
    this.availableWorkers = new Set();
    
    // Track sync workers
    this.syncWorkers = new Set();
    
    if (cluster.isMaster) {
      this.setupMasterCoordinator();
    } else {
      this.setupWorkerHandlers();
    }
  }

  setupMasterCoordinator() {
    // Handle messages from workers
    cluster.on('message', (worker, message) => {
      this.handleWorkerMessage(worker, message);
    });

    // Handle worker exits
    cluster.on('exit', (worker, code, signal) => {
      this.handleWorkerExit(worker);
    });

    // Handle worker online
    cluster.on('online', (worker) => {
      // Worker registration will be handled by the main process calling registerSyncWorker
    });
  }

  // Register a sync worker (called from main cluster management)
  registerSyncWorker(workerId) {
    this.syncWorkers.add(workerId);
    this.availableWorkers.add(workerId);
    console.log(`Sync worker ${workerId} registered and available`);
  }

  setupWorkerHandlers() {
    // Listen for sync tasks from master
    process.on('message', (message) => {
      if (message.type === 'sync-batch-assignment') {
        this.processSyncBatch(message.data);
      }
    });
  }

  // Master: Start distributed sync job
  async startDistributedSync(jobId, files, options = {}) {
    if (!cluster.isMaster) {
      throw new Error('Distributed sync can only be started from master process');
    }

    const batchSize = options.workerBatchSize || 10;
    const maxWorkers = Math.min(this.syncWorkers.size, options.maxWorkers || 4);
    
    console.log(`Starting distributed sync for job ${jobId} with ${files.length} files across ${maxWorkers} workers`);

    // Create batches for distribution
    const batches = this.createBatches(files, batchSize);
    
    // Initialize job tracking
    this.activeSyncJobs.set(jobId, {
      totalBatches: batches.length,
      completedBatches: 0,
      failedBatches: 0,
      startTime: Date.now(),
      options: options
    });

    // Distribute batches to workers
    let batchIndex = 0;
    const availableWorkerIds = Array.from(this.availableWorkers).slice(0, maxWorkers);
    
    // Initial distribution - give each worker their first batch
    for (const workerId of availableWorkerIds) {
      if (batchIndex < batches.length) {
        await this.assignBatchToWorker(workerId, jobId, batches[batchIndex], batchIndex);
        batchIndex++;
      }
    }

    // Store remaining batches for when workers become available
    const remainingBatches = batches.slice(batchIndex);
    this.activeSyncJobs.get(jobId).remainingBatches = remainingBatches;
    this.activeSyncJobs.get(jobId).nextBatchIndex = batchIndex;

    return {
      jobId,
      totalBatches: batches.length,
      workersAssigned: availableWorkerIds.length
    };
  }

  // Master: Create batches from file list
  createBatches(files, batchSize) {
    const batches = [];
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }
    return batches;
  }

  // Master: Assign batch to specific worker
  async assignBatchToWorker(workerId, jobId, batch, batchIndex) {
    const worker = cluster.workers[workerId];
    if (!worker) {
      console.error(`Worker ${workerId} not found`);
      return;
    }

    // Mark worker as busy
    this.availableWorkers.delete(workerId);
    this.workerAssignments.set(workerId, { jobId, batchIndex });

    // Send batch to worker
    worker.send({
      type: 'sync-batch-assignment',
      data: {
        jobId,
        batchIndex,
        batch,
        options: this.activeSyncJobs.get(jobId).options
      }
    });

    console.log(`Assigned batch ${batchIndex} (${batch.length} files) to worker ${workerId}`);
  }

  // Master: Handle messages from workers
  async handleWorkerMessage(worker, message) {
    switch (message.type) {
      case 'sync-batch-completed':
        await this.handleBatchCompleted(worker, message.data);
        break;
      case 'sync-batch-failed':
        await this.handleBatchFailed(worker, message.data);
        break;
      case 'sync-worker-ready':
        this.handleWorkerReady(worker.id);
        break;
      case 'sync-progress-update':
        this.handleProgressUpdate(message.data);
        break;
    }
  }

  // Master: Handle completed batch
  async handleBatchCompleted(worker, data) {
    const { jobId, batchIndex, results } = data;
    const job = this.activeSyncJobs.get(jobId);
    
    if (!job) return;

    job.completedBatches++;
    console.log(`✅ Batch ${batchIndex} completed by worker ${worker.id} (${job.completedBatches}/${job.totalBatches})`);

    // Emit progress update
    this.emit('sync-progress', {
      jobId,
      completedBatches: job.completedBatches,
      totalBatches: job.totalBatches,
      results
    });

    // Free up worker and assign next batch if available
    await this.freeWorkerAndAssignNext(worker.id, jobId);

    // Check if job is complete
    if (job.completedBatches + job.failedBatches >= job.totalBatches) {
      await this.completeSyncJob(jobId);
    }
  }

  // Master: Handle failed batch
  async handleBatchFailed(worker, data) {
    const { jobId, batchIndex, error } = data;
    const job = this.activeSyncJobs.get(jobId);
    
    if (!job) return;

    job.failedBatches++;
    console.error(`❌ Batch ${batchIndex} failed on worker ${worker.id}: ${error}`);

    // Emit error update
    this.emit('sync-error', {
      jobId,
      batchIndex,
      error,
      failedBatches: job.failedBatches
    });

    // Free up worker and assign next batch if available
    await this.freeWorkerAndAssignNext(worker.id, jobId);

    // Check if job is complete
    if (job.completedBatches + job.failedBatches >= job.totalBatches) {
      await this.completeSyncJob(jobId);
    }
  }

  // Master: Free worker and assign next batch
  async freeWorkerAndAssignNext(workerId, jobId) {
    // Clear worker assignment
    this.workerAssignments.delete(workerId);
    this.availableWorkers.add(workerId);

    // Assign next batch if available
    const job = this.activeSyncJobs.get(jobId);
    if (job?.remainingBatches?.length > 0) {
      const nextBatch = job.remainingBatches.shift();
      const batchIndex = job.nextBatchIndex++;
      
      await this.assignBatchToWorker(workerId, jobId, nextBatch, batchIndex);
    }
  }

  // Master: Complete sync job
  async completeSyncJob(jobId) {
    const job = this.activeSyncJobs.get(jobId);
    if (!job) return;

    const duration = Date.now() - job.startTime;
    
    console.log(`🎉 Sync job ${jobId} completed in ${duration}ms`);
    console.log(`   Completed batches: ${job.completedBatches}`);
    console.log(`   Failed batches: ${job.failedBatches}`);

    this.emit('sync-completed', {
      jobId,
      completedBatches: job.completedBatches,
      failedBatches: job.failedBatches,
      duration
    });

    // Cleanup
    this.activeSyncJobs.delete(jobId);
  }

  // Master: Handle worker exit
  async handleWorkerExit(worker) {
    if (this.syncWorkers.has(worker.id)) {
      console.log(`Sync worker ${worker.id} exited, removing from available workers`);
      this.syncWorkers.delete(worker.id);
      this.availableWorkers.delete(worker.id);
      
      // Handle any assigned work - reassign to available worker
      const assignment = this.workerAssignments.get(worker.id);
      if (assignment) {
        console.log(`Reassigning work from failed worker ${worker.id}`);
        this.workerAssignments.delete(worker.id);
        
        // Find available worker to reassign the batch
        const availableWorkerIds = Array.from(this.availableWorkers);
        if (availableWorkerIds.length > 0) {
          const newWorkerId = availableWorkerIds[0];
          const job = this.activeSyncJobs.get(assignment.jobId);
          if (job?.remainingBatches?.length > 0) {
            const nextBatch = job.remainingBatches.shift();
            const batchIndex = job.nextBatchIndex++;
            await this.assignBatchToWorker(newWorkerId, assignment.jobId, nextBatch, batchIndex);
          }
        }
      }
    }
  }

  // Worker: Process assigned batch
  async processSyncBatch(data) {
    const { jobId, batchIndex, batch, options } = data;
    
    console.log(`Worker ${process.pid} processing batch ${batchIndex} with ${batch.length} files`);

    try {
      const SyncService = require('./syncService');
      const results = [];

      // Process each file in the batch
      for (const file of batch) {
        try {
          // Send progress update
          process.send({
            type: 'sync-progress-update',
            data: {
              jobId,
              batchIndex,
              currentFile: file.public_id,
              progress: results.length / batch.length
            }
          });

          const result = await SyncService.processSingleFile(file, options);
          results.push({ file: file.public_id, status: 'success', result });
        } catch (error) {
          results.push({ file: file.public_id, status: 'failed', error: error.message });
        }
      }

      // Report batch completion
      process.send({
        type: 'sync-batch-completed',
        data: {
          jobId,
          batchIndex,
          results
        }
      });

    } catch (error) {
      console.error(`Worker ${process.pid} failed to process batch ${batchIndex}:`, error);
      
      // Report batch failure
      process.send({
        type: 'sync-batch-failed',
        data: {
          jobId,
          batchIndex,
          error: error.message
        }
      });
    }
  }

  // Get sync statistics
  getSyncStats() {
    if (!cluster.isMaster) return null;

    return {
      totalSyncWorkers: this.syncWorkers.size,
      availableWorkers: this.availableWorkers.size,
      activeSyncJobs: this.activeSyncJobs.size,
      workerAssignments: Array.from(this.workerAssignments.entries())
    };
  }
}

module.exports = SyncCoordinator;
