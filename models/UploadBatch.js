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
      throw error;
    }
  }

  static async findByConfigIdGroupedByDate(configId) {
    try {
      const [rows] = await pool.execute(
        `SELECT 
           DATE(ub.created_at) as upload_date,
           COUNT(DISTINCT ub.id) as batch_count,
           COUNT(u.id) as total_uploads,
           SUM(u.file_size) as total_size,
           JSON_ARRAYAGG(
             JSON_OBJECT(
               'batch_id', ub.id,
               'batch_name', ub.batch_name,
               'batch_created_at', ub.created_at,
               'upload_count', (SELECT COUNT(*) FROM uploads WHERE batch_id = ub.id),
               'batch_size', (SELECT SUM(file_size) FROM uploads WHERE batch_id = ub.id),
               'uploads', (
                 SELECT JSON_ARRAYAGG(
                   JSON_OBJECT(
                     'id', id,
                     'original_name', original_name,
                     'cloudinary_url', cloudinary_url,
                     'cloudinary_secure_url', cloudinary_secure_url,
                     'file_size', file_size,
                     'width', width,
                     'height', height,
                     'format', format,
                     'created_at', created_at
                   )
                 ) FROM uploads WHERE batch_id = ub.id
               )
             )
           ) as batches
         FROM upload_batches ub
         LEFT JOIN uploads u ON ub.id = u.batch_id
         WHERE ub.config_id = ?
         GROUP BY DATE(ub.created_at)
         ORDER BY upload_date DESC`,
        [configId]
      );
      
      return rows.map(row => ({
        ...row,
        batches: row.batches || []
      }));
    } catch (error) {
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
      throw error;
    }
  }
}

module.exports = UploadBatch;
