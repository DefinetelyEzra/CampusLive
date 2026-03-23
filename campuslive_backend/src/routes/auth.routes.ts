import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { authenticateToken, requireRole, restrictAdminCreationForPublic } from '../middleware/auth.middleware.js';
import { registerSchema, loginSchema } from '../utils/validation.js';

const router = Router();

router.post('/register', restrictAdminCreationForPublic, validateRequest(registerSchema), AuthController.register);
router.post('/login', validateRequest(loginSchema), AuthController.login);
router.get('/profile', authenticateToken, AuthController.getProfile);
router.delete('/delete/:id', authenticateToken, requireRole(['ADMIN']), AuthController.deleteUser);

export default router;