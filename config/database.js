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
        cloudinary_public_id VARCHAR(255) NOT NULL,
        cloudinary_url TEXT NOT NULL,
        cloudinary_secure_url TEXT NOT NULL,
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