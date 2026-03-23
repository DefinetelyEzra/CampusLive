import prisma from '../config/database.js';
import { CreateEventRequest } from '../types/index.js';
import { EventStatus, ParticipantRole, RecurrenceType } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { TimezoneUtils } from '../utils/timezone.js';
import { GeolocationService } from './geolocation.service.js';
import { AccessKeyUtils } from '../utils/accessKey.js';
import { RecurrenceService } from './recurrence.service.js';
import { EventConflictService } from './eventConflict.service.js';
import { io } from '../server.js';

export class EventService {
  // Common select clause for event queries
  private static readonly eventSelect = {
    organizer: { select: { id: true, username: true } },
    location: {
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true
      }
    },
    participants: {
      where: { isActive: true },
      select: {
        id: true,
        userId: true,
        joinedAt: true,
        role: true,
        isActive: true,
        user: { select: { id: true, username: true } }
      },
    },
    _count: {
      select: {
        participants: { where: { isActive: true } },
        posts: true,
        Media: true
      }
    },
  };

  // Standardized error handler
  private static handleServiceError(error: unknown, operation: string, eventId?: string): never {
    let errorMessage: string;

    if (error instanceof Error) {
      if (eventId) {
        errorMessage = `${operation} failed for event ${eventId}: ${error.message}`;
      } else {
        errorMessage = `${operation} failed: ${error.message}`;
      }
    } else {
      errorMessage = `${operation} failed: Unknown error`;
    }

    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Helper to calculate role-specific counts from participants
  private static calculateRoleCounts(participants: Array<{ role: ParticipantRole }>) {
    return {
      watcherCount: participants.filter(p => p.role === 'WATCHER').length,
      posterCount: participants.filter(p => p.role === 'POSTER').length,
      moderatorCount: participants.filter(p => p.role === 'MODERATOR').length,
    };
  }

  // Helper to format event with counts
  private static formatEventWithCounts(event: any, userId?: string, isUserAttending = false) {
    const roleCounts = this.calculateRoleCounts(event.participants || []);
    return {
      ...event,
      attendeeCount: event._count.participants,  // Active attendees
      totalAttendees: event.totalAttendees || 0,  // Total unique attendees
      activeAttendees: event._count.participants, // Explicit active count
      ...roleCounts,
      isUserAttending: userId ? event.participants?.some((a: any) => a.userId === userId) ?? isUserAttending : isUserAttending,
    };
  }

  // Validation helpers
  private static async validateEventExists(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) throw new Error('Event not found');
  }

  private static async validateEventOwnership(eventId: string, organizerId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });
    if (!event) throw new Error('Event not found');
    if (event.organizerId !== organizerId) throw new Error('Unauthorized to modify this event');
  }

  private static async validateEventJoinability(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        participants: { where: { isActive: true } },
      },
    });

    if (!event) return { canJoin: false, reason: 'Event not found' };
    if (event.status !== EventStatus.LIVE) return { canJoin: false, reason: 'Event is not live' };
    if (event.endTime && new Date() > event.endTime) return { canJoin: false, reason: 'Event has ended' };
    if (event.maxAttendees && event.participants.length >= event.maxAttendees) {
      return { canJoin: false, reason: 'Event is at capacity' };
    }

    const userAttendance = event.participants.find((a) => a.userId === userId);
    if (userAttendance) return { canJoin: false, reason: 'Already attending this event' };

    const currentAttendance = await prisma.eventParticipant.findFirst({
      where: { userId, isActive: true, event: { status: EventStatus.LIVE } },
      include: { event: { select: { title: true } } },
    });

    if (currentAttendance) {
      return { canJoin: false, reason: `Already attending "${currentAttendance.event.title}"` };
    }

    return { canJoin: true };
  }

  private static async validateRoleJoinability(userId: string, eventId: string, role: ParticipantRole) {
    const basicCheck = await this.validateEventJoinability(eventId, userId);
    if (!basicCheck.canJoin) return basicCheck;

    // WATCHERS can join multiple events, no additional checks needed
    if (role === ParticipantRole.WATCHER) {
      return { canJoin: true };
    }

    if (role === ParticipantRole.POSTER) {
      const existingPosterRole = await prisma.eventParticipant.findFirst({
        where: {
          userId,
          role: ParticipantRole.POSTER,
          isActive: true,
          event: { status: EventStatus.LIVE, isLive: true },
          NOT: { eventId } // Exclude current event
        },
        include: { event: { select: { title: true } } },
      });
      if (existingPosterRole) {
        return { canJoin: false, reason: `Already posting in "${existingPosterRole.event.title}"` };
      }
    }

    if (role === ParticipantRole.MODERATOR) {
      const existingModerator = await prisma.eventParticipant.findFirst({
        where: { eventId, role: ParticipantRole.MODERATOR },
      });
      if (existingModerator && existingModerator.userId !== userId) {
        return { canJoin: false, reason: 'Event already has a moderator' };
      }
    }

    return { canJoin: true };
  }

  static async createEvent(data: CreateEventRequest, organizerId: string): Promise<any> {
    try {
      const now = new Date();
      const startTime = new Date(data.startTime);

      // END TIME IS NOW REQUIRED
      if (!data.endTime) {
        throw new Error('End time is required for all events');
      }

      const endTime = new Date(data.endTime);

      // Validate event timing
      if (startTime <= now) {
        const timeDiff = Math.round((now.getTime() - startTime.getTime()) / (60 * 1000));
        throw new Error(`Cannot create event for past time. Start time was ${timeDiff} minutes ago.`);
      }

      if (endTime <= startTime) {
        throw new Error('End time must be after start time');
      }

      const maxDurationHours = 24;
      if ((endTime.getTime() - startTime.getTime()) > maxDurationHours * 60 * 60 * 1000) {
        throw new Error(`Event duration cannot exceed ${maxDurationHours} hours`);
      }

      // CHECK FOR LOCATION-TIME CONFLICTS
      const conflictCheck = await EventConflictService.checkLocationTimeConflict(
        data.locationId,
        startTime,
        endTime
      );

      if (conflictCheck.hasConflict) {
        throw new Error(conflictCheck.message || 'Location is already booked for this time');
      }

      // Generate access key for private events
      const accessKey = data.isPrivate
        ? await AccessKeyUtils.generateUniqueAccessKey(prisma)
        : null;

      // Validate recurrence settings
      if (data.isRecurring && !data.recurrenceType) {
        throw new Error('Recurrence type is required for recurring events');
      }

      const event = await prisma.event.create({
        data: {
          title: data.title,
          description: data.description,
          startTime,
          endTime,
          organizerId,
          locationId: data.locationId,
          maxAttendees: data.maxAttendees || null,
          status: EventStatus.UPCOMING,
          isLive: false,
          isPrivate: data.isPrivate || false,
          accessKey,
          isRecurring: data.isRecurring || false,
          recurrenceType: data.recurrenceType as RecurrenceType | null,
        },
        include: this.eventSelect,
      });

      // Create recurring instances if applicable
      if (data.isRecurring && data.recurrenceType && data.recurrenceEndDate) {
        const recurrenceEndDate = new Date(data.recurrenceEndDate);

        // DON'T create parent event yet - just check for conflicts first
        const recurringResult = await RecurrenceService.checkRecurringConflictsOnly(
          data.locationId,
          startTime,
          endTime,
          data.recurrenceType as RecurrenceType,
          recurrenceEndDate
        );

        // If there are conflicts and no skipConflicts flag, return conflicts without creating anything
        if (recurringResult.conflictingInstances.length > 0 && !data.skipConflicts) {
          logger.info(
            `Recurring event "${data.title}" has ${recurringResult.conflictingInstances.length} conflicts. ` +
            `Returning to user for resolution. No events created.`
          );

          // Delete the parent event we just created
          await prisma.event.delete({ where: { id: event.id } });

          return {
            hasConflicts: true,
            totalInstances: recurringResult.totalInstances,
            conflictingInstances: recurringResult.conflictingInstances.map(c => ({
              startTime: c.startTime.toISOString(),
              endTime: c.endTime.toISOString(),
              conflictsWith: c.conflictsWith
            })),
            locationName: event.location.name
          };
        }

        // No conflicts OR skipConflicts is true. Create the instances
        const createdResult = await RecurrenceService.createRecurringInstances(
          event.id,
          data.recurrenceType as RecurrenceType,
          recurrenceEndDate
        );

        logger.info(
          `Created recurring event: "${event.title}" ` +
          `(Private: ${event.isPrivate}, Instances: ${createdResult.createdCount})`
        );
      }

      const formattedEvent = this.formatEventWithCounts(event);
      return {
        ...TimezoneUtils.convertEventDates(formattedEvent),
        accessKey: event.accessKey
      };
    } catch (error) {
      this.handleServiceError(error, 'Event creation');
    }
  }

  // Fetch event and ensure it exists
  private static async fetchEventForUpdate(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organizerId: true,
        status: true,
        isLive: true,
        locationId: true,
        startTime: true,
        endTime: true,
        isRecurring: true,
        isPrivate: true,
        recurrenceType: true,
      },
    });

    if (!event) throw new Error('Event not found');
    return event;
  }

  // Validate that the event can be edited by this organizer
  private static validateEventEditable(event: any, organizerId: string) {
    if (event.organizerId !== organizerId) throw new Error('Unauthorized to modify this event');
    if (event.status === EventStatus.LIVE || event.status === EventStatus.ENDED) {
      throw new Error('Cannot edit events that are live or have ended');
    }
  }

  // Parse and validate start/end times and build the prisma update payload for times
  private static parseAndValidateUpdateTimes(
    event: any,
    updateData: { startTime?: string; endTime?: string; title?: string; description?: string; }
  ) {
    const dataToUpdate: {
      title?: string;
      description?: string;
      startTime?: Date;
      endTime?: Date;
    } = {};

    if (updateData.title !== undefined) dataToUpdate.title = updateData.title;
    if (updateData.description !== undefined) dataToUpdate.description = updateData.description;

    const now = new Date();
    let newStartTime: Date | null = event.startTime ?? null;
    let newEndTime: Date | null = event.endTime ?? null;

    if (!newEndTime) {
      throw new Error('Event must have an end time');
    }

    if (updateData.startTime) {
      newStartTime = new Date(updateData.startTime);
      if (newStartTime <= now) {
        const timeDiff = Math.round((now.getTime() - newStartTime.getTime()) / (60 * 1000));
        throw new Error(`Cannot set event to past time. Start time was ${timeDiff} minutes ago.`);
      }
      dataToUpdate.startTime = newStartTime;
    }

    if (updateData.endTime) {
      newEndTime = new Date(updateData.endTime);
      dataToUpdate.endTime = newEndTime;
    }

    // At this point both dates must be non-null
    if (!newStartTime || !newEndTime) {
      throw new Error('Invalid event times');
    }

    if (newEndTime <= newStartTime) {
      throw new Error('End time must be after start time');
    }

    const maxDurationHours = 24;
    if ((newEndTime.getTime() - newStartTime.getTime()) > maxDurationHours * 60 * 60 * 1000) {
      throw new Error(`Event duration cannot exceed ${maxDurationHours} hours`);
    }

    return { newStartTime, newEndTime, dataToUpdate };
  }

  // Check for location-time conflicts when times are changing
  private static async checkLocationConflictIfNeeded(
    locationId: string,
    newStartTime: Date,
    newEndTime: Date,
    eventId: string,
    updateData: { startTime?: string; endTime?: string }
  ) {
    if (updateData.startTime || updateData.endTime) {
      const conflictCheck = await EventConflictService.checkLocationTimeConflict(
        locationId,
        newStartTime,
        newEndTime,
        eventId // exclude current event
      );

      if (conflictCheck.hasConflict) {
        throw new Error(conflictCheck.message || 'Location is already booked for this time');
      }
    }
  }

  static async updateEvent(
    eventId: string,
    updateData: {
      title?: string;
      description?: string;
      startTime?: string;
      endTime?: string;
    },
    organizerId: string
  ): Promise<Event> {
    try {
      // Fetch and validate basic ownership and status
      const event = await this.fetchEventForUpdate(eventId);
      this.validateEventEditable(event, organizerId);

      // Parse and validate times and collect update payload
      const { newStartTime, newEndTime, dataToUpdate } = this.parseAndValidateUpdateTimes(event, updateData);

      // Check location conflicts if times changed
      await this.checkLocationConflictIfNeeded(event.locationId, newStartTime, newEndTime, eventId, updateData);

      // Perform update
      const updatedEvent = await prisma.event.update({
        where: { id: eventId },
        data: dataToUpdate,
        include: this.eventSelect,
      });

      logger.info(`Event updated: "${updatedEvent.title}" (${eventId}) by user ${organizerId}`);

      const formattedEvent = this.formatEventWithCounts(updatedEvent);
      return TimezoneUtils.convertEventDates(formattedEvent);
    } catch (error) {
      this.handleServiceError(error, 'Event update', eventId);
    }
  }

  static async verifyEventAccess(eventId: string, accessKey?: string): Promise<boolean> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { isPrivate: true, accessKey: true }
    });

    if (!event) throw new Error('Event not found');
    if (!event.isPrivate) return true;

    return event.accessKey === accessKey;
  }

  static async getAllEvents(isLive?: boolean, userId?: string) {
    try {
      const where: any = {};
      if (isLive !== undefined) {
        where.isLive = isLive;
        if (isLive) where.status = EventStatus.LIVE;
      }

      const events = await prisma.event.findMany({
        where,
        orderBy: { startTime: 'asc' },
        include: this.eventSelect,
      });

      const eventsWithAttendanceInfo = events.map((event) => {
        const formattedEvent = this.formatEventWithCounts(event, userId);
        return {
          ...formattedEvent,
          posts: undefined, // Remove posts from public response
        };
      });

      return TimezoneUtils.convertEventsDates(eventsWithAttendanceInfo);
    } catch (error) {
      this.handleServiceError(error, 'Fetching all events');
    }
  }

  static async getEventById(id: string, userId?: string) {
    try {
      await this.validateEventExists(id);
      const event = await prisma.event.findUnique({
        where: { id },
        include: {
          ...this.eventSelect,
          posts: {
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { id: true, username: true } } },
          },
        },
      });

      if (!event) return null;

      const canJoinCheck = await this.validateEventJoinability(id, userId || '');
      const formattedEvent = this.formatEventWithCounts(event, userId);

      return TimezoneUtils.convertEventDates({
        ...formattedEvent,
        canJoin: canJoinCheck.canJoin,
      });
    } catch (error) {
      this.handleServiceError(error, 'Fetching event', id);
    }
  }

  static async updateEventStatus(id: string, isLive: boolean, organizerId: string) {
    try {
      await this.validateEventOwnership(id, organizerId);

      const event = await prisma.event.findUnique({
        where: { id },
        select: { locationId: true, title: true }
      });

      if (!event) throw new Error('Event not found');

      // If starting event, check location availability
      if (isLive) {
        const availabilityCheck = await EventConflictService.checkLocationAvailableForLive(
          event.locationId,
          id
        );

        if (availabilityCheck.hasConflict) {
          throw new Error(availabilityCheck.message || 'Location is currently occupied by another live event');
        }
      }

      const status = isLive ? EventStatus.LIVE : EventStatus.UPCOMING;
      const updatedEvent = await prisma.event.update({
        where: { id },
        data: { isLive, status },
        include: this.eventSelect,
      });

      if (isLive && io) {
        const socketHandler = (io as any).socketHandler;
        if (socketHandler && typeof socketHandler.broadcastEventLive === 'function') {
          socketHandler.broadcastEventLive(updatedEvent);
        }
      }

      const formattedEvent = this.formatEventWithCounts(updatedEvent);
      return TimezoneUtils.convertEventDates(formattedEvent);
    } catch (error) {
      this.handleServiceError(error, 'Updating event status', id);
    }
  }

  static async endEvent(id: string, organizerId: string) {
    try {
      await this.validateEventOwnership(id, organizerId);
      await prisma.eventParticipant.updateMany({
        where: { eventId: id, isActive: true },
        data: { isActive: false, leftAt: new Date() },
      });

      const updatedEvent = await prisma.event.update({
        where: { id },
        data: { isLive: false, status: EventStatus.ENDED, endTime: new Date() },
        include: this.eventSelect,
      });

      const formattedEvent = this.formatEventWithCounts(updatedEvent);
      return TimezoneUtils.convertEventDates(formattedEvent);
    } catch (error) {
      this.handleServiceError(error, 'Ending event', id);
    }
  }

  static async deleteEvent(id: string, organizerId?: string) {
    try {
      const event = await prisma.event.findUnique({
        where: { id },
        include: this.eventSelect,
      });

      if (!event) throw new Error('Event not found');
      if (organizerId && event.organizerId !== organizerId) throw new Error('Unauthorized to delete this event');
      if (event.status === EventStatus.LIVE && event._count.participants > 0) {
        throw new Error('Cannot delete a live event with active attendees. Please end the event first.');
      }

      const deletedEvent = await prisma.event.delete({
        where: { id },
        include: this.eventSelect,
      });

      const formattedEvent = this.formatEventWithCounts(deletedEvent);
      return TimezoneUtils.convertEventDates(formattedEvent);
    } catch (error) {
      this.handleServiceError(error, 'Deleting event', id);
    }
  }

  static async joinEvent(userId: string, eventId: string, role: ParticipantRole, location?: { latitude: number; longitude: number }) {
    try {
      // Validate location if provided and required for role
      if (location && (role === ParticipantRole.POSTER || role === ParticipantRole.MODERATOR)) {
        const validation = await GeolocationService.validateUserLocation(eventId, location.latitude, location.longitude);
        if (!validation.isWithinBounds) {
          throw new Error(`Must be within ${validation.radiusMeters}m of event location to join as ${role}`);
        }
      }

      // Check if user can join with this role
      const canJoin = await this.validateRoleJoinability(userId, eventId, role);
      if (!canJoin.canJoin) throw new Error(canJoin.reason);

      // If user is joining as POSTER or MODERATOR, remove them from any other active events
      if (role === ParticipantRole.POSTER || role === ParticipantRole.MODERATOR) {
        await prisma.eventParticipant.updateMany({
          where: {
            userId,
            isActive: true,
            event: { status: EventStatus.LIVE },
            NOT: { eventId }
          },
          data: { isActive: false, leftAt: new Date() }
        });
      }

      const participant = await prisma.eventParticipant.create({
        data: {
          userId,
          eventId,
          role,
          lastLocationCheck: location ? new Date() : null,
        },
        include: {
          user: { select: { id: true, username: true } },
          event: {
            include: this.eventSelect,
          },
        },
      });

      logger.info(`User ${userId} joined event ${eventId} as ${role}`);

      const formattedEvent = this.formatEventWithCounts(participant.event, userId, true);
      return {
        ...participant,
        event: TimezoneUtils.convertEventDates(formattedEvent),
      };
    } catch (error) {
      this.handleServiceError(error, 'Joining event', eventId);
    }
  }

  static async getEventsToStart() {
    try {
      const now = new Date();
      const maxLateMinutes = 10;
      const maxLateWindow = new Date(now.getTime() - maxLateMinutes * 60 * 1000);

      const events = await prisma.event.findMany({
        where: {
          status: EventStatus.UPCOMING,
          isLive: false,
          startTime: {
            lte: now,
            gte: maxLateWindow
          },
        },
        include: this.eventSelect,
        orderBy: { startTime: 'asc' },
      });

      if (events.length > 0) {
        logger.info(`Scheduler found ${events.length} events to potentially start:`);
        for (const e of events) {
          const eventStartTime = new Date(e.startTime);
          const timeDiff = Math.round((now.getTime() - eventStartTime.getTime()) / (60 * 1000));
          const status = timeDiff > 0 ? `${timeDiff}min late` : `${Math.abs(timeDiff)}min early`;
          logger.debug(`  - "${e.title}" (${status}) at ${e.location.name}`);
        }
      }

      const formattedEvents = events.map((event) => this.formatEventWithCounts(event));
      return TimezoneUtils.convertEventsDates(formattedEvents);
    } catch (error) {
      this.handleServiceError(error, 'Fetching events to start');
    }
  }

  static async getEventsToEnd() {
    try {
      const now = new Date();
      const maxLateMinutes = 10;
      const maxLateWindow = new Date(now.getTime() - maxLateMinutes * 60 * 1000);

      const events = await prisma.event.findMany({
        where: {
          status: EventStatus.LIVE,
          isLive: true,
          endTime: {
            lte: now,
            gte: maxLateWindow,
            not: null
          },
        },
        include: this.eventSelect,
        orderBy: { endTime: 'asc' },
      });

      if (events.length > 0) {
        logger.info(`Scheduler found ${events.length} events to potentially end:`);
        for (const e of events) {
          const eventEndTime = e.endTime ? new Date(e.endTime) : null;
          if (eventEndTime) {
            const timeDiff = Math.round((now.getTime() - eventEndTime.getTime()) / (60 * 1000));
            const status = timeDiff > 0 ? `${timeDiff}min overdue` : `${Math.abs(timeDiff)}min remaining`;
            logger.debug(`  - "${e.title}" (${status}) at ${e.location.name}`);
          }
        }
      }

      const formattedEvents = events.map((event) => this.formatEventWithCounts(event));
      return TimezoneUtils.convertEventsDates(formattedEvents);
    } catch (error) {
      this.handleServiceError(error, 'Fetching events to end');
    }
  }

  static async autoStartEvent(eventId: string) {
    try {
      await this.validateEventExists(eventId);
      await prisma.eventParticipant.updateMany({
        where: { isActive: true, event: { status: EventStatus.LIVE, NOT: { id: eventId } } },
        data: { isActive: false, leftAt: new Date() },
      });

      const updatedEvent = await prisma.event.update({
        where: { id: eventId },
        data: { isLive: true, status: EventStatus.LIVE },
        include: this.eventSelect,
      });

      logger.info(`AUTO-STARTED: Event "${updatedEvent.title}" (${eventId}) - Location: ${updatedEvent.location.name}`);

      const formattedEvent = this.formatEventWithCounts(updatedEvent);
      return TimezoneUtils.convertEventDates(formattedEvent);
    } catch (error) {
      this.handleServiceError(error, 'Auto-starting event', eventId);
    }
  }

  static async autoEndEvent(eventId: string) {
    try {
      await this.validateEventExists(eventId);
      await prisma.eventParticipant.updateMany({
        where: { eventId, isActive: true },
        data: { isActive: false, leftAt: new Date() },
      });

      const updatedEvent = await prisma.event.update({
        where: { id: eventId },
        data: { isLive: false, status: EventStatus.ENDED },
        include: this.eventSelect,
      });

      logger.info(`AUTO-ENDED: Event "${updatedEvent.title}" (${eventId}) - Location: ${updatedEvent.location.name}`);

      const formattedEvent = this.formatEventWithCounts(updatedEvent);
      return TimezoneUtils.convertEventDates(formattedEvent);
    } catch (error) {
      this.handleServiceError(error, 'Auto-ending event', eventId);
    }
  }

  static async createEventWithBounds(data: CreateEventRequest, organizerId: string, locationBounds?: {
    centerLat: number;
    centerLng: number;
    radiusMeters: number;
  }) {
    try {
      const event = await this.createEvent(data, organizerId);
      if (locationBounds) {
        await GeolocationService.setEventLocationBound(
          event.id,
          locationBounds.centerLat,
          locationBounds.centerLng,
          locationBounds.radiusMeters
        );
      }
      return event;
    } catch (error) {
      this.handleServiceError(error, 'Creating event with bounds');
    }
  }
}