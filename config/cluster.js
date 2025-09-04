/**
 * Cluster configuration for Clowndinary
 */

const os = require('os');

module.exports = {
  // Number of worker processes to spawn
  // Can be overridden by NODE_CLUSTERS environment variable
  workers: process.env.NODE_CLUSTERS || os.cpus().length,
  
  // Restart workers if they crash
  autoRestart: true,
  
  // Graceful shutdown timeout (ms)
  shutdownTimeout: 30000,
  
  // Worker restart delay (ms)
  restartDelay: 1000,
  
  // Maximum restart attempts
  maxRestarts: 10,
  
  // Enable cluster logging
  logging: true
};
