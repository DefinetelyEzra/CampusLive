import { Server, Socket } from "socket.io";
import { AttendanceService } from "../services/attendance.service.js";
import jwt from "jsonwebtoken";
import { EventService } from "../services/event.service.js";
import { ParticipantRole } from "@prisma/client";
import { logger } from "../utils/logger.js";

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

interface LocationUpdate {
  userId: string;
  eventId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

const userLocationCache = new Map<string, LocationUpdate>();
const LOCATION_UPDATE_COOLDOWN = 5000; // 5000ms
const MINIMUM_MOVEMENT_THRESHOLD = 8; // 8 meters

// Helper function to check if location update should be processed
function shouldProcessLocationUpdate(
  userId: string,
  eventId: string,
  latitude: number,
  longitude: number
): { shouldProcess: boolean; reason?: string } {
  const cacheKey = `${userId}:${eventId}`;
  const cached = userLocationCache.get(cacheKey);
  const now = Date.now();

  // First update always processes
  if (!cached) {
    return { shouldProcess: true };
  }

  // Check cooldown period
  if (now - cached.timestamp < LOCATION_UPDATE_COOLDOWN) {
    return { shouldProcess: false, reason: 'Too frequent' };
  }

  // Check if movement is significant using Haversine formula
  const distance = calculateHaversineDistance(
    cached.latitude,
    cached.longitude,
    latitude,
    longitude
  );

  if (distance < MINIMUM_MOVEMENT_THRESHOLD) {
    return { shouldProcess: false, reason: `Movement too small: ${distance.toFixed(2)}m` };
  }

  return { shouldProcess: true };
}

// Helper function for Haversine distance
function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Helper function to validate coordinates
function isValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude)
  );
}

