const cloudinary = require('cloudinary').v2;

class CloudinaryService {
  static configureCloudinary(apiName, apiKey, apiSecret) {
    cloudinary.config({
      cloud_name: apiName,
      api_key: apiKey,
      api_secret: apiSecret
    });
  }

  static async uploadImage(buffer, originalName, options = {}) {
    try {
      return new Promise((resolve, reject) => {
        const uploadOptions = {
          folder: options.folder || 'clowndinary-uploads',
          public_id: options.public_id || undefined,
          resource_type: 'auto',
          ...options
        };

        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        ).end(buffer);
      });
    } catch (error) {
      throw error;
    }
  }

  static async uploadMultipleImages(files, options = {}) {
    try {
      const uploadPromises = files.map(file => 
        this.uploadImage(file.buffer, file.originalname, {
          ...options,
          public_id: `${Date.now()}_${file.originalname.split('.')[0]}`
        })
      );

      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      throw error;
    }
  }

  static async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CloudinaryService;