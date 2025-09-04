# Clowndinary - Cloudinary Image Upload Manager

A sophisticated web application built with Express.js that allows users to manage their Cloudinary credentials and upload images with advanced batch organization and export capabilities. Now featuring high-performance clustering for efficient multi-core utilization.

## Features

- **High-Performance Clustering**: Built-in Node.js clustering and PM2 support for multi-core utilization
- **Scalable Architecture**: Automatic load balancing across multiple worker processes
- **Zero-Downtime Deployments**: Graceful worker restarts without service interruption
- **Bunny CDN Integration**: Complete sync functionality with BunnyCDN storage for global content delivery
- **Advanced Sync Management**: Batch processing, retry logic, and progress tracking for reliable transfers
- **Multi-Region Support**: BunnyCDN storage across multiple global regions (DE, NY, LA, SG, UK, SE, BR, JH, SYD)
- **Secure Authentication**: Login using Cloudinary API credentials (Cloud Name, API Key, API Secret) with credential validation
- **Credential Management**: Store and retrieve Cloudinary credentials securely with AES encryption in MySQL database
- **Unlimited Image Upload**: Upload multiple images at once with no file size or count restrictions
- **Batch Organization**: Uploads are automatically grouped into batches by date and time
- **Image Gallery**: View uploaded images organized by batches with date grouping
- **CSV Export**: Export batch metadata to CSV files for record keeping
- **Copy to Clipboard**: One-click copy image URLs to clipboard
- **Modern Frontend**: Built with jQuery, AngularJS, and Toastr.js for rich user experience
- **Responsive Design**: Bootstrap 5-based UI with custom styling
- **Session Management**: Secure MySQL-based session storage

## Prerequisites

- Node.js (v14 or higher)
- MySQL database (v5.7 or higher)
- Cloudinary account with valid API credentials
- BunnyCDN account (optional, for sync functionality)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/makecolour/Clowndinary.git
cd Clowndinary
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=clowndinary
SESSION_SECRET=your_session_secret_key
```

4. Start the application:

**Option 1: Clustered Mode (Recommended)**
```bash
npm start
```
This automatically utilizes all CPU cores for optimal performance.

**Option 2: Single Process Mode (Development)**
```bash
npm run start:single
```

**Option 3: PM2 Production Mode (Advanced)**
```bash
# Install PM2 globally
npm install -g pm2

# Start in production with PM2
npm run pm2:start:prod
```

5. Open your browser and navigate to `http://localhost:3000`

The application will automatically create the required database and tables on first run.

## Deployment & Performance

### Clustering Options

Clowndinary supports multiple deployment modes for optimal performance:

1. **Built-in Clustering (Default)**
   - Automatically spawns worker processes (one per CPU core)
   - Fault-tolerant with automatic worker restart
   - Zero-downtime graceful shutdowns
   ```bash
   npm start                    # Production clustering
   npm run start:dev           # Development clustering
   npm run start:single        # Single process mode
   ```

2. **PM2 Process Management (Recommended for Production)**
   - Advanced process management with monitoring
   - Memory usage limits and automatic restarts
   - Built-in load balancing and log management
   ```bash
   npm install -g pm2
   npm run pm2:start           # Development mode
   npm run pm2:start:prod      # Production mode
   npm run pm2:monitor         # View real-time monitoring
   npm run pm2:logs            # View application logs
   ```

### Environment Variables

Configure the application behavior with these environment variables:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=clowndinary

# Application Security
SESSION_SECRET=your_session_secret_key

