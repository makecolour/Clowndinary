const BunnyStorageService = require('./bunnyStorageService');
const BunnyConfig = require('../models/BunnyConfig');
const CloudinaryConfig = require('../models/CloudinaryConfig');
const Upload = require('../models/Upload');
const UploadBatch = require('../models/UploadBatch');
const SyncJob = require('../models/SyncJob');
const cloudinary = require('cloudinary').v2;

class SyncService {
  static async syncCloudinaryToBunny(configId, startDate, endDate, options = {}) {
    let jobId = null;
    
    try {
      // Create sync job
      jobId = await SyncJob.create(configId, startDate, endDate, 'pending');
      
      // Get Bunny configuration
      const bunnyConfig = await BunnyConfig.getDecryptedConfig(configId);
      if (!bunnyConfig) {
        await SyncJob.updateStatus(jobId, 'failed', null, null, null, 'Bunny Storage not configured');
        throw new Error('Bunny Storage configuration not found');
      }

      // Get Cloudinary configuration
      const cloudinaryConfig = await CloudinaryConfig.findById(configId);
      if (!cloudinaryConfig) {
        await SyncJob.updateStatus(jobId, 'failed', null, null, null, 'Cloudinary configuration not found');
        throw new Error('Cloudinary configuration not found');
      }

      // Initialize Bunny Storage service
      const bunnyService = new BunnyStorageService(
        bunnyConfig.storage_zone,
        bunnyConfig.api_key,
        bunnyConfig.region
      );

      // Configure Cloudinary
      const cloudinarySecret = CloudinaryConfig.decryptSecret(cloudinaryConfig.api_secret);
      cloudinary.config({
        cloud_name: cloudinaryConfig.api_name,
        api_key: cloudinaryConfig.api_key,
        api_secret: cloudinarySecret
      });

      // Get all files from Cloudinary within the date range
      console.log(`Searching Cloudinary for files between ${startDate} and ${endDate}`);
      const cloudinaryFiles = await this.getCloudinaryFilesByDateRange(startDate, endDate);
      
      if (cloudinaryFiles.length === 0) {
        await SyncJob.updateStatus(jobId, 'completed', 0, 0, 0, 'No files found in Cloudinary for the specified date range');
        return { jobId, message: 'No files to sync' };
      }

      // Update job status to running
      await SyncJob.updateStatus(jobId, 'running', cloudinaryFiles.length, 0, 0);

      let syncedCount = 0;
      let failedCount = 0;
      const folder = bunnyConfig.root_folder || 'cloudinary-sync';

      // Process uploads in batches to avoid overwhelming the services
      const batchSize = options.batchSize || 3; // Reduced batch size for better stability
      const syncOptions = {
        downloadRetries: options.downloadRetries || 3,
        downloadTimeout: options.downloadTimeout || 45000, // 45 seconds
        uploadRetries: options.uploadRetries || 3
      };
      
      for (let i = 0; i < cloudinaryFiles.length; i += batchSize) {
        const batch = cloudinaryFiles.slice(i, i + batchSize);
        
        await Promise.allSettled(batch.map(async (cloudinaryFile) => {
          try {
            // Generate filename for Bunny Storage
            const fileName = BunnyStorageService.sanitizeFileName(
              cloudinaryFile.public_id, 
              cloudinaryFile.format
            );

            // Sync file from Cloudinary to Bunny with enhanced options
            const result = await bunnyService.syncFromCloudinary(
              cloudinaryFile.secure_url,
              fileName,
              folder,
              syncOptions
            );

            // Generate public URL if pull zone is configured
            const publicUrl = bunnyService.getPublicUrl(
              fileName, 
              bunnyConfig.pull_zone, 
              folder
            );

            // Log successful sync (create a temporary upload record for logging)
            const tempUpload = await this.createTempUploadRecord(configId, cloudinaryFile);
            await SyncJob.createSyncLog(
              jobId, 
              tempUpload.id, 
              'success', 
              publicUrl || result.url
            );

            syncedCount++;
            console.log(`✅ Synced ${fileName} (${syncedCount}/${cloudinaryFiles.length})`);
          } catch (error) {
            // Log failed sync with detailed error information
            const tempUpload = await this.createTempUploadRecord(configId, cloudinaryFile);
            
            // Categorize error for better reporting
            let errorCategory = 'Unknown';
            if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
              errorCategory = 'Timeout';
            } else if (error.message.includes('ECONNRESET') || error.message.includes('ENOTFOUND')) {
              errorCategory = 'Network';
            } else if (error.message.includes('HTTP 4')) {
              errorCategory = 'Client Error';
            } else if (error.message.includes('HTTP 5')) {
              errorCategory = 'Server Error';
            }
            
            const enhancedErrorMessage = `[${errorCategory}] ${error.message}`;
            
            await SyncJob.createSyncLog(
              jobId, 
              tempUpload.id, 
              'failed', 
              null, 
              enhancedErrorMessage
            );
            failedCount++;
            console.error(`❌ Failed to sync ${cloudinaryFile.public_id}: ${enhancedErrorMessage}`);
          }
        }));

        // Update progress
        await SyncJob.updateStatus(jobId, 'running', null, syncedCount, failedCount);

        // Add a longer delay between batches to be more respectful to the APIs
        if (i + batchSize < cloudinaryFiles.length) {
          const delay = Math.min(2000, 500 * batchSize); // Scale delay with batch size
          console.log(`Processed batch ${Math.floor(i/batchSize) + 1}, waiting ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Final status update
      const finalStatus = failedCount === 0 ? 'completed' : 'completed_with_errors';
      await SyncJob.updateStatus(jobId, finalStatus, null, syncedCount, failedCount);

      return {
        jobId,
        totalFiles: cloudinaryFiles.length,
        syncedFiles: syncedCount,
        failedFiles: failedCount,
        status: finalStatus
      };

    } catch (error) {
      console.error('Sync error:', error);
      if (jobId) {
        await SyncJob.updateStatus(jobId, 'failed', null, null, null, error.message);
      }
      throw error;
    }
  }

  static async getSyncProgress(jobId) {
    try {
      const job = await SyncJob.findById(jobId);
      if (!job) {
        throw new Error('Sync job not found');
      }

      const logs = await SyncJob.getSyncLogs(jobId);
      
      return {
        job,
        logs,
        progress: job.total_files > 0 ? 
          Math.round(((job.synced_files + job.failed_files) / job.total_files) * 100) : 0
      };
    } catch (error) {
      throw error;
    }
  }

  // Fetch files from Cloudinary within a date range
  static async getCloudinaryFilesByDateRange(startDate, endDate) {
    try {
      const startDateTime = new Date(startDate).toISOString();
      const endDateTime = new Date(endDate + 'T23:59:59.999Z').toISOString();
      
      let allResources = [];
      let nextCursor = null;
      
      do {
        const searchQuery = `created_at>="${startDateTime}" AND created_at<="${endDateTime}"`;
        
        let searchRequest = cloudinary.search
          .expression(searchQuery)
          .max_results(500)
          .sort_by('created_at', 'desc')
          .with_field('context')
          .with_field('tags')
          .with_field('metadata');
        
        if (nextCursor) {
          searchRequest = searchRequest.next_cursor(nextCursor);
        }
        
        const result = await searchRequest.execute();
        
        console.log(`Cloudinary search returned ${result.resources.length} files, nextCursor: ${result.next_cursor}`);
        
        allResources = allResources.concat(result.resources);
        nextCursor = result.next_cursor;
        
        // Add a small delay to respect API rate limits
        if (nextCursor) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } while (nextCursor);
      
      console.log(`Total Cloudinary files found in date range: ${allResources.length}`);
      return allResources;
    } catch (error) {
      console.error('Error fetching Cloudinary files:', error);
      throw new Error(`Failed to fetch files from Cloudinary: ${error.message}`);
    }
  }

  // Create a temporary upload record for logging purposes
  static async createTempUploadRecord(configId, cloudinaryFile) {
    try {
      // Check if this file already exists in our database
      const existingUpload = await Upload.findByPublicId(cloudinaryFile.public_id);
      if (existingUpload) {
        return existingUpload;
      }

      // Create a temporary batch for synced files if it doesn't exist
      let syncBatch = await UploadBatch.findSyncBatch(configId);
      if (!syncBatch) {
        const batchId = await UploadBatch.create(configId, 'Cloudinary Sync Batch');
        syncBatch = { id: batchId };
      }

      // Create upload record
      const uploadData = {
        batchId: syncBatch.id,
        configId: configId,
        originalName: cloudinaryFile.filename || cloudinaryFile.public_id,
        cloudinaryPublicId: cloudinaryFile.public_id,
        cloudinaryUrl: cloudinaryFile.url,
        cloudinarySecureUrl: cloudinaryFile.secure_url,
        fileSize: cloudinaryFile.bytes || 0,
        width: cloudinaryFile.width || 0,
        height: cloudinaryFile.height || 0,
        format: cloudinaryFile.format || 'unknown'
      };

      const uploadId = await Upload.create(uploadData);
      return { id: uploadId, ...uploadData };
    } catch (error) {
      console.error('Error creating temp upload record:', error);
      // Return a minimal record if database creation fails
      return {
        id: 0,
        original_name: cloudinaryFile.filename || cloudinaryFile.public_id,
        cloudinary_public_id: cloudinaryFile.public_id
      };
    }
  }

  static async validateBunnyConfig(storageZone, apiKey, region) {
    try {
      const bunnyService = new BunnyStorageService(storageZone, apiKey, region);
      
      // Try to list files to validate credentials
      await bunnyService.listFiles();
      
      return { valid: true, error: null };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message.includes('401') || error.message.includes('403') ? 
          'Invalid Bunny Storage credentials' : 
          'Unable to connect to Bunny Storage'
      };
    }
  }
}

module.exports = SyncService;
