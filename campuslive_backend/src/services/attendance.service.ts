import prisma from "../config/database.js";
import { EventStatus, ParticipantRole } from "@prisma/client";
import { logger } from "../utils/logger.js";
import { GeolocationService } from "./geolocation.service.js";

export class AttendanceService {
  // Helper to handle errors consistently
  private static handleServiceError(error: unknown, defaultMessage: string): never {
    if (error instanceof Error) {
      throw new Error(`${defaultMessage}: ${error.message}`);
    }
    throw new Error(`${defaultMessage}: Unknown error`);
  }

  // Helper to validate event status and existence
  private static async validateEvent(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        status: true,
        endTime: true,
        maxAttendees: true,
        participants: { where: { isActive: true } },
      },
    });

    if (!event) {
      throw new Error("Event not found");
    }

    if (event.status !== EventStatus.LIVE) {
      throw new Error("Event is not currently live");
    }

    if (event.endTime && new Date() > event.endTime) {
      throw new Error("Event has already ended");
    }

    return event;
  }

  // Helper to check existing attendance
  private static async checkAttendanceStatus(userId: string, eventId: string) {
    const existingAttendance = await prisma.eventParticipant.findUnique({
      where: {
        eventId_userId: { userId, eventId },
      },
    });

    if (existingAttendance?.isActive) {
      throw new Error("You are already attending this event");
    }

    return existingAttendance;
  }

  // Helper to check for concurrent event attendance
  private static async checkConcurrentAttendance(
    userId: string,
    eventId: string,
    role: ParticipantRole
  ) {
    // WATCHERS can attend multiple events
    if (role === ParticipantRole.WATCHER) {
      return;
    }

    // For POSTER and MODERATOR, check for active attendance in other events
    const currentAttendance = await prisma.eventParticipant.findFirst({
      where: {
        userId,
        isActive: true,
        event: { status: EventStatus.LIVE },
        NOT: { eventId },
      },
      include: { event: { select: { title: true } } },
    });

    if (currentAttendance?.event?.title) {
      throw new Error(
        `You are already attending "${currentAttendance.event.title}". Leave that event first.`
      );
    }
  }

  static async getAllActiveAttendances(userId: string) {
    try {
      return await prisma.eventParticipant.findMany({
        where: {
          userId,
          isActive: true,
          event: {
            status: EventStatus.LIVE,
            isLive: true
          }
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              location: { select: { id: true, name: true } }
            }
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching all active attendances:', error);
      return [];
    }
  }

  // Get user by ID (helper method for socket handlers)
  static async getUserById(userId: string) {
    try {
      return await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true, role: true }
      });
    } catch (error) {
      logger.error('Error fetching user by ID:', error);
      return null;
    }
  }

  static async joinEvent(
    userId: string,
    eventId: string,
    role: ParticipantRole = ParticipantRole.WATCHER,
    location?: { latitude: number; longitude: number }
  ) {
    try {
      // Validate event
      const event = await this.validateEvent(eventId);

      // Check capacity
      if (event.maxAttendees && event.participants.length >= event.maxAttendees) {
        throw new Error("Event has reached maximum capacity");
      }

      // Check existing and concurrent attendance
      const existingAttendance = await this.checkAttendanceStatus(userId, eventId);
      await this.checkConcurrentAttendance(userId, eventId, role);

      // Check if this is a NEW attendee (never joined before, or left and rejoining)
      const isNewAttendee = !existingAttendance;

      // Create or reactivate attendance
      const attendance = await prisma.eventParticipant.upsert({
        where: { eventId_userId: { userId, eventId } },
        update: {
          isActive: true,
          joinedAt: new Date(),
          leftAt: null,
          role,
        },
        create: {
          userId,
          eventId,
          isActive: true,
          role,
        },
        include: {
          event: { include: { location: true } },
        },
      });

      // INCREMENT totalAttendees only for NEW attendees
      if (isNewAttendee) {
        await prisma.event.update({
          where: { id: eventId },
          data: {
            totalAttendees: {
              increment: 1
            }
          }
        });
      }

      return attendance;
    } catch (error) {
      this.handleServiceError(error, "Failed to join event");
    }
  }

  static async leaveEvent(userId: string, eventId: string) {
    try {
      const attendance = await prisma.eventParticipant.findUnique({
        where: { eventId_userId: { userId, eventId } },
      });

      if (!attendance?.isActive) {
        throw new Error("You are not currently attending this event");
      }

      const updatedAttendance = await prisma.eventParticipant.update({
        where: { eventId_userId: { userId, eventId } },
        data: {
          isActive: false,
          leftAt: new Date(),
        },
      });

      return updatedAttendance;
    } catch (error) {
      this.handleServiceError(error, "Failed to leave event");
    }
  }

  static async isUserAttending(userId: string, eventId: string): Promise<boolean> {
    try {
      const attendance = await prisma.eventParticipant.findUnique({
        where: { eventId_userId: { userId, eventId } },
      });

      return attendance?.isActive || false;
    } catch (error) {
      this.handleServiceError(error, "Failed to check attendance");
    }
  }

  // Get current active attendance for a user
  static async getCurrentAttendance(userId: string) {
    try {
      return await prisma.eventParticipant.findFirst({
        where: {
          userId,
          isActive: true,
          event: {
            status: 'LIVE',
            isLive: true
          }
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              status: true,
              isLive: true,
              location: {
                select: { id: true, name: true }
              }
            }
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching current attendance:', error);
      return null;
    }
  }

  // Validate and update location with bounds checking using PostGIS
  static async validateAndUpdateLocation(
    userId: string,
    eventId: string,
    latitude: number,
    longitude: number
  ) {
    try {
      // Validate user location against event bounds using PostGIS
      const validation = await GeolocationService.validateUserLocation(
        eventId,
        latitude,
        longitude
      );

      // Update user's last location check timestamp
      await GeolocationService.updateUserLocation(eventId, userId);

      // If user is too far, check grace period
      if (!validation.isWithinBounds) {
        const attendance = await prisma.eventParticipant.findFirst({
          where: { userId, eventId, isActive: true }
        });

        if (attendance?.lastLocationCheck) {
          const timeSinceLastCheck = Date.now() - attendance.lastLocationCheck.getTime();
          const graceTimeMs = 3 * 60 * 1000; // 3 minutes grace period

          // If beyond grace period, automatically remove from event
          if (timeSinceLastCheck > graceTimeMs) {
            await this.leaveEvent(userId, eventId);
            throw new Error(`Removed from event: ${Math.round(validation.distance)}m from location (max: ${validation.radiusMeters}m)`);
          }
        }
      }

      return validation;

    } catch (error) {
      logger.error('Error validating location:', error);
      throw error;
    }
  }

  // Helper method to get user attendance for specific event
  static async getUserEventAttendance(userId: string, eventId: string) {
    try {
      return await prisma.eventParticipant.findUnique({
        where: {
          eventId_userId: { userId, eventId }
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              status: true,
              isLive: true
            }
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching user event attendance:', error);
      return null;
    }
  }

  // Calculate distance between two coordinates (Haversine formula)
  private static calculateDistance(
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

    return R * c; // Distance in meters
  }

  static async endEventParticipants(eventId: string) {
    try {
      await prisma.eventParticipant.updateMany({
        where: { eventId, isActive: true },
        data: {
          isActive: false,
          leftAt: new Date(),
        },
      });
    } catch (error) {
      this.handleServiceError(error, "Failed to end event participants");
    }
  }

  static async getEventAttendees(eventId: string) {
    try {
      return await prisma.eventParticipant.findMany({
        where: { eventId, isActive: true },
        include: {
          user: {
            select: { id: true, username: true, role: true },
          },
        },
      });
    } catch (error) {
      this.handleServiceError(error, "Failed to get event attendees");
    }
  }

  static async cleanupExpiredAttendances() {
    try {
      const expiredEvents = await prisma.event.findMany({
        where: {
          endTime: { lt: new Date() },
          status: { in: [EventStatus.LIVE, EventStatus.UPCOMING] },
        },
      });

      for (const event of expiredEvents) {
        await this.endEventParticipants(event.id);
        await prisma.event.update({
          where: { id: event.id },
          data: { status: EventStatus.ENDED, isLive: false },
        });
      }
    } catch (error) {
      this.handleServiceError(error, "Failed to cleanup expired attendances");
    }
  }
}