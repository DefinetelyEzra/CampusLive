import { Router } from 'express';
import { EventController } from '../controllers/event.controller.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { singleEventAttendance, canManageAttendance } from '../middleware/event-posting.middleware.js';
import { canManageEvents } from '../middleware/event.middleware.js';
import { createEventSchema, updateEventSchema } from '../utils/validation.js';
import { requireRoleType } from '../middleware/role.middleware.js';
import { RoleType } from '@prisma/client';

const router = Router();

// Public routes
router.get('/', EventController.getAllEvents);
router.get('/:id', EventController.getEventById);
router.get('/:id/attendees', EventController.getEventAttendees);

// Protected routes
router.use(authenticateToken);

// Event creation and management (Faculty/Admin OR Moderators)
router.post('/',
  canManageEvents,
  validateRequest(createEventSchema),
  EventController.createEvent
);

router.patch('/:id/toggle-live',
  canManageEvents,
  EventController.toggleEventLive
);

router.patch('/:id/end',
  canManageEvents,
  EventController.endEvent
);

router.patch('/:id',
  canManageEvents,
  validateRequest(updateEventSchema),
  EventController.updateEvent
);

router.delete('/:id',
  canManageEvents,
  EventController.deleteEvent
);

// Attendance management
router.post('/:id/join',
  singleEventAttendance,
  EventController.joinEvent
);

router.post('/:id/update-location',
  EventController.updateUserLocation
);

router.post('/:id/set-bounds',
  requireRoleType([RoleType.MODERATOR]),
  EventController.setEventLocationBounds
);

router.post('/:id/leave',
  canManageAttendance,
  EventController.leaveEvent
);

router.get('/my/attendance', EventController.getMyAttendance);
router.get('/my/attendances', EventController.getMyAttendances);

export default router;