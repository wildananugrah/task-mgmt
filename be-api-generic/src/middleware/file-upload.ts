import multer from 'multer';
import config from '../config';

// Parse allowed file types from config
const allowedMimeTypes = config.ALLOWED_FILE_TYPES.split(',').map(type => type.trim());

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check if file type is allowed
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`));
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.MAX_FILE_SIZE, // Max file size in bytes
    files: 10, // Maximum number of files
  },
});

// Middleware for single file upload
export const uploadSingle = (fieldName: string = 'file') => upload.single(fieldName);

// Middleware for multiple file upload
export const uploadMultiple = (fieldName: string = 'files', maxCount: number = 10) =>
  upload.array(fieldName, maxCount);

// Middleware for fields with different file inputs
export const uploadFields = (fields: multer.Field[]) => upload.fields(fields);

// Helper function to validate file size
export function validateFileSize(file: Express.Multer.File): boolean {
  return file.size <= config.MAX_FILE_SIZE;
}

// Helper function to validate file type
export function validateFileType(file: Express.Multer.File): boolean {
  return allowedMimeTypes.includes(file.mimetype);
}

// Error handler for multer errors
export function handleMulterError(error: any): { message: string; code: string } {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return {
          message: `File too large. Maximum size is ${config.MAX_FILE_SIZE / 1024 / 1024}MB`,
          code: 'FILE_TOO_LARGE',
        };
      case 'LIMIT_FILE_COUNT':
        return {
          message: 'Too many files uploaded',
          code: 'TOO_MANY_FILES',
        };
      case 'LIMIT_UNEXPECTED_FILE':
        return {
          message: 'Unexpected file field',
          code: 'UNEXPECTED_FIELD',
        };
      default:
        return {
          message: error.message,
          code: error.code,
        };
    }
  }

  return {
    message: error.message || 'File upload failed',
    code: 'UPLOAD_ERROR',
  };
}