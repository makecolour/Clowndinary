var express = require('express');
var router = express.Router();
var path = require('path');
var CloudinaryConfig = require('../models/CloudinaryConfig');
var Upload = require('../models/Upload');
var UploadBatch = require('../models/UploadBatch');
var CloudinaryService = require('../services/cloudinaryService');
var upload = require('../middleware/upload');
var { requireAuth, redirectIfAuth } = require('../middleware/auth');

/* GET home page - redirect to login/dashboard */
router.get('/', function(req, res, next) {
  if (req.session && req.session.cloudinaryConfig) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

/* GET login page */
router.get('/login', redirectIfAuth, function(req, res, next) {
  res.render('login', { 
    title: 'Login - Clowndinary',
    error: req.query.error
  });
});

/* POST login */
router.post('/login', redirectIfAuth, async function(req, res, next) {
  try {
    const { apiName, apiKey, apiSecret } = req.body;
    
    if (!apiName || !apiKey || !apiSecret) {
      return res.redirect('/login?error=All fields are required');
    }

    const config = await CloudinaryConfig.authenticate(apiName, apiKey, apiSecret);
    
    if (config) {
      req.session.cloudinaryConfig = config;
      // Explicitly save the session before redirecting
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.redirect('/login?error=Session error occurred');
        }
        res.redirect('/dashboard');
      });
    } else {
      res.redirect('/login?error=Invalid credentials');
    }
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/login?error=Server error occurred');
  }
});

/* GET register page */
router.get('/register', redirectIfAuth, function(req, res, next) {
  res.render('register', { 
    title: 'Register - Clowndinary',
    error: req.query.error,
    success: req.query.success
  });
});

/* POST register */
router.post('/register', redirectIfAuth, async function(req, res, next) {
  try {
    const { apiName, apiKey, apiSecret } = req.body;
    
    if (!apiName || !apiKey || !apiSecret) {
      return res.redirect('/register?error=All fields are required');
    }

    // Validate Cloudinary credentials by making a test API call
    const validation = await CloudinaryConfig.validateCloudinaryCredentials(apiName, apiKey, apiSecret);
    if (!validation.valid) {
      return res.redirect('/register?error=' + encodeURIComponent(validation.error || 'Invalid Cloudinary credentials'));
    }

    // Check if the exact same credentials already exist
    const credentialsExist = await CloudinaryConfig.credentialsExist(apiName, apiKey, apiSecret);
    if (credentialsExist) {
      return res.redirect('/register?error=These exact credentials already exist. Please login instead.');
    }

    // Check if the API name exists with different credentials
    const apiNameExists = await CloudinaryConfig.exists(apiName);
    if (apiNameExists) {
      return res.redirect('/register?error=This API name is already registered with different credentials');
    }

    // Check if the API key and secret combination exists with a different cloud name
    const existingCredentials = await CloudinaryConfig.findByApiKeyAndSecret(apiKey, apiSecret);
    if (existingCredentials) {
      return res.redirect('/register?error=These API credentials are already registered with cloud name: ' + existingCredentials.api_name);
    }

    await CloudinaryConfig.create(apiName, apiKey, apiSecret);
    res.redirect('/register?success=Registration successful! You can now login.');
  } catch (error) {
    console.error('Registration error:', error);
    res.redirect('/register?error=Server error occurred');
  }
});

