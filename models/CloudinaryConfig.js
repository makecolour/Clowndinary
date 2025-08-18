const { pool } = require('../config/database');
const bcrypt = require('bcrypt');
const CryptoJS = require('crypto-js');
const cloudinary = require('cloudinary').v2;

// Encryption key - in production, this should be in environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-encryption-key-change-in-production';

class CloudinaryConfig {
  // Encrypt API secret for storage
  static encryptSecret(secret) {
    return CryptoJS.AES.encrypt(secret, ENCRYPTION_KEY).toString();
  }

  // Decrypt API secret for use
  static decryptSecret(encryptedSecret) {
    const bytes = CryptoJS.AES.decrypt(encryptedSecret, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // Validate Cloudinary credentials by making a test API call
  static async validateCloudinaryCredentials(apiName, apiKey, apiSecret) {
    return new Promise((resolve) => {
      // Create a new cloudinary instance with provided credentials
      const testCloudinary = require('cloudinary').v2;
      
      // Configure cloudinary with provided credentials
      testCloudinary.config({
        cloud_name: apiName,
        api_key: apiKey,
        api_secret: apiSecret
      });

      // Make a simple API call to validate credentials
      testCloudinary.api.resources({
        resource_type: 'image',
        max_results: 1
      }, (error, result) => {
        if (error) {
          // Check if it's an authentication error
          if (error.http_code === 401 || error.http_code === 403) {
            resolve({ valid: false, error: 'Invalid Cloudinary credentials' });
          } else {
            // Other errors might be due to network issues, but credentials could be valid
            resolve({ valid: true, error: null });
          }
        } else {
          resolve({ valid: true, error: null });
        }
      });
    });
  }
  static async create(apiName, apiKey, apiSecret) {
    try {
      const encryptedSecret = this.encryptSecret(apiSecret);
      const [result] = await pool.execute(
        'INSERT INTO cloudinary_configs (api_name, api_key, api_secret) VALUES (?, ?, ?)',
        [apiName, apiKey, encryptedSecret]
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  static async findByApiName(apiName) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM cloudinary_configs WHERE api_name = ?',
        [apiName]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async authenticate(apiName, apiKey, apiSecret) {
    try {
      const config = await this.findByApiName(apiName);
      if (!config) {
        return null;
      }

      const keyMatch = config.api_key === apiKey;
      const decryptedSecret = this.decryptSecret(config.api_secret);
      const secretMatch = decryptedSecret === apiSecret;

      if (keyMatch && secretMatch) {
        return {
          id: config.id,
          api_name: config.api_name,
          api_key: config.api_key,
          api_secret_raw: apiSecret // Return raw secret for Cloudinary usage
        };
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  static async exists(apiName) {
    try {
      const config = await this.findByApiName(apiName);
      return !!config;
    } catch (error) {
      throw error;
    }
  }

  static async credentialsExist(apiName, apiKey, apiSecret) {
    try {
      const config = await this.findByApiName(apiName);
      if (!config) {
        return false;
      }

      const keyMatch = config.api_key === apiKey;
      const decryptedSecret = this.decryptSecret(config.api_secret);
      const secretMatch = decryptedSecret === apiSecret;

      return keyMatch && secretMatch;
    } catch (error) {
      throw error;
    }
  }

  static async findByApiKeyAndSecret(apiKey, apiSecret) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM cloudinary_configs WHERE api_key = ?',
        [apiKey]
      );
      
      for (const row of rows) {
        const decryptedSecret = this.decryptSecret(row.api_secret);
        if (decryptedSecret === apiSecret) {
          return row;
        }
      }
      
      return null;
    } catch (error) {
      throw error;
    }
  }

  static async getDecryptedSecret(configId) {
    try {
      const [rows] = await pool.execute(
        'SELECT api_secret FROM cloudinary_configs WHERE id = ?',
        [configId]
      );
      
      if (rows[0]) {
        return this.decryptSecret(rows[0].api_secret);
      }
      
      return null;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CloudinaryConfig;