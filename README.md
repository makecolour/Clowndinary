# Clowndinary - Cloudinary Image Upload Manager

A web application built with Express.js that allows users to manage their Cloudinary credentials and upload images to their Cloudinary account.

## Features

- **User Authentication**: Secure login using Cloudinary API credentials (Cloud Name, API Key, API Secret)
- **Credential Management**: Store and retrieve Cloudinary credentials securely in MySQL database
- **Multiple Image Upload**: Upload up to 10 images at once
- **Image Gallery**: View uploaded images grouped by date with sorting
- **Responsive Design**: Modern Bootstrap-based UI
- **Session Management**: Secure session-based authentication

## Prerequisites

- Node.js (v14 or higher)
- MySQL database
- Cloudinary account

## Installation
[new_code]
1. Clone the repository:
```bash
git clone <repository-url>
cd Clowndinary
```
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password

4. Start the application:
```bash
npm start
```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

### First Time Setup

1. **Register**: Go to `/register` and enter your Cloudinary credentials:
   - Cloud Name: Your Cloudinary cloud name
   - API Key: Your Cloudinary API key
   - API Secret: Your Cloudinary API secret

2. **Login**: Use the same credentials to log in

### Uploading Images

1. Navigate to the Dashboard after login
2. Click "Upload Images"

### Database Schema
- `id`: Primary key
- `api_name`: Cloudinary cloud name (unique)

#### uploads
- `cloudinary_url`: Cloudinary URL
- `cloudinary_secure_url`: Cloudinary HTTPS URL
## Security Features

- `GET /` - Home page (redirects to login/dashboard)
- `GET /login` - Login page
- `POST /login` - Authenticate user
- `GET /register` - Registration page
- `POST /register` - Register new credentials
- `GET /dashboard` - User dashboard with uploads
- `GET /upload` - Upload page
- `POST /upload` - Handle image uploads
- `POST /logout` - Logout user

## Technologies Used

- **Backend**: Express.js, Node.js
- **Database**: MySQL with mysql2
- **File Upload**: Multer
- **Image Storage**: Cloudinary
- **Authentication**: bcrypt, express-session
- **Frontend**: EJS templates, Bootstrap 5, Font Awesome
- **Styling**: Custom CSS with Bootstrap

## License

This project is licensed under the MIT License.