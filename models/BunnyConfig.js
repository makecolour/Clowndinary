const { pool } = require('../config/database');
const CryptoJS = require('crypto-js');

// Encryption key - in production, this should be in environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-encryption-key-change-in-production';

class BunnyConfig {
  // Encrypt API key for storage
  static encryptApiKey(apiKey) {
    return CryptoJS.AES.encrypt(apiKey, ENCRYPTION_KEY).toString();
  }

  // Decrypt API key for use
  static decryptApiKey(encryptedApiKey) {
    const bytes = CryptoJS.AES.decrypt(encryptedApiKey, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // Encrypt password for storage
  static encryptPassword(password) {
    return CryptoJS.AES.encrypt(password, ENCRYPTION_KEY).toString();
  }

  // Decrypt password for use
  static decryptPassword(encryptedPassword) {
    const bytes = CryptoJS.AES.decrypt(encryptedPassword, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  static async create(configId, storageZone, apiKey, region, pullZone, rootFolder, ftpPassword) {
    try {
      const encryptedApiKey = this.encryptApiKey(apiKey);
      const encryptedFtpPassword = ftpPassword ? this.encryptPassword(ftpPassword) : null;
      
      const [result] = await pool.execute(
        `INSERT INTO bunny_configs (cloudinary_config_id, storage_zone, api_key, region, pull_zone, root_folder, ftp_password) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [configId, storageZone, encryptedApiKey, region, pullZone, rootFolder, encryptedFtpPassword]
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  static async findByConfigId(configId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM bunny_configs WHERE cloudinary_config_id = ?',
        [configId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async update(configId, storageZone, apiKey, region, pullZone, rootFolder, ftpPassword) {
    try {
      const encryptedApiKey = this.encryptApiKey(apiKey);
      const encryptedFtpPassword = ftpPassword ? this.encryptPassword(ftpPassword) : null;
      
      const [result] = await pool.execute(
        `UPDATE bunny_configs SET 
         storage_zone = ?, api_key = ?, region = ?, pull_zone = ?, root_folder = ?, ftp_password = ?
         WHERE cloudinary_config_id = ?`,
        [storageZone, encryptedApiKey, region, pullZone, rootFolder, encryptedFtpPassword, configId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  static async getDecryptedConfig(configId) {
    try {
      const config = await this.findByConfigId(configId);
      if (!config) return null;

      return {
        ...config,
        api_key: this.decryptApiKey(config.api_key),
        ftp_password: config.ftp_password ? this.decryptPassword(config.ftp_password) : null
      };
    } catch (error) {
      throw error;
    }
  }

  static async delete(configId) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM bunny_configs WHERE cloudinary_config_id = ?',
        [configId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = BunnyConfig;
