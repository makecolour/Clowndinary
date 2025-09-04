const https = require('https');
const fetch = require('node-fetch');
const path = require('path');

class BunnyStorageService {
  constructor(storageZone, apiKey, region = 'de') {
    this.storageZone = storageZone;
    this.apiKey = apiKey;
    this.region = region;
    this.baseUrl = this.getStorageEndpoint(region);
  }

  getStorageEndpoint(region) {
    const endpoints = {
      'de': 'storage.bunnycdn.com',
      'ny': 'ny.storage.bunnycdn.com',
      'la': 'la.storage.bunnycdn.com',
      'sg': 'sg.storage.bunnycdn.com',
      'uk': 'uk.storage.bunnycdn.com',
      'se': 'se.storage.bunnycdn.com',
      'br': 'br.storage.bunnycdn.com',
      'jh': 'jh.storage.bunnycdn.com',
      'syd': 'syd.storage.bunnycdn.com'
    };
    return endpoints[region] || endpoints['de'];
  }

  async uploadFile(fileBuffer, fileName, folder = '', retries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const filePath = folder ? `${folder}/${fileName}` : fileName;
        const url = `https://${this.baseUrl}/${this.storageZone}/${filePath}`;

        console.log(`Uploading to Bunny Storage: ${fileName} (attempt ${attempt}/${retries})`);

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'AccessKey': this.apiKey,
            'Content-Type': 'application/octet-stream',
            'Content-Length': fileBuffer.length
          },
          body: fileBuffer,
          timeout: 60000 // 60 second timeout for uploads
        });

        if (response.ok) {
          console.log(`Successfully uploaded ${fileName} to Bunny Storage`);
          return {
            success: true,
            url: url,
            fileName: fileName,
            path: filePath
          };
        } else {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      } catch (error) {
        lastError = error;
        console.warn(`Upload attempt ${attempt} failed for ${fileName}:`, error.message);
        
        // Don't retry on certain types of errors
        if (error.message.includes('HTTP 4') && !error.message.includes('HTTP 429')) {
          // Don't retry on 4xx client errors except rate limiting
          console.warn(`Client error, not retrying: ${error.message}`);
          break;
        }
        
        // Wait before retrying
        if (attempt < retries) {
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 15000); // Cap at 15 seconds
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Upload failed after ${retries} attempts: ${lastError.message}`);
  }

  async downloadFileFromUrl(fileUrl, retries = 3, timeout = 30000) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Downloading ${fileUrl} (attempt ${attempt}/${retries})`);
        
        // Create AbortController for timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(fileUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Clowndinary-Sync/1.0'
          },
          // Add connection timeout settings
          timeout: timeout
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const buffer = await response.buffer();
        console.log(`Successfully downloaded ${fileUrl} (${buffer.length} bytes)`);
        return buffer;
        
      } catch (error) {
        lastError = error;
        console.warn(`Download attempt ${attempt} failed for ${fileUrl}:`, error.message);
        
        // Don't retry on certain types of errors
        if (error.name === 'AbortError') {
          console.warn(`Request timeout after ${timeout}ms`);
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
          console.warn(`Network error: ${error.code}`);
        } else if (error.message.includes('HTTP 4')) {
          // Don't retry on 4xx client errors
          console.warn(`Client error, not retrying: ${error.message}`);
          break;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Cap at 10 seconds
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Download failed after ${retries} attempts: ${lastError.message}`);
  }

  async syncFromCloudinary(cloudinaryUrl, fileName, folder = '', options = {}) {
    try {
      const downloadRetries = options.downloadRetries || 3;
      const downloadTimeout = options.downloadTimeout || 30000;
      const uploadRetries = options.uploadRetries || 3;
      
      console.log(`Starting sync: ${cloudinaryUrl} -> ${fileName}`);
      
      // Download file from Cloudinary with retry logic
      const fileBuffer = await this.downloadFileFromUrl(cloudinaryUrl, downloadRetries, downloadTimeout);
      
      // Upload to Bunny Storage with retry logic
      const result = await this.uploadFile(fileBuffer, fileName, folder, uploadRetries);
      
      console.log(`Sync completed successfully: ${fileName}`);
      return result;
    } catch (error) {
      console.error(`Sync failed for ${fileName}:`, error.message);
      throw new Error(`Sync error: ${error.message}`);
    }
  }

  async deleteFile(fileName, folder = '') {
    try {
      const filePath = folder ? `${folder}/${fileName}` : fileName;
      const url = `https://${this.baseUrl}/${this.storageZone}/${filePath}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'AccessKey': this.apiKey
        }
      });

      if (response.ok) {
        return { success: true, deleted: filePath };
      } else {
        const errorText = await response.text();
        throw new Error(`Delete failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`Bunny Storage delete error: ${error.message}`);
    }
  }

  async listFiles(folder = '') {
    try {
      const folderPath = folder ? `${folder}/` : '';
      const url = `https://${this.baseUrl}/${this.storageZone}/${folderPath}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'AccessKey': this.apiKey
        }
      });

      if (response.ok) {
        const files = await response.json();
        return files;
      } else {
        const errorText = await response.text();
        throw new Error(`List files failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`Bunny Storage list error: ${error.message}`);
    }
  }

  // Get the public URL for a file (requires pull zone)
  getPublicUrl(fileName, pullZone, folder = '') {
    if (!pullZone) {
      return null;
    }
    
    // Ensure pull zone doesn't have any protocol prefix
    const cleanPullZone = pullZone.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
    
    const filePath = folder ? `${folder}/${fileName}` : fileName;
    return `https://${cleanPullZone}/${filePath}`;
  }

  // Generate a sanitized filename from Cloudinary public_id
  static sanitizeFileName(publicId, format = 'jpg') {
    const sanitized = publicId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${sanitized}.${format}`;
  }
}

module.exports = BunnyStorageService;
