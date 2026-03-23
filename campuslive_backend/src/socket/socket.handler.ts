import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { AuthenticatedUser } from '../types/index.js';
import { AttendanceService } from '../services/attendance.service.js';
import { GeolocationService } from '../services/geolocation.service.js';
import { EventService } from '../services/event.service.js';
import { ParticipantRole } from '@prisma/client';
import prisma from '../config/database.js';

interface AuthenticatedSocket extends Socket {
  user?: AuthenticatedUser;
}

export class SocketHandler {
  private readonly io: Server;
  private readonly connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(io: Server) {
    this.io = io;

    // Debug logging
    logger.info('SocketHandler initialized');
    logger.info(`JWT_SECRET configured: ${!!process.env.JWT_SECRET}`);

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupAttendanceHandlers();
    this.setupRoleHandlers();
    this.setupLocationHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware for socket connections
    this.io.use((socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          logger.error('JWT_SECRET not configured');
          throw new Error('JWT misconfiguration');
        }

        const decoded = jwt.verify(token, secret) as AuthenticatedUser;
        socket.user = decoded;
        next();
      } catch (error: any) {
        logger.error(`Socket authentication failed: ${error.message}`);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`User connected: ${socket.user?.username} (${socket.id})`);

      if (socket.user) {
        this.connectedUsers.set(socket.user.id, socket.id);
      }

      // Join location-specific rooms
      socket.on('joinLocation', (locationId: string) => {
        socket.join(`location:${locationId}`);
        logger.info(`User ${socket.user?.username} joined location: ${locationId}`);
      });

      // Leave location-specific rooms
      socket.on('leaveLocation', (locationId: string) => {
        socket.leave(`location:${locationId}`);
        logger.info(`User ${socket.user?.username} left location: ${locationId}`);
      });

      // Join event-specific rooms
      socket.on('joinEvent', (eventId: string) => {
        socket.join(`event:${eventId}`);
        logger.info(`User ${socket.user?.username} joined event: ${eventId}`);
      });

      // Leave event-specific rooms
      socket.on('leaveEvent', (eventId: string) => {
        socket.leave(`event:${eventId}`);
        logger.info(`User ${socket.user?.username} left event: ${eventId}`);
      });

      // Handle real-time messaging for events
      socket.on('eventMessage', (data: {
        eventId: string;
        message: string;
        timestamp: string;
      }) => {
        socket.to(`event:${data.eventId}`).emit('newEventMessage', {
          ...data,
          user: {
            id: socket.user?.id,
            username: socket.user?.username,
          },
        });
      });

      // Handle typing indicators
      socket.on('typing', (data: { eventId: string; isTyping: boolean }) => {
        socket.to(`event:${data.eventId}`).emit('userTyping', {
          userId: socket.user?.id,
          username: socket.user?.username,
          isTyping: data.isTyping,
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        if (socket.user) {
          this.connectedUsers.delete(socket.user.id);
        }
        logger.info(`User disconnected: ${socket.user?.username} (${socket.id})`);
      });
    });
  }

