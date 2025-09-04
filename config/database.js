const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'clowndinary',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Initialize database tables
async function initializeDatabase() {
  let connection;
  try {
    // First, create a connection without specifying database to create the database
    const tempConfig = { ...dbConfig };
    delete tempConfig.database;
    const tempPool = mysql.createPool(tempConfig);
    connection = await tempPool.getConnection();
    
    // Create database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
    connection.release();
    await tempPool.end();
    
    // Now connect to the specific database
    connection = await pool.getConnection();
    
    // Create cloudinary_configs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS cloudinary_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        api_name VARCHAR(255) UNIQUE NOT NULL,
        api_key VARCHAR(255) NOT NULL,
        api_secret VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Create upload_batches table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS upload_batches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_id INT NOT NULL,
        batch_name VARCHAR(255),
        total_files INT DEFAULT 0,
        total_size INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (config_id) REFERENCES cloudinary_configs(id) ON DELETE CASCADE,
        INDEX idx_config_created (config_id, created_at DESC)
      )
    `);
    
    // Create uploads table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS uploads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        batch_id INT NOT NULL,
        config_id INT NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        cloudinary_public_id VARCHAR(255),
        cloudinary_url TEXT,
        cloudinary_secure_url TEXT,
        bunny_url TEXT,
        file_size INT,
        width INT,
        height INT,
        format VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES upload_batches(id) ON DELETE CASCADE,
        FOREIGN KEY (config_id) REFERENCES cloudinary_configs(id) ON DELETE CASCADE,
        INDEX idx_batch_created (batch_id, created_at DESC),
        INDEX idx_config_updated (config_id, updated_at DESC)
      )
    `);
    
    // Create bunny_configs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bunny_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cloudinary_config_id INT NOT NULL,
        storage_zone VARCHAR(255) NOT NULL,
        api_key TEXT NOT NULL,
        region VARCHAR(10) DEFAULT 'de',
        pull_zone VARCHAR(255),
        root_folder VARCHAR(255),
        ftp_password TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (cloudinary_config_id) REFERENCES cloudinary_configs(id) ON DELETE CASCADE,
        UNIQUE KEY unique_cloudinary_config (cloudinary_config_id)
      )
    `);
    
    // Create sync_jobs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sync_jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cloudinary_config_id INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status ENUM('pending', 'running', 'completed', 'completed_with_errors', 'failed') DEFAULT 'pending',
        total_files INT DEFAULT 0,
        synced_files INT DEFAULT 0,
        failed_files INT DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (cloudinary_config_id) REFERENCES cloudinary_configs(id) ON DELETE CASCADE,
        INDEX idx_config_status (cloudinary_config_id, status),
        INDEX idx_created_at (created_at DESC)
      )
    `);
    
    // Create sync_logs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sync_job_id INT NOT NULL,
        upload_id INT NOT NULL,
        status ENUM('success', 'failed') NOT NULL,
        bunny_url TEXT,
        error_message TEXT,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sync_job_id) REFERENCES sync_jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE,
        INDEX idx_job_status (sync_job_id, status)
      )
    `);
    
    connection.release();
    console.log('Database initialized successfully');
  } catch (error) {
    if (connection) {
      connection.release();
    }
    console.error('Error initializing database:', error);
    throw error;
  }
}

module.exports = {
  pool,
  initializeDatabase
};