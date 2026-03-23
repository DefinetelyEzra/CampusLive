import { Request, Response, NextFunction } from 'express';
import { EventService } from '../services/event.service.js';
import { AttendanceService } from '../services/attendance.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { io } from '../server.js';
import { forceEndEventAttendance, notifyEventStatusChange } from '../socket/attendanceHandler.js';
import { AuthenticatedUser } from '../types/index.js';
import { GeolocationService } from '../services/geolocation.service.js';
import { ParticipantRole, RoleType } from '@prisma/client';
import prisma from '../config/database.js';
import { RoleManagementService } from '../services/roleManagement.service.js';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// Authentication middleware
const ensureAuthenticated = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.id) {
    return sendError(res, 'Authentication required', undefined, 401);
  }
  next();
};

// Error handling helper
const handleControllerError = (res: Response, next: NextFunction, error: unknown, defaultMessage: string) => {
  logger.error(`${defaultMessage} error:`, error);

  if (error instanceof Error) {
    let statusCode = 500;
    if (error.message.includes('not found')) {
      statusCode = 404;
    } else if (error.message.includes('Unauthorized')) {
      statusCode = 403;
    } else if (error.message.includes('Cannot delete') || error.message.includes('Failed to join')) {
      statusCode = 400;
    }
    return sendError(res, defaultMessage, error.message, statusCode);
  }
  next(error);
};

// Socket notification helper
const broadcastEventUpdate = (eventId: string, isLive: boolean, event: any) => {
  io.emit('eventStatusUpdate', {
    eventId,
    isLive,
    locationId: event.location.id,
    timestamp: new Date().toISOString()
  });
  notifyEventStatusChange(io, eventId, isLive ? 'LIVE' : 'ENDED');
};

export class EventController {
  private static async validateEventAccess(
    event: any,
    accessKey?: string
  ): Promise<{ isValid: boolean; error?: { message: string; details: string; statusCode: number } }> {
    if (!event.isPrivate) {
      return { isValid: true };
    }

    if (!accessKey) {
      return {
        isValid: false,
        error: {
          message: 'Access key required',
          details: 'This is a private event. Please provide the 6-character access key.',
          statusCode: 403
        }
      };
    }

    if (!/^[A-Z0-9]{6}$/.test(accessKey)) {
      return {
        isValid: false,
        error: {
          message: 'Invalid access key format',
          details: 'Access key must be exactly 6 uppercase letters and numbers.',
          statusCode: 400
        }
      };
    }

    if (event.accessKey !== accessKey) {
      return {
        isValid: false,
        error: {
          message: 'Incorrect access key',
          details: 'The access key you entered is incorrect. Please check and try again.',
          statusCode: 403
        }
      };
    }

    return { isValid: true };
  }

  private static async validateUserRole(
    userId: string,
    role: RoleType
  ): Promise<{ isValid: boolean; error?: { message: string; details: string; statusCode: number } }> {
    const userAppRole = await RoleManagementService.getUserActiveRoleByType(userId, role);

    if (!userAppRole) {
      return {
        isValid: false,
        error: {
          message: `You must register as a ${role} before joining events with that role`,
          details: 'Please visit the role selection page to register',
          statusCode: 403
        }
      };
    }

    return { isValid: true };
  }

  private static validateEventStatus(
    event: any
  ): { isValid: boolean; error?: { message: string; details: string; statusCode: number } } {
    if (event.status !== 'LIVE' || !event.isLive) {
      return {
        isValid: false,
        error: {
          message: 'Event is not currently live',
          details: 'The event is not in a live state or has ended.',
          statusCode: 403
        }
      };
    }

    return { isValid: true };
  }

  private static validateLocationRequirement(
    role: ParticipantRole,
    location?: { latitude: number; longitude: number }
  ): { isValid: boolean; error?: { message: string; details: string; statusCode: number } } {
    if ((role === ParticipantRole.POSTER || role === ParticipantRole.MODERATOR) && !location) {
      return {
        isValid: false,
        error: {
          message: 'Location is required to join as POSTER or MODERATOR',
          details: 'You must provide latitude and longitude coordinates to join as a POSTER or MODERATOR.',
          statusCode: 400
        }
      };
    }

    return { isValid: true };
  }

  static async createEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await EventService.createEvent(req.body, req.user!.id);

      logger.info(`Event created: ${result.title} by user ${req.user!.id}`);

      // If private event, include access key in response
      if (result.isPrivate && result.accessKey) {
        return sendSuccess(res, 'Private event created successfully', {
          event: result,
          accessKey: result.accessKey,
          message: 'Save this access key. Users will need it to join this private event.'
        }, 201);
      }