  private setupRoleHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {

      // Join event 
      socket.on('join-event', async (data: string | {
        eventId: string;
        role?: { roleType: ParticipantRole };
        latitude?: number;
        longitude?: number;
      }, callback?) => {
        try {
          if (!socket.user?.id) {
            callback?.({ success: false, message: 'Not authenticated' });
            return;
          }

          // Handle both string eventId (legacy) and object format
          let eventId: string;
          let role: ParticipantRole = ParticipantRole.WATCHER;
          let location: { latitude: number; longitude: number } | undefined;

          if (typeof data === 'string') {
            // Legacy format: just eventId as string
            eventId = data;
          } else {
            // New format: object with eventId, role, and location
            eventId = data.eventId;
            role = data.role?.roleType || ParticipantRole.WATCHER;
            location = (data.latitude && data.longitude) ? {
              latitude: data.latitude,
              longitude: data.longitude
            } : undefined;
          }

          const participant = await AttendanceService.joinEvent(
            socket.user.id,
            eventId,
            role,
            location
          );

          // Join the event room
          socket.join(`event:${eventId}`);

          // Notify other participants
          socket.to(`event:${eventId}`).emit('user-joined-with-role', {
            userId: socket.user.id,
            username: socket.user.username,
            role: role,
            timestamp: new Date()
          });

          logger.info(`User ${socket.user.username} joined event ${eventId} as ${role}`);

          callback?.({
            success: true,
            message: `Successfully joined event as ${role}`,
            participant
          });

        } catch (error: any) {
          logger.error('Join event error:', error);
          callback?.({
            success: false,
            message: error.message || 'Failed to join event'
          });
        }
      });

      // Leave event (removes participant role)
      socket.on('leave-event-role', async (eventId: string, callback?) => {
        try {
          if (!socket.user?.id) {
            callback?.({ success: false, message: 'Not authenticated' });
            return;
          }

          await prisma.eventParticipant.deleteMany({
            where: {
              userId: socket.user.id,
              eventId
            }
          });

          socket.leave(`event:${eventId}`);

          socket.to(`event:${eventId}`).emit('user-left-event-role', {
            userId: socket.user.id,
            username: socket.user.username,
            timestamp: new Date()
          });

          logger.info(`User ${socket.user.username} left event ${eventId}`);

          callback?.({
            success: true,
            message: 'Successfully left event'
          });

        } catch (error: any) {
          logger.error('Leave event role error:', error);
          callback?.({
            success: false,
            message: error.message || 'Failed to leave event'
          });
        }
      });

      // Moderator ends event
      socket.on('moderator-end-event', async (eventId: string, callback?) => {
        try {
          if (!socket.user?.id) {
            callback?.({ success: false, message: 'Not authenticated' });
            return;
          }

          // Verify user is moderator
          const participant = await prisma.eventParticipant.findUnique({
            where: {
              eventId_userId: {
                eventId,
                userId: socket.user.id
              }
            }
          });

          if (!participant || participant.role !== ParticipantRole.MODERATOR) {
            callback?.({ success: false, message: 'Only moderators can end events' });
            return;
          }

          // End the event
          await EventService.endEvent(eventId, socket.user.id);

          // Remove all participants
          await prisma.eventParticipant.deleteMany({
            where: { eventId }
          });

          // Notify all participants
          this.io.to(`event:${eventId}`).emit('event-ended-by-moderator', {
            eventId,
            endedBy: socket.user.username,
            timestamp: new Date()
          });

          // Clear the room
          const sockets = await this.io.in(`event:${eventId}`).fetchSockets();
          for (const s of sockets) {
            s.leave(`event:${eventId}`);
          }

          logger.info(`Event ${eventId} ended by moderator ${socket.user.username}`);

          callback?.({
            success: true,
            message: 'Event ended successfully'
          });

        } catch (error: any) {
          logger.error('Moderator end event error:', error);
          callback?.({
            success: false,
            message: error.message || 'Failed to end event'
          });
        }
      });

    });
  }

  private setupLocationHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {

      // Real-time location updates
      socket.on('update-location', async (data: {
        eventId: string;
        latitude: number;
        longitude: number;
      }, callback?) => {
        try {
          if (!socket.user?.id) {
            callback?.({ success: false, message: 'Not authenticated' });
            return;
          }

          // Validate eventId exists
          if (!data?.eventId) {
            callback?.({ success: false, message: 'Event ID is required' });
            return;
          }

          const validation = await GeolocationService.validateUserLocation(
            data.eventId,
            data.latitude,
            data.longitude
          );

          if (validation.isWithinBounds) {
            await GeolocationService.updateUserLocation(data.eventId, socket.user.id);

            callback?.({
              success: true,
              distance: Math.round(validation.distance),
              maxDistance: validation.radiusMeters,
              status: 'valid'
            });

          } else {
            // Send warning
            socket.emit('location-warning', {
              distance: Math.round(validation.distance),
              maxDistance: validation.radiusMeters,
              message: `You are ${Math.round(validation.distance)}m from event location. Return within ${validation.radiusMeters}m or you will be removed.`
            });

            callback?.({
              success: false,
              distance: Math.round(validation.distance),
              maxDistance: validation.radiusMeters,
              status: 'warning'
            });

            // Start grace period countdown
            this.startLocationGracePeriod(socket, data.eventId, validation);
          }

        } catch (error: any) {
          logger.error('Location update error:', error);
          callback?.({
            success: false,
            message: error.message || 'Failed to update location'
          });
        }
      });

      // Moderator sets event bounds
      socket.on('set-event-bounds', async (data: {
        eventId: string;
        centerLat: number;
        centerLng: number;
        radiusMeters: number;
      }, callback?) => {
        try {
          if (!socket.user?.id) {
            callback?.({ success: false, message: 'Not authenticated' });
            return;
          }

          // Verify user is moderator or event organizer
          const [participant, event] = await Promise.all([
            prisma.eventParticipant.findUnique({
              where: {
                eventId_userId: {
                  eventId: data.eventId,
                  userId: socket.user.id
                }
              }
            }),
            prisma.event.findUnique({
              where: { id: data.eventId }
            })
          ]);

          const isModerator = participant?.role === ParticipantRole.MODERATOR;
          const isOrganizer = event?.organizerId === socket.user.id;

          if (!isModerator && !isOrganizer) {
            callback?.({
              success: false,
              message: 'Only moderators or event organizers can set bounds'
            });
            return;
          }

          const bounds = await GeolocationService.setEventLocationBound(
            data.eventId,
            data.centerLat,
            data.centerLng,
            data.radiusMeters
          );

          // Notify all event participants
          this.io.to(`event:${data.eventId}`).emit('bounds-updated', {
            eventId: data.eventId,
            bounds,
            updatedBy: socket.user.username,
            timestamp: new Date()
          });

          logger.info(`Event bounds set for ${data.eventId} by ${socket.user.username}`);

          callback?.({
            success: true,
            message: 'Event bounds updated successfully',
            bounds
          });

        } catch (error: any) {
          logger.error('Set event bounds error:', error);
          callback?.({
            success: false,
            message: error.message || 'Failed to set event bounds'
          });
        }
      });

    });
  }

  // Helper method for location grace period
  private startLocationGracePeriod(socket: AuthenticatedSocket, eventId: string, validation: any) {
    setTimeout(async () => {
      try {
        if (!socket.user?.id) return;

        // Check if user is still connected and in the event
        const rooms = Array.from(socket.rooms);
        if (!rooms.includes(`event:${eventId}`)) {
          return; // User already left
        }

        // This would ideally recheck their current location
        // For now, we'll remove them after the grace period
        await prisma.eventParticipant.deleteMany({
          where: {
            userId: socket.user.id,
            eventId
          }
        });

        socket.leave(`event:${eventId}`);

        socket.emit('removed-from-event', {
          reason: 'Left event area',
          eventId,
          message: 'You were removed from the event for being outside the required area.'
        });

        socket.to(`event:${eventId}`).emit('user-removed-location', {
          userId: socket.user.id,
          username: socket.user.username,
          reason: 'location',
          timestamp: new Date()
        });

        logger.info(`User ${socket.user.username} removed from event ${eventId} for location violation`);

      } catch (error) {
        logger.error('Location grace period error:', error);
      }
    }, 30000); // 30 second grace period
  }

  // Method to broadcast new posts to location subscribers
  public broadcastNewPost(locationId: string, post: any) {
    this.io.to(`location:${locationId}`).emit('newPost', post);
  }

  // Method to broadcast event status updates
  public broadcastEventUpdate(eventId: string, locationId: string, update: any) {
    this.io.to(`event:${eventId}`).emit('eventUpdate', update);
    this.io.to(`location:${locationId}`).emit('locationEventUpdate', update);
  }

  // Broadcast that an event has gone live to all connected clients
  public broadcastEventLive(event: any) {
    this.io.emit('event:live', {
      eventId: event.id,
      title: event.title,
      locationId: event.location.id,
      locationName: event.location.name,
      startTime: event.startTime,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Broadcasted live event: "${event.title}" to all connected clients`);
  }

  // Method to get connected users count
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Method to check if user is online
  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  private setupAttendanceHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {

      // Handle event attendance via socket
      socket.on('join-event-attendance', async (eventId: string, callback?) => {
        try {
          if (!socket.user?.id) {
            callback?.({ success: false, message: 'Not authenticated' });
            return;
          }

          const attendance = await AttendanceService.joinEvent(socket.user.id, eventId);

          // Join the event room for real-time updates
          socket.join(`event:${eventId}`);

          // Notify other attendees
          socket.to(`event:${eventId}`).emit('user-joined-event', {
            userId: socket.user.id,
            username: socket.user.username,
            attendance: attendance,
            timestamp: new Date()
          });

          // Update attendance count for all listeners
          const attendees = await AttendanceService.getEventAttendees(eventId);
          this.io.to(`event:${eventId}`).emit('attendance-updated', {
            eventId,
            attendeeCount: attendees.length
          });

          callback?.({
            success: true,
            message: 'Successfully joined event',
            attendance: attendance
          });

        } catch (error: any) {
          logger.error('Join event attendance error:', error);
          callback?.({
            success: false,
            message: error.message || 'Failed to join event'
          });
        }
      });

      socket.on('leave-event-attendance', async (eventId: string, callback?) => {
        try {
          if (!socket.user?.id) {
            callback?.({ success: false, message: 'Not authenticated' });
            return;
          }

          await AttendanceService.leaveEvent(socket.user.id, eventId);

          // Leave the event room
          socket.leave(`event:${eventId}`);

          // Notify other attendees
          socket.to(`event:${eventId}`).emit('user-left-event', {
            userId: socket.user.id,
            username: socket.user.username,
            timestamp: new Date()
          });

          // Update attendance count
          const attendees = await AttendanceService.getEventAttendees(eventId);
          this.io.to(`event:${eventId}`).emit('attendance-updated', {
            eventId,
            attendeeCount: attendees.length
          });

          callback?.({
            success: true,
            message: 'Successfully left event'
          });

        } catch (error: any) {
          logger.error('Leave event attendance error:', error);
          callback?.({
            success: false,
            message: error.message || 'Failed to leave event'
          });
        }
      });
    });
  }

  public async forceEndEventAttendance(eventId: string) {
    try {
      // Remove all attendees 
      await Promise.all([
        AttendanceService.endEventParticipants(eventId),
        prisma.eventParticipant.deleteMany({ where: { eventId } })
      ]);

      // Notify all users in the event room
      this.io.to(`event:${eventId}`).emit('event-force-ended', {
        eventId,
        message: 'Event has ended. You have been automatically removed.',
        timestamp: new Date()
      });

      // Remove all sockets from the event room
      const sockets = await this.io.in(`event:${eventId}`).fetchSockets();
      for (const socket of sockets) {
        socket.leave(`event:${eventId}`);
      }

      logger.info(`Force ended event ${eventId} and removed all participants`);

    } catch (error) {
      logger.error('Error force ending event attendance:', error);
    }
  }

  // Method to broadcast role-specific updates
  public broadcastToRole(eventId: string, role: ParticipantRole, message: string, data: any) {
    // This would require storing socket-role mappings, or querying participants
    this.io.to(`event:${eventId}`).emit('role-specific-update', {
      targetRole: role,
      message,
      data,
      timestamp: new Date()
    });
  }

  public notifyEventStatusChange(eventId: string, status: string) {
    this.io.to(`event:${eventId}`).emit('event-status-changed', {
      eventId,
      status,
      timestamp: new Date()
    });
  }
}