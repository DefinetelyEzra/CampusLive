import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/mpeg'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'));
  }
};

// Rate limiting map for uploads
const uploadAttempts = new Map<string, { count: number; resetTime: number }>();
const UPLOAD_RATE_LIMIT = 10; // Max uploads per window
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of uploadAttempts.entries()) {
    if (now > value.resetTime) {
      uploadAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const checkUploadRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    return sendError(res, 'Authentication required', undefined, 401);
  }

  const now = Date.now();
  const userAttempts = uploadAttempts.get(userId);

  if (!userAttempts || now > userAttempts.resetTime) {
    uploadAttempts.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  if (userAttempts.count >= UPLOAD_RATE_LIMIT) {
    return sendError(
      res,
      'Upload rate limit exceeded',
      `Maximum ${UPLOAD_RATE_LIMIT} uploads per minute allowed`,
      429
    );
  }

  userAttempts.count++;
  next();
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB (increased for video)
    files: 1,
  },
});

// Error handler for multer
export const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'File too large', 'Maximum file size is 50MB', 413);
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return sendError(res, 'Too many files', 'Only one file allowed per upload', 400);
    }
    logger.error('Multer error:', err);
    return sendError(res, 'File upload error', err.message, 400);
  }

  if (err) {
    logger.error('Upload error:', err);
    return sendError(res, 'Upload failed', err.message, 400);
  }

  next();
};