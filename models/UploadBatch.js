const { pool } = require('../config/database');

class UploadBatch {
  static async create(configId, batchName, totalFiles = 0, totalSize = 0) {
    try {
      const [result] = await pool.execute(
        'INSERT INTO upload_batches (config_id, batch_name, total_files, total_size) VALUES (?, ?, ?, ?)',
        [configId, batchName, totalFiles, totalSize]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error creating upload batch:', error);
      throw error;
    }
  }

  static async updateTotals(batchId, totalFiles, totalSize) {
    try {
      await pool.execute(
        'UPDATE upload_batches SET total_files = ?, total_size = ? WHERE id = ?',
        [totalFiles, totalSize, batchId]
      );
    } catch (error) {
      console.error('Error updating batch totals:', error);
      throw error;
    }
  }

  static async findByConfigId(configId) {
    try {
      const [rows] = await pool.execute(
        `SELECT ub.*, COUNT(u.id) as upload_count, SUM(u.file_size) as total_uploaded_size
         FROM upload_batches ub
         LEFT JOIN uploads u ON ub.id = u.batch_id
         WHERE ub.config_id = ?
         GROUP BY ub.id
         ORDER BY ub.created_at DESC`,
        [configId]
      );
      return rows;
    } catch (error) {
      console.error('Error finding batches by config ID:', error);
      throw error;
    }
  }

  static async findByConfigIdGroupedByDate(configId) {
    try {
      // First, get all batches grouped by date
      const [dateRows] = await pool.execute(
        `SELECT 
           DATE(created_at) as upload_date,
           COUNT(*) as batch_count,
           SUM(total_files) as total_uploads
         FROM upload_batches
         WHERE config_id = ?
         GROUP BY DATE(created_at)
         ORDER BY upload_date DESC`,
        [configId]
      );

      // For each date, get the batches and their uploads
      const result = [];
      for (const dateRow of dateRows) {
        // Get batches for this date
        const [batchRows] = await pool.execute(
          `SELECT id, batch_name, total_files, total_size, created_at
           FROM upload_batches
           WHERE config_id = ? AND DATE(created_at) = ?
           ORDER BY created_at DESC`,
          [configId, dateRow.upload_date]
        );

        // Get uploads for each batch
        const batches = [];
        for (const batch of batchRows) {
          const [uploadRows] = await pool.execute(
            `SELECT id, original_name, cloudinary_url, cloudinary_secure_url,
                    file_size, width, height, format, created_at
             FROM uploads
             WHERE batch_id = ?
             ORDER BY created_at`,
            [batch.id]
          );

          batches.push({
            batch_id: batch.id,
            batch_name: batch.batch_name,
            batch_created_at: batch.created_at,
            upload_count: uploadRows.length,
            batch_size: uploadRows.reduce((sum, upload) => sum + (upload.file_size || 0), 0),
            uploads: uploadRows
          });
        }

        result.push({
          upload_date: dateRow.upload_date,
          batch_count: dateRow.batch_count,
          total_uploads: dateRow.total_uploads,
          batches: batches
        });
      }

      return result;
    } catch (error) {
      console.error('Error finding batches grouped by date:', error);
      throw error;
    }
  }

  static async findById(batchId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM upload_batches WHERE id = ?',
        [batchId]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding batch by ID:', error);
      throw error;
    }
  }

  static async getBatchWithUploads(batchId) {
    try {
      const [batchRows] = await pool.execute(
        `SELECT ub.*, cc.api_name 
         FROM upload_batches ub
         JOIN cloudinary_configs cc ON ub.config_id = cc.id
         WHERE ub.id = ?`,
        [batchId]
      );

      if (!batchRows[0]) {
        return null;
      }

      const [uploadRows] = await pool.execute(
        'SELECT * FROM uploads WHERE batch_id = ? ORDER BY created_at',
        [batchId]
      );

      return {
        ...batchRows[0],
        uploads: uploadRows
      };
    } catch (error) {
      console.error('Error getting batch with uploads:', error);
      throw error;
    }
  }
}

module.exports = UploadBatch;