      return sendSuccess(res, 'Event created successfully', result, 201);
    } catch (error) {
      handleControllerError(res, next, error, 'Create event failed');
    }
  }

  static async updateEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedEvent = await EventService.updateEvent(id, updateData, req.user!.id);

      logger.info(`Event updated: ${id} by user ${req.user!.id}`);
      return sendSuccess(res, 'Event updated successfully', updatedEvent);
    } catch (error) {
      handleControllerError(res, next, error, 'Update event failed');
    }
  }

  static async getAllEvents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { live } = req.query;
      let isLive: boolean | undefined;
      if (live === 'true') isLive = true;
      else if (live === 'false') isLive = false;

      const events = await EventService.getAllEvents(isLive, req.user?.id);
      return sendSuccess(res, 'Events retrieved successfully', events);
    } catch (error) {
      handleControllerError(res, next, error, 'Get events failed');
    }
  }

  static async getEventById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const event = await EventService.getEventById(id, req.user?.id);
      if (!event) {
        return sendError(res, 'Event not found', undefined, 404);
      }
      return sendSuccess(res, 'Event retrieved successfully', event);
    } catch (error) {
      handleControllerError(res, next, error, 'Get event failed');
    }
  }

  static async toggleEventLive(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { isLive } = req.body;
      const event = await EventService.updateEventStatus(id, isLive, req.user!.id);

      if (!isLive) {
        await forceEndEventAttendance(io, id);
      }

      broadcastEventUpdate(id, isLive, event);

      logger.info(`Event ${isLive ? 'started' : 'stopped'}: ${id}`);
      const message = isLive ? 'Event started successfully' : 'Event stopped successfully';
      return sendSuccess(res, message, event);
    } catch (error) {
      handleControllerError(res, next, error, 'Toggle event live failed');
    }
  }

  static async endEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const event = await EventService.endEvent(id, req.user!.id);

      await forceEndEventAttendance(io, id);
      broadcastEventUpdate(id, false, event);

      logger.info(`Event ended: ${id}`);
      return sendSuccess(res, 'Event ended successfully', event);
    } catch (error) {
      handleControllerError(res, next, error, 'End event failed');
    }
  }

  static async joinEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { role = ParticipantRole.WATCHER, latitude, longitude, accessKey } = req.body;
      const location = latitude && longitude ? { latitude, longitude } : undefined;

      const event = await prisma.event.findUnique({ where: { id } });

      if (!event) {
        return sendError(res, 'Event not found', undefined, 404);
      }

      // Validate access for private events
      const accessValidation = await EventController.validateEventAccess(event, accessKey);
      if (!accessValidation.isValid) {
        const err = accessValidation.error!;
        return sendError(res, err.message, err.details, err.statusCode);
      }

      // Verify user has required role
      const roleValidation = await EventController.validateUserRole(req.user!.id, role as RoleType);
      if (!roleValidation.isValid) {
        const err = roleValidation.error!;
        return sendError(res, err.message, err.details, err.statusCode);
      }

      // Validate event is live
      const statusValidation = EventController.validateEventStatus(event);
      if (!statusValidation.isValid) {
        const err = statusValidation.error!;
        return sendError(res, err.message, err.details, err.statusCode);
      }

      // Validate location requirement
      const locationValidation = EventController.validateLocationRequirement(role, location);
      if (!locationValidation.isValid) {
        const err = locationValidation.error!;
        return sendError(res, err.message, err.details, err.statusCode);
      }

      const attendance = await AttendanceService.joinEvent(req.user!.id, id, role, location);

      // Emit socket event for real-time updates
      io.to(`event:${id}`).emit('user-joined-event', {
        userId: req.user!.id,
        username: req.user!.username,
        role,
        timestamp: new Date()
      });

      // Also join the user to the event room for future socket events
      const userSockets = await io.in(req.user!.id).fetchSockets();
      for (const socket of userSockets) {
        socket.join(`event:${id}`);
      }

      logger.info(`User ${req.user!.id} joined event ${id} as ${role}`);
      return sendSuccess(res, `Successfully joined event as ${role}`, {
        attendance,
        event: attendance.event
      });
    } catch (error) {
      handleControllerError(res, next, error, 'Failed to join event');
    }
  }

  static async updateUserLocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id: eventId } = req.params;
      const { latitude, longitude } = req.body;
      const validation = await GeolocationService.validateUserLocation(eventId, latitude, longitude);

      if (!validation.isWithinBounds) {
        io.to(req.user!.id).emit('location-warning', {
          message: `You are ${Math.round(validation.distance)}m from the event. Return within ${validation.radiusMeters}m or you will be removed.`,
          distance: validation.distance,
          maxDistance: validation.radiusMeters
        });
        return sendError(res, 'Location out of bounds', `Distance: ${Math.round(validation.distance)}m`, 400);
      }

      await GeolocationService.updateUserLocation(eventId, req.user!.id);
      return sendSuccess(res, 'Location updated successfully', {
        distance: validation.distance,
        isWithinBounds: validation.isWithinBounds
      });
    } catch (error) {
      handleControllerError(res, next, error, 'Update location failed');
    }
  }

  static async setEventLocationBounds(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id: eventId } = req.params;
      const { centerLat, centerLng, radiusMeters } = req.body;

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          participants: {
            where: {
              userId: req.user!.id,
              role: ParticipantRole.MODERATOR
            }
          }
        }
      });

      if (!event) {
        return sendError(res, 'Event not found', undefined, 404);
      }

      if (event.organizerId !== req.user!.id && event.participants.length === 0) {
        return sendError(res, 'Only event organizer or moderator can set location bounds', undefined, 403);
      }

      const locationBound = await GeolocationService.setEventLocationBound(
        eventId,
        centerLat,
        centerLng,
        radiusMeters
      );

      logger.info(`Location bounds set for event ${eventId}`);
      return sendSuccess(res, 'Event location bounds updated', locationBound);
    } catch (error) {
      handleControllerError(res, next, error, 'Set location bounds failed');
    }
  }

  static async leaveEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await AttendanceService.leaveEvent(req.user!.id, id);

      io.to(`event:${id}`).emit('user-left-event', {
        userId: req.user!.id,
        username: req.user!.username,
        timestamp: new Date()
      });

      logger.info(`User ${req.user!.id} left event ${id}`);
      return sendSuccess(res, 'Successfully left event');
    } catch (error) {
      handleControllerError(res, next, error, 'Failed to leave event');
    }
  }

  static async getMyAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const attendance = await AttendanceService.getCurrentAttendance(req.user!.id);
      return sendSuccess(res, 'Attendance retrieved successfully', attendance);
    } catch (error) {
      handleControllerError(res, next, error, 'Get attendance failed');
    }
  }

  // Gets attendees OF A SPECIFIC EVENT (public info)
  static async getEventAttendees(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const attendees = await AttendanceService.getEventAttendees(id);

      return sendSuccess(res, 'Attendees retrieved successfully', {
        count: attendees.length,
        attendees: attendees.map(a => ({
          id: a.id,
          joinedAt: a.joinedAt,
          user: a.user
        }))
      });
    } catch (error) {
      handleControllerError(res, next, error, 'Get attendees failed');
    }
  }

  // Gets all events THE CURRENT USER is attending (personal info)
  static async getMyAttendances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const attendances = await AttendanceService.getAllActiveAttendances(req.user!.id);
      return sendSuccess(res, 'Attendances retrieved successfully', attendances);
    } catch (error) {
      handleControllerError(res, next, error, 'Get attendances failed');
    }
  }

  static async deleteEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userRole = req.user!.role;
      const organizerId = userRole === 'ADMIN' ? undefined : req.user!.id;

      const deletedEvent = await EventService.deleteEvent(id, organizerId);

      if (deletedEvent.status === 'LIVE') {
        await forceEndEventAttendance(io, id);
        io.emit('eventDeleted', {
          eventId: id,
          eventTitle: deletedEvent.title,
          locationId: deletedEvent.location.id,
          timestamp: new Date().toISOString(),
          deletedBy: req.user!.username
        });
      }

      logger.info(`Event deleted: "${deletedEvent.title}" (${id}) by ${req.user!.username} (${userRole})`);
      return sendSuccess(res, 'Event deleted successfully', {
        deletedEvent: {
          id: deletedEvent.id,
          title: deletedEvent.title,
          organizer: deletedEvent.organizer,
          location: deletedEvent.location,
          deletedAt: new Date().toISOString(),
          deletedBy: req.user!.username
        }
      });
    } catch (error) {
      handleControllerError(res, next, error, 'Delete event failed');
    }
  }
}

// Apply authentication middleware to routes that require it
export const EventControllerWithAuth = {
  createEvent: [ensureAuthenticated, EventController.createEvent],
  updateEvent: [ensureAuthenticated, EventController.updateEvent],
  toggleEventLive: [ensureAuthenticated, EventController.toggleEventLive],
  endEvent: [ensureAuthenticated, EventController.endEvent],
  joinEvent: [ensureAuthenticated, EventController.joinEvent],
  updateUserLocation: [ensureAuthenticated, EventController.updateUserLocation],
  setEventLocationBounds: [ensureAuthenticated, EventController.setEventLocationBounds],
  leaveEvent: [ensureAuthenticated, EventController.leaveEvent],
  getMyAttendance: [ensureAuthenticated, EventController.getMyAttendance],
  getMyAttendances: [ensureAuthenticated, EventController.getMyAttendances],
  deleteEvent: [ensureAuthenticated, EventController.deleteEvent],
  getAllEvents: EventController.getAllEvents,
  getEventById: EventController.getEventById,
  getEventAttendees: EventController.getEventAttendees
};