# Performance Tuning
NODE_CLUSTERS=4              # Override number of worker processes
NODE_ENV=production          # Set environment mode
PORT=3000                    # Application port
```

### Performance Benefits

- **Multi-core Utilization**: Uses all available CPU cores by default
- **Improved Throughput**: Handles 3-5x more concurrent requests
- **Fault Tolerance**: Individual worker failures don't affect other processes
- **Load Distribution**: Automatic request distribution across workers
- **Memory Efficiency**: Each worker process has isolated memory space

## Usage

### Registration & Authentication

1. **Register**: Go to `/register` and enter your Cloudinary credentials:
   - Cloud Name: Your Cloudinary cloud name
   - API Key: Your Cloudinary API key  
   - API Secret: Your Cloudinary API secret
   
   The system validates credentials with Cloudinary API before registration.

2. **Login**: Use the same Cloudinary credentials to authenticate

### Image Upload & Management

1. **Upload Images**: 
   - Navigate to the Dashboard after login
   - Click "Upload Images" 
   - Select multiple images (no size or count limits)
   - Images are automatically organized into upload batches

2. **View & Manage**:
   - Dashboard displays images grouped by date and batch
   - Each image has a copy URL button
   - Batch-level CSV export for metadata

3. **Export Data**:
   - Click "Export CSV" for any batch to download upload metadata
   - CSV includes image URLs, upload timestamps, and batch information

### BunnyCDN Sync & Global Distribution

1. **Configure BunnyCDN Storage**:
   - Navigate to "Sync to Bunny" from the dashboard
   - Enter your BunnyCDN storage zone details:
     - Storage Zone Name
     - API Key
     - Region (DE, NY, LA, SG, UK, SE, BR, JH, SYD)
     - Pull Zone URL (optional, for public URLs)
     - Root Folder (optional, for organization)
     - FTP Password (optional, for advanced features)

2. **Sync Images**:
   - Select date range for images to sync from Cloudinary
   - Configure sync parameters:
     - Batch Size: Number of files processed simultaneously (1-10)
     - Download Retries: Retry attempts for failed downloads (1-5)
     - Upload Retries: Retry attempts for failed uploads (1-5)
     - Download Timeout: Timeout for each download (10-120 seconds)
   - Monitor real-time progress with detailed logging

3. **Sync Features**:
   - **Fault Tolerance**: Automatic retry logic with exponential backoff
   - **Progress Tracking**: Real-time sync progress and detailed logs
   - **Error Categorization**: Network, timeout, client, and server error classification
   - **Public URL Generation**: Automatic CDN URL generation for synchronized files
   - **Multi-Region Support**: Deploy content across global edge locations

## Database Schema

### cloudinary_configs
- `id`: Primary key (auto-increment)
- `api_name`: Cloudinary cloud name (unique identifier)
- `api_key`: Cloudinary API key
- `api_secret`: Encrypted Cloudinary API secret
- `created_at`: Registration timestamp
- `updated_at`: Last update timestamp

### upload_batches  
- `id`: Primary key (auto-increment)
- `config_id`: Foreign key to cloudinary_configs
- `batch_date`: Date of the upload batch
- `created_at`: Batch creation timestamp

### uploads
- `id`: Primary key (auto-increment)
- `config_id`: Foreign key to cloudinary_configs  
- `batch_id`: Foreign key to upload_batches
- `original_filename`: Original file name
- `cloudinary_public_id`: Cloudinary public ID
- `cloudinary_url`: Cloudinary HTTP URL
- `cloudinary_secure_url`: Cloudinary HTTPS URL
- `uploaded_at`: Upload timestamp

### bunny_configs
- `id`: Primary key (auto-increment)
- `cloudinary_config_id`: Foreign key to cloudinary_configs
- `storage_zone`: BunnyCDN storage zone name
- `api_key`: Encrypted BunnyCDN API key
- `region`: BunnyCDN storage region
- `pull_zone`: BunnyCDN pull zone URL for public access
- `root_folder`: Root folder path in Bunny storage
- `ftp_password`: Encrypted FTP password (optional)
- `created_at`: Configuration creation timestamp
- `updated_at`: Last update timestamp

### sync_jobs
- `id`: Primary key (auto-increment)
- `cloudinary_config_id`: Foreign key to cloudinary_configs
- `start_date`: Sync start date range
- `end_date`: Sync end date range
- `status`: Job status (pending, running, completed, failed, completed_with_errors)
- `total_files`: Total number of files to sync
- `synced_files`: Successfully synced files count
- `failed_files`: Failed sync attempts count
- `error_message`: Error details if job failed
- `created_at`: Job creation timestamp
- `updated_at`: Last status update timestamp

### sync_logs
- `id`: Primary key (auto-increment)
- `sync_job_id`: Foreign key to sync_jobs
- `upload_id`: Foreign key to uploads
- `status`: Sync status for individual file (success, failed)
- `bunny_url`: BunnyCDN URL after successful sync
- `error_message`: Error details for failed syncs
- `synced_at`: Sync attempt timestamp

## API Routes

### Main Application Routes
- `GET /` - Home page (redirects based on authentication)
- `GET /login` - Login page
- `POST /login` - Authenticate user with Cloudinary credentials
- `GET /register` - Registration page  
- `POST /register` - Register and validate new Cloudinary credentials
- `GET /dashboard` - User dashboard with batch-organized uploads
- `GET /upload` - Upload interface
- `POST /upload` - Handle multiple image uploads with batch creation
- `GET /export-csv/:batchId` - Export batch data to CSV
- `POST /logout` - End user session

### BunnyCDN Sync Routes
- `GET /sync/bunny-config` - BunnyCDN storage configuration page
- `POST /sync/bunny-config` - Save/update BunnyCDN storage configuration
- `GET /sync` - Sync management dashboard with job history
- `POST /sync/start` - Start new sync job with date range and options
- `GET /sync/job/:jobId` - Detailed sync job progress and logs
- `GET /sync/api/job/:jobId/progress` - Real-time sync progress (AJAX endpoint)

## Technologies Used

### Backend
- **Express.js 4.21.2**: Web application framework with clustering support
- **MySQL2 3.14.3**: Database connectivity with connection pooling
- **Cloudinary 2.7.0**: Image storage and management
- **BunnyCDN Storage**: Global CDN integration with multi-region support
- **Multer**: File upload handling (unlimited configuration)
- **Express-session**: Session management with MySQL store
- **Crypto-js**: AES encryption for API secrets and BunnyCDN credentials
- **Cluster**: Built-in Node.js clustering for multi-core utilization
- **PM2**: Advanced process management (optional)
- **Node-fetch**: HTTP client for API communications and file transfers

### Frontend  
- **EJS**: Server-side templating engine
- **Bootstrap 5.1.3**: Responsive CSS framework
- **jQuery 3.7.1**: DOM manipulation and AJAX
- **AngularJS 1.8.2**: Dynamic frontend framework
- **Toastr.js**: User notification system
- **Font Awesome**: Icon library

### Security & Utilities
- **Bcrypt**: Password hashing (minimal usage)
- **Cookie-parser**: Cookie handling middleware
- **Morgan**: HTTP request logging
- **Dotenv**: Environment variable management

## Security Features

- **Credential Encryption**: API secrets and BunnyCDN credentials stored with AES encryption
- **Session Security**: MySQL-based session storage with secure cookies
- **Input Validation**: Server-side validation of Cloudinary and BunnyCDN credentials
- **Authentication Middleware**: Route protection for authenticated users only
- **Cross-Platform Compatibility**: Secure file transfers across different CDN providers
- **Environment Variables**: Sensitive configuration isolated in .env files
- **API Rate Limiting**: Built-in delays and retry logic to respect service limits

## Project Structure

```
Clowndinary/
├── app.js                 # Main application entry point
├── package.json           # Dependencies and scripts
├── README.md             # Project documentation
├── CLUSTERING.md         # Detailed clustering documentation
├── ecosystem.config.json # PM2 configuration
├── bin/
│   ├── www               # Clustered server startup script
│   └── www-single        # Single process startup script
├── config/
│   ├── database.js       # MySQL connection and initialization
│   └── cluster.js        # Clustering configuration
├── logs/                 # Application logs (PM2)
├── middleware/
│   ├── auth.js           # Authentication middleware
│   └── upload.js         # Multer upload configuration
├── models/
│   ├── BunnyConfig.js     # BunnyCDN storage configuration
│   ├── CloudinaryConfig.js  # User credential management
│   ├── SyncJob.js        # Sync job management and tracking
│   ├── Upload.js         # Individual upload records
│   └── UploadBatch.js    # Batch organization logic
├── public/
│   ├── images/           # Static image assets (favicon)
│   ├── javascripts/      # Client-side JavaScript
│   └── stylesheets/
│       └── style.css     # Custom styling
├── routes/
│   ├── index.js          # Main application routes
│   ├── sync.js           # BunnyCDN sync routes and management
│   └── users.js          # User-related routes (unused)
├── services/
│   ├── bunnyStorageService.js  # BunnyCDN API integration
│   ├── cloudinaryService.js   # Cloudinary API integration
│   └── syncService.js    # Sync orchestration and management
└── views/
    ├── bunny-config.ejs  # BunnyCDN storage configuration
    ├── dashboard.ejs     # Main dashboard with upload batches
    ├── error.ejs         # Error page template
    ├── index.ejs         # Landing page
    ├── login.ejs         # User authentication
    ├── register.ejs      # User registration
    ├── sync.ejs          # Sync management dashboard
    ├── sync-job-details.ejs  # Detailed sync job progress
    └── upload.ejs        # Upload interface