/* GET dashboard */
router.get('/dashboard', requireAuth, async function(req, res, next) {
  try {
    const batches = await UploadBatch.findByConfigIdGroupedByDate(req.session.cloudinaryConfig.id);
    console.log('Dashboard batches data:', JSON.stringify(batches, null, 2));
    res.render('dashboard', { 
      title: 'Dashboard - Clowndinary',
      batches: batches,
      config: req.session.cloudinaryConfig
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('dashboard', { 
      title: 'Dashboard - Clowndinary',
      batches: [],
      config: req.session.cloudinaryConfig,
      error: 'Error loading uploads'
    });
  }
});

/* GET upload page */
router.get('/upload', requireAuth, function(req, res, next) {
  res.render('upload', { 
    title: 'Upload Images - Clowndinary',
    success: req.query.success,
    error: req.query.error,
    query: req.query
  });
});

/* POST upload images */
router.post('/upload', requireAuth, upload.array('images'), async function(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.redirect('/upload?error=No files selected');
    }

    const storageProvider = req.body.storageProvider;
    const config = req.session.cloudinaryConfig;
    const batchName = `Upload ${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const batchId = await UploadBatch.create(config.id, batchName);

    let uploadResults = [];
    let totalSize = 0;

    if (storageProvider === 'cloudinary') {
      CloudinaryService.configureCloudinary(config.api_name, config.api_key, config.api_secret_raw);
      uploadResults = await CloudinaryService.uploadMultipleImages(req.files);
      for (let i = 0; i < uploadResults.length; i++) {
        const result = uploadResults[i];
        const file = req.files[i];
        totalSize += result.bytes;
        await Upload.create({
          batchId: batchId,
          configId: config.id,
          originalName: file.originalname,
          cloudinaryPublicId: result.public_id,
          cloudinaryUrl: result.url,
          cloudinarySecureUrl: result.secure_url,
          fileSize: result.bytes,
          width: result.width,
          height: result.height,
          format: result.format
        });
      }
    } else if (storageProvider === 'bunny') {
      // Bunny Storage upload
      const BunnyStorageService = require('../services/bunnyStorageService');
      const BunnyConfig = require('../models/BunnyConfig');
      // Get decrypted Bunny config for the current Cloudinary config
      const bunnyConfig = await BunnyConfig.getDecryptedConfig(config.id);
      if (!bunnyConfig || !bunnyConfig.storage_zone || !bunnyConfig.api_key) {
        return res.redirect('/upload?error=No Bunny Storage configuration found for this account');
      }
      const bunnyService = new BunnyStorageService(bunnyConfig.storage_zone, bunnyConfig.api_key, bunnyConfig.region || 'de');
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const result = await bunnyService.uploadFile(file.buffer, file.originalname);
        totalSize += file.size;
        
        // Get the public URL using the pull zone
        const publicUrl = bunnyService.getPublicUrl(file.originalname, bunnyConfig.pull_zone);
        
        await Upload.create({
          batchId: batchId,
          configId: config.id,
          originalName: file.originalname,
          cloudinaryPublicId: `batch_${batchId}`,
          cloudinaryUrl: publicUrl,
          cloudinarySecureUrl: publicUrl,
          fileSize: file.size,
          width: null,
          height: null,
          format: path.extname(file.originalname).replace('.', ''),
          bunnyUrl: result.url
        });
      }
    } else {
      return res.redirect('/upload?error=Invalid storage provider selected');
    }

    await UploadBatch.updateTotals(batchId, req.files.length, totalSize);
    res.redirect('/upload?success=' + encodeURIComponent(`Successfully uploaded ${req.files.length} image(s)`) + '&batchId=' + batchId);
  } catch (error) {
    console.error('Upload error:', error);
    res.redirect('/upload?error=Upload failed: ' + error.message);
  }
});

/* POST logout */
router.post('/logout', function(req, res, next) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login');
  });
});

/* GET export CSV for batch */
router.get('/export-csv/:batchId', requireAuth, async function(req, res, next) {
  try {
    const batchId = req.params.batchId;
    const batch = await UploadBatch.getBatchWithUploads(batchId);
    
    if (!batch) {
      return res.status(404).send('Batch not found');
    }

    // Check if the batch belongs to the current user
    if (batch.config_id !== req.session.cloudinaryConfig.id) {
      return res.status(403).send('Access denied');
    }

    const csvContent = await Upload.generateCSV(batch.uploads, batch);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="batch_${batchId}_${batch.batch_name.replace(/[^a-zA-Z0-9]/g, '_')}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).send('Error generating CSV');
  }
});

module.exports = router;
