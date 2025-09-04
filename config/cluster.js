/**
 * Cluster configuration for Clowndinary
 */

const os = require('os');

module.exports = {
  // Number of worker processes to spawn
  // Can be overridden by NODE_CLUSTERS environment variable
  workers: process.env.NODE_CLUSTERS || os.cpus().length,
  
  // Percentage of workers dedicated to sync tasks (0.1 = 10%, 0.3 = 30%)
  syncWorkerRatio: process.env.SYNC_WORKER_RATIO || 0.3,
  
  // Minimum number of sync workers
  minSyncWorkers: process.env.MIN_SYNC_WORKERS || 1,
  
  // Maximum number of sync workers
  maxSyncWorkers: process.env.MAX_SYNC_WORKERS || 4,
  
  // Restart workers if they crash
  autoRestart: true,
  
  // Graceful shutdown timeout (ms)
  shutdownTimeout: 30000,
  
  // Worker restart delay (ms)
  restartDelay: 1000,
  
  // Maximum restart attempts
  maxRestarts: 10,
  
  // Enable cluster logging
  logging: true,
  
  // Sync worker specific settings
  sync: {
    // Default batch size for distributed sync
    defaultBatchSize: 10,
    
    // Maximum workers to use for a single sync job
    maxWorkersPerJob: 4,
    
    // Timeout for individual sync operations (ms)
    operationTimeout: 60000,
    
    // Enable distributed sync processing
    enableDistributedSync: true
  }
};