```

## Development Notes

- **High-Performance Architecture**: Built-in clustering utilizes all CPU cores for maximum throughput
- **Production Ready**: PM2 configuration included for enterprise deployments
- **Global CDN Integration**: BunnyCDN sync enables worldwide content distribution
- **Intelligent Sync Logic**: Advanced retry mechanisms with exponential backoff and error categorization
- **Unlimited Uploads**: File size and count restrictions removed for maximum flexibility
- **Batch System**: Each upload session creates a new batch for better organization
- **Error Handling**: Comprehensive error handling with user-friendly messages and detailed logging
- **Modern Libraries**: Uses latest stable versions of jQuery, AngularJS, and Bootstrap
- **Session Persistence**: Explicit session saving ensures reliable authentication state
- **Monitoring**: Built-in process monitoring and logging capabilities
- **Multi-Region Support**: Deploy content across 9 global BunnyCDN regions

## Performance Considerations

- **Clustering**: Automatically scales to use all available CPU cores
- **Memory Management**: Each worker process has isolated memory space
- **Load Balancing**: Built-in request distribution across worker processes
- **Fault Tolerance**: Individual worker failures don't affect overall application
- **Graceful Shutdowns**: Zero-downtime deployments and restarts
- **CDN Optimization**: Intelligent sync batching and retry logic for reliable transfers
- **Network Resilience**: Timeout management and exponential backoff for API calls

## BunnyCDN Integration Benefits

- **Global Edge Network**: Deploy content across 9 worldwide regions
- **Cost-Effective**: Significantly lower bandwidth costs compared to traditional CDNs
- **High Performance**: Ultra-fast content delivery with 99.9% uptime
- **Real-time Sync**: Live progress tracking with detailed error reporting
- **Flexible Configuration**: Customizable batch sizes, retry attempts, and timeouts
- **Public URL Generation**: Automatic CDN URL creation for synchronized content

For detailed clustering configuration and deployment options, see [CLUSTERING.md](CLUSTERING.md).

## License

This project is licensed under the MIT License. See the LICENSE file for details.