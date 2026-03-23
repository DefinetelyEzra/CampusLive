import { Router } from 'express';
import { AdminControllerWithAuth } from '../controllers/admin.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';
import { createUserBasedLimiter } from '../middleware/security.middleware.js';

const router = Router();

// Apply admin authentication to all routes
router.use(authenticateToken);
router.use(requireRole(['ADMIN']));
router.use(createUserBasedLimiter(100));

// User management
router.get('/users', AdminControllerWithAuth.getAllUsers);
router.get('/users/:userId/activity', AdminControllerWithAuth.getUserActivity);

// Moderator token management
router.get('/moderator-tokens', AdminControllerWithAuth.getAllModeratorTokens);
router.delete('/moderator-tokens/:tokenId', AdminControllerWithAuth.deleteModeratorToken);

// Active moderators
router.get('/active-moderators', AdminControllerWithAuth.getActiveModerators);
router.delete('/users/:userId/roles/:roleType', AdminControllerWithAuth.revokeUserRole);

// System statistics
router.get('/stats', AdminControllerWithAuth.getSystemStats);

// Event analytics
router.get('/events/:eventId/analytics', AdminControllerWithAuth.getEventAnalytics);

export default router;