var express = require('express');
var router = express.Router();
var BunnyConfig = require('../models/BunnyConfig');
var SyncJob = require('../models/SyncJob');
var SyncService = require('../services/syncService');
var { requireAuth } = require('../middleware/auth');

// GET bunny storage configuration page
router.get('/bunny-config', requireAuth, async function(req, res, next) {
  try {
    const configId = req.session.cloudinaryConfig.id;
    const bunnyConfig = await BunnyConfig.findByConfigId(configId);
    
    console.log('Rendering bunny-config with data:', {
      title: 'Bunny Storage Configuration - Clowndinary',
      bunnyConfig: bunnyConfig,
      success: req.query.success,
      error: req.query.error
    });
    
    res.render('bunny-config', {
      title: 'Bunny Storage Configuration - Clowndinary',
      bunnyConfig: bunnyConfig,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Bunny config page error:', error);
    res.render('bunny-config', {
      title: 'Bunny Storage Configuration - Clowndinary',
      bunnyConfig: null,
      success: null,
      error: 'Error loading configuration'
    });
  }
});

// POST bunny storage configuration
router.post('/bunny-config', requireAuth, async function(req, res, next) {
  try {
    const configId = req.session.cloudinaryConfig.id;
    const { storageZone, apiKey, region, pullZone, rootFolder, ftpPassword } = req.body;
    
    if (!storageZone || !apiKey) {
      return res.redirect('/sync/bunny-config?error=Storage Zone and API Key are required');
    }

    // Sanitize pull zone URL - remove any protocol if present
    let sanitizedPullZone = '';
    if (pullZone) {
      // Remove any protocol (http://, https://, ftp://, ws://, etc.)
      sanitizedPullZone = pullZone.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '').trim();
    }

    // Validate Bunny Storage credentials
    const validation = await SyncService.validateBunnyConfig(storageZone, apiKey, region || 'de');
    if (!validation.valid) {
      return res.redirect('/sync/bunny-config?error=' + encodeURIComponent(validation.error));
    }

    // Check if configuration exists
    const existingConfig = await BunnyConfig.findByConfigId(configId);
    
    if (existingConfig) {
      // Update existing configuration
      await BunnyConfig.update(configId, storageZone, apiKey, region || 'de', sanitizedPullZone, rootFolder || '', ftpPassword || '');
    } else {
      // Create new configuration
      await BunnyConfig.create(configId, storageZone, apiKey, region || 'de', sanitizedPullZone, rootFolder || '', ftpPassword || '');
    }

    res.redirect('/sync/bunny-config?success=Bunny Storage configuration saved successfully');
  } catch (error) {
    console.error('Bunny config save error:', error);
    res.redirect('/sync/bunny-config?error=Error saving configuration');
  }
});

// GET sync page
router.get('/', requireAuth, async function(req, res, next) {
  try {
    const configId = req.session.cloudinaryConfig.id;
    
    // Check if Bunny Storage is configured
    const bunnyConfig = await BunnyConfig.findByConfigId(configId);
    if (!bunnyConfig) {
      return res.redirect('/sync/bunny-config?error=Please configure Bunny Storage first');
    }

    // Get recent sync jobs
    const recentJobs = await SyncJob.findByConfigId(configId, 10);
    
    // Get active jobs
    const activeJobs = await SyncJob.getActiveJobs(configId);

    // Get cluster stats if available
    let clusterStats = null;
    if (global.syncCoordinator) {
      clusterStats = global.syncCoordinator.getSyncStats();
    }

    res.render('sync', {
      title: 'Sync to Bunny Storage - Clowndinary',
      recentJobs: recentJobs,
      activeJobs: activeJobs,
      clusterStats: clusterStats,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Sync page error:', error);
    res.render('sync', {
      title: 'Sync to Bunny Storage - Clowndinary',
      recentJobs: [],
      activeJobs: [],
      clusterStats: null,
      success: null,
      error: 'Error loading sync data'
    });
  }
});

// POST start sync
router.post('/start', requireAuth, async function(req, res, next) {
  try {
    const configId = req.session.cloudinaryConfig.id;
    const { startDate, endDate, batchSize, downloadRetries, uploadRetries, downloadTimeout } = req.body;
    
    if (!startDate || !endDate) {
      return res.redirect('/sync?error=Start and end dates are required');
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return res.redirect('/sync?error=Start date must be before end date');
    }

    if (end > new Date()) {
      return res.redirect('/sync?error=End date cannot be in the future');
    }

    // Check for active jobs
    const activeJobs = await SyncJob.getActiveJobs(configId);
    if (activeJobs.length > 0) {
      return res.redirect('/sync?error=Another sync job is already running');
    }

    // Prepare sync options with user-defined or default values
    const clusterConfig = require('../config/cluster');
    const syncOptions = {
      batchSize: Math.max(1, Math.min(parseInt(batchSize) || clusterConfig.sync?.defaultBatchSize || 3, 10)), // Limit between 1-10
      downloadRetries: Math.max(1, Math.min(parseInt(downloadRetries) || 3, 5)), // Limit between 1-5
      uploadRetries: Math.max(1, Math.min(parseInt(uploadRetries) || 3, 5)), // Limit between 1-5
      downloadTimeout: Math.max(10000, Math.min(parseInt(downloadTimeout) || 45000, 120000)), // 10s-120s
      maxWorkers: Math.min(clusterConfig.sync?.maxWorkersPerJob || 4, 6) // Limit max workers
    };

    console.log('Starting sync with options:', syncOptions);

    // Start sync job in background with enhanced distributed processing
    SyncService.syncCloudinaryToBunny(configId, startDate, endDate, syncOptions)
      .then(result => {
        console.log('Sync job completed:', result);
        if (result.mode === 'distributed') {
          console.log(`📊 Distributed sync used ${result.workersAssigned} workers for ${result.totalBatches} batches`);
        }
      })
      .catch(error => {
        console.error('Sync job failed:', error);
      });

    const successMessage = global.syncCoordinator ? 
      'Distributed sync job started with enhanced multi-worker processing' :
      'Sync job started with enhanced retry logic';
    
    res.redirect('/sync?success=' + encodeURIComponent(successMessage));
  } catch (error) {
    console.error('Start sync error:', error);
    res.redirect('/sync?error=Error starting sync job');
  }
});

// GET sync job details
router.get('/job/:jobId', requireAuth, async function(req, res, next) {
  try {
    const jobId = req.params.jobId;
    const configId = req.session.cloudinaryConfig.id;
    
    const progress = await SyncService.getSyncProgress(jobId);
    
    // Verify job belongs to current user
    if (progress.job.cloudinary_config_id !== configId) {
      return res.status(403).render('error', { 
        title: 'Access Denied - Clowndinary',
        message: 'Access denied',
        error: { status: 403 }
      });
    }

    res.render('sync-job-details', {
      title: `Sync Job ${jobId} - Clowndinary`,
      job: progress.job,
      logs: progress.logs,
      progress: progress.progress
    });
  } catch (error) {
    console.error('Sync job details error:', error);
    res.status(404).render('error', {
      title: 'Error - Clowndinary',
      message: 'Sync job not found',
      error: { status: 404 }
    });
  }
});

// GET sync job progress (AJAX endpoint)
router.get('/api/job/:jobId/progress', requireAuth, async function(req, res, next) {
  try {
    const jobId = req.params.jobId;
    const configId = req.session.cloudinaryConfig.id;
    
    const progress = await SyncService.getSyncProgress(jobId);
    
    // Verify job belongs to current user
    if (progress.job.cloudinary_config_id !== configId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      status: progress.job.status,
      totalFiles: progress.job.total_files,
      syncedFiles: progress.job.synced_files,
      failedFiles: progress.job.failed_files,
      progress: progress.progress,
      errorMessage: progress.job.error_message
    });
  } catch (error) {
    console.error('Sync progress API error:', error);
    res.status(500).json({ error: 'Error fetching progress' });
  }
});

// GET cluster statistics (AJAX endpoint)
router.get('/api/cluster/stats', requireAuth, function(req, res, next) {
  try {
    if (global.syncCoordinator) {
      const stats = global.syncCoordinator.getSyncStats();
      res.json({
        available: true,
        ...stats
      });
    } else {
      res.json({
        available: false,
        message: 'Distributed sync not available'
      });
    }
  } catch (error) {
    console.error('Cluster stats API error:', error);
    res.status(500).json({ error: 'Error fetching cluster stats' });
  }
});

module.exports = router;
