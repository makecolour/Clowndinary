const { pool } = require('../config/database');

class Upload {
  static async create(uploadData) {
    try {
      const {
        batchId,
        configId,
        originalName,
        cloudinaryPublicId,
        cloudinaryUrl,
        cloudinarySecureUrl,
        fileSize,
        width,
        height,
        format
      } = uploadData;

      const [result] = await pool.execute(
        `INSERT INTO uploads 
         (batch_id, config_id, original_name, cloudinary_public_id, cloudinary_url, 
          cloudinary_secure_url, file_size, width, height, format) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [batchId, configId, originalName, cloudinaryPublicId, cloudinaryUrl, 
         cloudinarySecureUrl, fileSize, width, height, format]
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  static async findByBatchId(batchId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM uploads WHERE batch_id = ? ORDER BY created_at',
        [batchId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async findByConfigId(configId) {
    try {
      const [rows] = await pool.execute(
        `SELECT u.*, ub.batch_name, ub.created_at as batch_created_at
         FROM uploads u
         JOIN upload_batches ub ON u.batch_id = ub.id
         WHERE u.config_id = ? 
         ORDER BY u.created_at DESC`,
        [configId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async generateCSV(uploads, batchInfo = null) {
    try {
      let csvContent = 'Batch Name,Original Name,Cloudinary URL,Secure URL,File Size (KB),Width,Height,Format,Upload Date\n';
      
      uploads.forEach(upload => {
        const batchName = batchInfo ? batchInfo.batch_name : (upload.batch_name || 'Unknown');
        const fileSizeKB = Math.round(upload.file_size / 1024);
        const uploadDate = new Date(upload.created_at).toISOString();
        
        csvContent += `"${batchName}","${upload.original_name}","${upload.cloudinary_url}","${upload.cloudinary_secure_url}",${fileSizeKB},${upload.width},${upload.height},"${upload.format}","${uploadDate}"\n`;
      });
      
      return csvContent;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Upload;