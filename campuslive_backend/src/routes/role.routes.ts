import { Router } from 'express';
import { RoleController } from '../controllers/role.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';
import { createUserBasedLimiter } from '../middleware/security.middleware.js';

const router = Router();

// Admin routes - generate moderator tokens
router.post('/moderator-tokens',
    authenticateToken,
    requireRole(['ADMIN']),
    createUserBasedLimiter(5), // 5 requests per 15 minutes
    RoleController.generateModeratorTokens
);

// User role registration
router.post('/register',
    authenticateToken,
    createUserBasedLimiter(10), // 10 role registrations per 15 minutes
    RoleController.registerRole
);

router.get('/current',
    authenticateToken,
    RoleController.getCurrentRole
);

// Deregister from role
router.delete('/deregister',
    authenticateToken,
    createUserBasedLimiter(5), // 5 deregistrations per 15 minutes
    RoleController.deregisterRole
);

// Get user's active roles
router.get('/my-roles',
    authenticateToken,
    RoleController.getMyRoles
);

export default router;