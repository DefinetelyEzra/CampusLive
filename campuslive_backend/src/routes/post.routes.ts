import { Router } from 'express';
import { PostController } from '../controllers/post.controller.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { upload, checkUploadRateLimit, handleMulterError } from '../middleware/upload.middleware.js';
import { createPostSchema } from '../utils/validation.js';
import { sanitizeMediaContent } from '../middleware/sanitization.middleware.js';

const router = Router();

// Public routes
router.get('/location/:locationId', PostController.getPostsByLocation);
router.get('/event/:eventId', PostController.getPostsByEvent);

// Protected routes
router.use(authenticateToken); // All routes below require authentication

router.post(
  '/',
  authenticateToken,
  checkUploadRateLimit,
  upload.single('media'),
  validateRequest(createPostSchema),
  handleMulterError,
  sanitizeMediaContent,
  PostController.createPost
);

// Get posts user can access based on attendance
router.get('/my/accessible', PostController.getMyAccessiblePosts);

// Delete post (with attendance checks)
router.delete('/:id', PostController.deletePost);

export default router;