export function setupAttendanceHandlers(io: Server) {
  // Middleware to authenticate socket connections
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(" ")[1];

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
      };
      socket.userId = decoded.userId;
      next();
    } catch (error: any) {
      // Check error properties instead of instanceof
      if (error?.name === 'TokenExpiredError') {
        console.warn("JWT expired:", error);
        return next(new Error("Token expired"));
      } else if (error?.name === 'JsonWebTokenError') {
        console.warn("JWT malformed or invalid:", error);
        return next(new Error("Invalid token"));
      } else {
        console.error("Unexpected auth error:", error);
        return next(new Error("Authentication failed"));
      }
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.userId} connected to socket`);

    // Join event attendance room
    socket.on("join-event-room", (eventId: string) => {
      socket.join(`event:${eventId}`);
      console.log(`User ${socket.userId} joined event room: ${eventId}`);
    });

    // Leave event attendance room
    socket.on("leave-event-room", (eventId: string) => {
      socket.leave(`event:${eventId}`);
      console.log(`User ${socket.userId} left event room: ${eventId}`);
    });

    // Handle event joining via socket
    socket.on("join-event", async (data: string | {
      eventId: string;
      role?: { roleType: ParticipantRole };
      latitude?: number;
      longitude?: number;
    }, callback) => {
      try {
        if (!socket.userId) {
          return callback({ success: false, message: "Not authenticated" });
        }

        // Handle both string eventId (legacy) and object format
        let eventId: string;
        let role: ParticipantRole = ParticipantRole.WATCHER; // Default role
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

        // Use the event service to join the event with role and location
        const attendance = await EventService.joinEvent(
          socket.userId,
          eventId,
          role,
          location
        );

        // Join the socket room for this event
        await socket.join(`event:${eventId}`);

        // Get user info for notifications
        const user = await AttendanceService.getUserById(socket.userId);

        // Notify other participants about the new joiner
        socket.to(`event:${eventId}`).emit('user-joined-with-role', {
          userId: socket.userId,
          username: user?.username || 'Unknown User',
          role: role,
          timestamp: new Date().toISOString()
        });

        // Update event attendance count for all listeners
        const attendees = await AttendanceService.getEventAttendees(eventId);
        io.to(`event:${eventId}`).emit("attendance-updated", {
          eventId,
          attendeeCount: attendees.length,
          attendees: attendees.map((a) => ({
            id: a.user.id,
            username: a.user.username,
            joinedAt: a.joinedAt,
            role: a.role
          })),
        });

        callback({
          success: true,
          message: `Successfully joined as ${role}`,
          attendance
        });

      } catch (error: any) {
        console.error('Error joining event:', error);
        callback({
          success: false,
          message: error.message || 'Failed to join event'
        });
      }
    });



    // Handle location updates for active participants
    socket.on("update-location", async (data: {
      eventId: string;
      latitude: number;
      longitude: number;
    }, callback) => {
      try {
        // Validate authentication
        if (!socket.userId) {
          return callback?.({ success: false, message: "Not authenticated" });
        }

        // Validate coordinates
        if (!isValidCoordinates(data.latitude, data.longitude)) {
          return callback?.({
            success: false,
            message: "Invalid coordinates provided"
          });
        }

        // Check if update should be processed (rate limiting + movement threshold)
        const { shouldProcess, reason } = shouldProcessLocationUpdate(
          socket.userId,
          data.eventId,
          data.latitude,
          data.longitude
        );

        if (!shouldProcess) {
          console.log(`Skipping location update for ${socket.userId}: ${reason}`);
          return callback?.({
            success: true,
            skipped: true,
            reason,
            message: "Location update skipped (no significant movement)"
          });
        }

        // Update cache
        const cacheKey = `${socket.userId}:${data.eventId}`;
        userLocationCache.set(cacheKey, {
          userId: socket.userId,
          eventId: data.eventId,
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: Date.now()
        });

        // Check attendance status
        const attendance = await AttendanceService.getUserEventAttendance(
          socket.userId,
          data.eventId
        );

        if (!attendance || !attendance.isActive) {
          // Clean up cache for inactive attendance
          userLocationCache.delete(cacheKey);
          return callback?.({
            success: false,
            message: "Not actively attending this event"
          });
        }

        // Validate location against event bounds
        const validation = await AttendanceService.validateAndUpdateLocation(
          socket.userId,
          data.eventId,
          data.latitude,
          data.longitude
        );

        // Handle location validation result
        await handleLocationValidation(
          socket,
          io,
          data.eventId,
          validation,
          callback
        );

      } catch (error: any) {
        await handleLocationError(socket, data.eventId, error, callback);
      }
    });


    // Helper function to handle location validation result
    async function handleLocationValidation(
      socket: AuthenticatedSocket,
      io: Server,
      eventId: string,
      validation: { isWithinBounds: boolean; distance: number; radiusMeters: number },
      callback?: (response: any) => void
    ) {
      const distanceRounded = Math.round(validation.distance);

      if (validation.isWithinBounds) {
        // User is within bounds - all good
        callback?.({
          success: true,
          distance: distanceRounded,
          maxDistance: validation.radiusMeters,
          status: 'valid' as const,
          message: 'Location validated successfully'
        });
        return;
      }

      // User is outside bounds - send warning
      socket.emit('location-warning', {
        message: `You are ${distanceRounded}m from the event location. Please return within ${validation.radiusMeters}m or you will be removed.`,
        distance: distanceRounded,
        maxDistance: validation.radiusMeters
      });

      // Check if user is too far (50% buffer) and remove if necessary
      const maxDistanceWithBuffer = validation.radiusMeters * 1.5;
      if (distanceRounded > maxDistanceWithBuffer && socket.userId) {
        await removeUserFromEvent(socket, io, eventId, distanceRounded, validation.radiusMeters);
      }

      callback?.({
        success: false,
        distance: distanceRounded,
        maxDistance: validation.radiusMeters,
        status: 'warning' as const,
        message: 'Location warning: too far from event'
      });
    }

    // Helper function to remove user from event
    async function removeUserFromEvent(
      socket: AuthenticatedSocket,
      io: Server,
      eventId: string,
      distance: number,
      maxDistance: number
    ) {
      if (!socket.userId) return;

      await AttendanceService.leaveEvent(socket.userId, eventId);

      socket.emit('removed-from-event', {
        eventId,
        reason: 'Too far from event location',
        message: `You were removed from the event for being ${distance}m away (max: ${maxDistance}m).`
      });

      socket.leave(`event:${eventId}`);

      // Update attendance count for all users in the event
      const attendees = await AttendanceService.getEventAttendees(eventId);
      io.to(`event:${eventId}`).emit("attendance-updated", {
        eventId,
        attendeeCount: attendees.length,
        attendees: attendees.map((a) => ({
          id: a.user.id,
          username: a.user.username,
          joinedAt: a.joinedAt,
          role: a.role
        })),
      });
    }

    // Helper function to handle location errors
    async function handleLocationError(
      socket: AuthenticatedSocket,
      eventId: string,
      error: any,
      callback?: (response: any) => void
    ) {
      console.error('Error updating location:', error);

      // Check if user was removed due to location violation
      if (error.message?.includes('Removed from event')) {
        socket.emit('removed-from-event', {
          eventId,
          reason: 'Location violation',
          message: error.message
        });
        socket.leave(`event:${eventId}`);
      }

      callback?.({
        success: false,
        message: error.message || 'Failed to update location'
      });
    }

    // Handle leaving event with role cleanup
    socket.on("leave-event-role", async (eventId: string, callback) => {
      try {
        if (!socket.userId) {
          return callback({ success: false, message: "Not authenticated" });
        }

        await AttendanceService.leaveEvent(socket.userId, eventId);

        // Leave the event room
        socket.leave(`event:${eventId}`);

        // Get user info for notifications
        const user = await AttendanceService.getUserById(socket.userId);

        // Notify all users in the event room about user leaving
        socket.to(`event:${eventId}`).emit("user-left-event-role", {
          userId: socket.userId,
          username: user?.username || 'Unknown User',
          timestamp: new Date().toISOString(),
        });

        // Update event attendance count
        const attendees = await AttendanceService.getEventAttendees(eventId);
        io.to(`event:${eventId}`).emit("attendance-updated", {
          eventId,
          attendeeCount: attendees.length,
          attendees: attendees.map((a) => ({
            id: a.user.id,
            username: a.user.username,
            joinedAt: a.joinedAt,
            role: a.role
          })),
        });

        callback({
          success: true,
          message: "Successfully left event",
        });
      } catch (error: any) {
        callback({
          success: false,
          message: error.message || "Failed to leave event",
        });
      }
    });

    // Handle event leaving via socket
    socket.on("leave-event", async (eventId: string, callback) => {
      try {
        if (!socket.userId) {
          return callback({ success: false, message: "Not authenticated" });
        }

        // Clean up location cache
        const cacheKey = `${socket.userId}:${eventId}`;
        userLocationCache.delete(cacheKey);

        await AttendanceService.leaveEvent(socket.userId, eventId);

        // Leave the event room
        socket.leave(`event:${eventId}`);

        // Notify all users in the event room about user leaving
        socket.to(`event:${eventId}`).emit("user-left-event", {
          userId: socket.userId,
          timestamp: new Date(),
        });

        // Update event attendance count
        const attendees = await AttendanceService.getEventAttendees(eventId);
        io.to(`event:${eventId}`).emit("attendance-updated", {
          eventId,
          attendeeCount: attendees.length,
          attendees: attendees.map((a) => ({
            id: a.user.id,
            username: a.user.username,
            joinedAt: a.joinedAt,
          })),
        });

        callback({
          success: true,
          message: "Successfully left event",
        });
      } catch (error: any) {
        callback({
          success: false,
          message: error.message || "Failed to leave event",
        });
      }
    });

    // Handle real-time posting to events
    socket.on(
      "post-to-event",
      async (
        data: {
          eventId: string;
          content?: string;
          mediaUrl?: string;
          locationId: string;
        },
        callback
      ) => {
        try {
          if (!socket.userId) {
            return callback({ success: false, message: "Not authenticated" });
          }

          // Check if user is attending the event
          const isAttending = await AttendanceService.isUserAttending(
            socket.userId,
            data.eventId
          );

          if (!isAttending) {
            return callback({
              success: false,
              message: "You must be attending the event to post",
            });
          }

          // Broadcast the new post to all attendees
          io.to(`event:${data.eventId}`).emit("new-event-post", {
            // post: post,
            eventId: data.eventId,
            timestamp: new Date(),
          });

          callback({ success: true, message: "Post created successfully" });
        } catch (error: any) {
          callback({
            success: false,
            message: error.message || "Failed to create post",
          });
        }
      }
    );

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`User ${socket.userId} disconnected from socket`);
    });
  });

  return io;
}

// Helper function to notify about event status changes
export function notifyEventStatusChange(
  io: Server,
  eventId: string,
  status: string
) {
  io.to(`event:${eventId}`).emit("event-status-changed", {
    eventId,
    status,
    timestamp: new Date(),
  });
}

// Helper function to force remove all attendees when event ends
export async function forceEndEventAttendance(io: Server, eventId: string) {
  try {
    // Remove all attendees
    await AttendanceService.endEventParticipants(eventId);

    // Notify all users in the event room that the event has ended
    io.to(`event:${eventId}`).emit("event-ended", {
      eventId,
      message: "Event has ended. You have been automatically removed from attendance.",
      timestamp: new Date(),
    });

    // Disconnect all sockets from the event room
    const sockets = await io.in(`event:${eventId}`).fetchSockets();
    for (const socket of sockets) {
      socket.leave(`event:${eventId}`);
    }
  } catch (error) {
    logger.error("Error force ending event attendance:", error);
  }
}