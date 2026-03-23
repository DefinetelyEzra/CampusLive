import { Router } from 'express';
import { LocationController } from '../controllers/location.controller.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';
import { createLocationSchema } from '../utils/validation.js';

const router = Router();

// Public routes
router.get('/', LocationController.getAllLocations);
router.get('/:id', LocationController.getLocationById);

// Protected routes
router.use(authenticateToken); // All routes below require authentication

router.post('/', 
  requireRole(['FACULTY', 'ADMIN']), 
  validateRequest(createLocationSchema), 
  LocationController.createLocation
);

router.put('/:id', 
  requireRole(['FACULTY', 'ADMIN']), 
  validateRequest(createLocationSchema), 
  LocationController.updateLocation
);

router.delete('/:id', 
  requireRole(['ADMIN']), 
  LocationController.deleteLocation
);

export default router;