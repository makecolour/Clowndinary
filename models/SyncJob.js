const { pool } = require('../config/database');

class SyncJob {
  static async create(configId, startDate, endDate, status = 'pending') {
    try {
      const [result] = await pool.execute(
        `INSERT INTO sync_jobs (cloudinary_config_id, start_date, end_date, status, created_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [configId, startDate, endDate, status]
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  static async updateStatus(jobId, status, totalFiles = null, syncedFiles = null, failedFiles = null, errorMessage = null) {
    try {
      const [result] = await pool.execute(
        `UPDATE sync_jobs SET 
         status = ?, 
         total_files = COALESCE(?, total_files),
         synced_files = COALESCE(?, synced_files),
         failed_files = COALESCE(?, failed_files),
         error_message = ?,
         updated_at = NOW()
         WHERE id = ?`,
        [status, totalFiles, syncedFiles, failedFiles, errorMessage, jobId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  static async findByConfigId(configId, limit = 10) {
    try {
      // Ensure limit is an integer
      const limitInt = parseInt(limit, 10);
      const [rows] = await pool.execute(
        `SELECT * FROM sync_jobs 
         WHERE cloudinary_config_id = ? 
         ORDER BY created_at DESC 
         LIMIT ${limitInt}`,
        [configId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async findById(jobId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM sync_jobs WHERE id = ?',
        [jobId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async getActiveJobs(configId) {
    try {
      const [rows] = await pool.execute(
        `SELECT * FROM sync_jobs 
         WHERE cloudinary_config_id = ? AND status IN ('pending', 'running')
         ORDER BY created_at DESC`,
        [configId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async createSyncLog(jobId, uploadId, status, bunnyUrl = null, errorMessage = null) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO sync_logs (sync_job_id, upload_id, status, bunny_url, error_message, synced_at) 
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [jobId, uploadId, status, bunnyUrl, errorMessage]
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  static async getSyncLogs(jobId) {
    try {
      const [rows] = await pool.execute(
        `SELECT sl.*, u.original_name, u.cloudinary_public_id 
         FROM sync_logs sl
         JOIN uploads u ON sl.upload_id = u.id
         WHERE sl.sync_job_id = ?
         ORDER BY sl.synced_at DESC`,
        [jobId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = SyncJob;
