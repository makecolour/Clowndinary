# Clowndinary - Cloudinary Image Upload Manager

A sophisticated web application built with Express.js that allows users to manage their Cloudinary credentials and upload images with advanced batch organization and export capabilities.

## Features

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
```bash
npm start
```

5. Open your browser and navigate to `http://localhost:3000`

The application will automatically create the required database and tables on first run.

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

## API Routes

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

## Technologies Used

### Backend
- **Express.js 4.21.2**: Web application framework
- **MySQL2 3.14.3**: Database connectivity with connection pooling
- **Cloudinary 2.7.0**: Image storage and management
- **Multer**: File upload handling (unlimited configuration)
- **Express-session**: Session management with MySQL store
- **Crypto-js**: AES encryption for API secrets

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

- **Credential Encryption**: API secrets stored with AES encryption, not hashing
- **Session Security**: MySQL-based session storage with secure cookies
- **Input Validation**: Server-side validation of Cloudinary credentials
- **Authentication Middleware**: Route protection for authenticated users only
- **Environment Variables**: Sensitive configuration isolated in .env files

## Project Structure

```
Clowndinary/
├── app.js                 # Main application entry point
├── package.json           # Dependencies and scripts
├── README.md             # Project documentation
├── bin/
│   └── www               # Server startup script
├── config/
│   └── database.js       # MySQL connection and initialization
├── middleware/
│   ├── auth.js           # Authentication middleware
│   └── upload.js         # Multer upload configuration
├── models/
│   ├── CloudinaryConfig.js  # User credential management
│   ├── Upload.js         # Individual upload records
│   └── UploadBatch.js    # Batch organization logic
├── public/
│   ├── images/           # Static image assets (favicon)
│   ├── javascripts/      # Client-side JavaScript
│   └── stylesheets/
│       └── style.css     # Custom styling
├── routes/
│   ├── index.js          # Main application routes
│   └── users.js          # User-related routes (unused)
├── services/
│   └── cloudinaryService.js  # Cloudinary API integration
└── views/
    ├── edit-config.ejs   # Configuration editing
    ├── error.ejs         # Error page template
    ├── index.ejs         # Landing page
    ├── upload.ejs        # Upload interface
    └── uploads.ejs       # Dashboard with batch display
```

## Development Notes

- **Unlimited Uploads**: File size and count restrictions removed for maximum flexibility
- **Batch System**: Each upload session creates a new batch for better organization
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Modern Libraries**: Uses latest stable versions of jQuery, AngularJS, and Bootstrap
- **Session Persistence**: Explicit session saving ensures reliable authentication state

## License

This project is licensed under the MIT License. See the LICENSE file for details.