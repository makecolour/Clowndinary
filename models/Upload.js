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
        bunnyUrl,
        fileSize,
        width,
        height,
        format
      } = uploadData;

      // Ensure all fields are null if undefined
      const values = [
        batchId ?? null,
        configId ?? null,
        originalName ?? null,
        cloudinaryPublicId ?? null,
        cloudinaryUrl ?? null,
        cloudinarySecureUrl ?? null,
        bunnyUrl ?? null,
        fileSize ?? null,
        width ?? null,
        height ?? null,
        format ?? null
      ];

      const [result] = await pool.execute(
        `INSERT INTO uploads 
         (batch_id, config_id, original_name, cloudinary_public_id, cloudinary_url, 
          cloudinary_secure_url, bunny_url, file_size, width, height, format) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values
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

  static async findByConfigIdAndDateRange(configId, startDate, endDate) {
    try {
      const [rows] = await pool.execute(
        `SELECT * FROM uploads 
         WHERE config_id = ? AND created_at BETWEEN ? AND ?
         ORDER BY created_at DESC`,
        [configId, startDate, endDate]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async findByPublicId(publicId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM uploads WHERE cloudinary_public_id = ? LIMIT 1',
        [publicId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async generateCSV(uploads, batchInfo = null) {
    try {
      let csvContent = 'Batch Name,Original Name,Cloudinary URL,Secure URL,File Size (KB),Width,Height,Format,Upload Date,Bunny URL\n';
      
      // Get latest Bunny URLs for all uploads in this batch
      const uploadIds = uploads.map(upload => upload.id);
      const bunnyUrls = await this.getLatestBunnyUrls(uploadIds);
      
      uploads.forEach(upload => {
        const batchName = batchInfo ? batchInfo.batch_name : (upload.batch_name || 'Unknown');
        const fileSizeKB = Math.round(upload.file_size / 1024);
        const uploadDate = new Date(upload.created_at).toISOString();
        const bunnyUrl = bunnyUrls[upload.id] || '';
        
        csvContent += `"${batchName}","${upload.original_name}","${upload.cloudinary_url}","${upload.cloudinary_secure_url}",${fileSizeKB},${upload.width},${upload.height},"${upload.format}","${uploadDate}","${bunnyUrl}"\n`;
      });
      
      return csvContent;
    } catch (error) {
      throw error;
    }
  }

  static async getLatestBunnyUrls(uploadIds) {
    try {
      if (!uploadIds || uploadIds.length === 0) {
        return {};
      }

      const placeholders = uploadIds.map(() => '?').join(',');
      const [rows] = await pool.execute(
        `SELECT sl.upload_id, sl.bunny_url
         FROM sync_logs sl
         INNER JOIN (
           SELECT upload_id, MAX(synced_at) as latest_sync
           FROM sync_logs 
           WHERE upload_id IN (${placeholders}) 
           AND status = 'success' 
           AND bunny_url IS NOT NULL
           GROUP BY upload_id
         ) latest ON sl.upload_id = latest.upload_id AND sl.synced_at = latest.latest_sync
         WHERE sl.upload_id IN (${placeholders})`,
        [...uploadIds, ...uploadIds]
      );

      // Convert to object with upload_id as key
      const result = {};
      rows.forEach(row => {
        result[row.upload_id] = row.bunny_url;
      });

      return result;
    } catch (error) {
      console.error('Error getting latest Bunny URLs:', error);
      return {};
    }
  }

  static async updateBunnyUrl(uploadId, bunnyUrl) {
    try {
      const [result] = await pool.execute(
        'UPDATE uploads SET bunny_url = ? WHERE id = ?',
        [bunnyUrl, uploadId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating bunny URL:', error);
      throw error;
    }
  }
}

module.exports = Upload;