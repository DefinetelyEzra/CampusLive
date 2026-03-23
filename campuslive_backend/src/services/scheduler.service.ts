import { EventService } from './event.service.js';
import { logger } from '../utils/logger.js';
import { schedulerConfig } from '../config/scheduler.js';
import { io } from '../server.js';
import { forceEndEventAttendance, notifyEventStatusChange } from '../socket/attendanceHandler.js';
import prisma from '../config/database.js';
import { RecurrenceService } from './recurrence.service.js';
import { RoleManagementService } from './roleManagement.service.js';

export class SchedulerService {
  private static instance: SchedulerService;
  private startCheckInterval: NodeJS.Timeout | null = null;
  private endCheckInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastStartCheck = new Date();
  private lastEndCheck = new Date();
  private startedEventCount = 0;
  private endedEventCount = 0;
  private recurringCheckInterval: NodeJS.Timeout | null = null;
  private roleCleanupInterval: NodeJS.Timeout | null = null;

  private constructor() { }

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  start() {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    if (!schedulerConfig.enabled) {
      logger.info('Scheduler is disabled via configuration');
      return;
    }

    this.isRunning = true;
    this.setupEventStartScheduler();
    this.setupEventEndScheduler();
    this.setupRecurringEventProcessor();
    this.setupRoleCleanupScheduler();

    logger.info('Event Scheduler started successfully', {
      startCheckInterval: `${schedulerConfig.startCheckIntervalMs}ms`,
      endCheckInterval: `${schedulerConfig.endCheckIntervalMs}ms`,
      timezone: schedulerConfig.timezone,
      startBuffer: `${schedulerConfig.startBufferMinutes} minutes`,
      endBuffer: `${schedulerConfig.endBufferMinutes} minutes`,
      roleCleanup: 'Every 1 hour'
    });
  }

  stop() {
    if (!this.isRunning) {
      logger.warn('Scheduler is not running');
      return;
    }

    if (this.startCheckInterval) {
      clearInterval(this.startCheckInterval);
      this.startCheckInterval = null;
    }

    if (this.endCheckInterval) {
      clearInterval(this.endCheckInterval);
      this.endCheckInterval = null;
    }

    if (this.recurringCheckInterval) {
      clearInterval(this.recurringCheckInterval);
      this.recurringCheckInterval = null;
    }

    if (this.roleCleanupInterval) {
      clearInterval(this.roleCleanupInterval);
      this.roleCleanupInterval = null;
    }

    this.isRunning = false;
    logger.info('Event Scheduler stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastStartCheck: this.lastStartCheck,
      lastEndCheck: this.lastEndCheck,
      startedEventCount: this.startedEventCount,
      endedEventCount: this.endedEventCount,
      config: schedulerConfig
    };
  }

  private setupRoleCleanupScheduler() {
    // Check for expired roles and tokens every hour
    this.roleCleanupInterval = setInterval(async () => {
      try {
        logger.info('Running scheduled role and token cleanup...');
        await RoleManagementService.cleanupExpiredRoles();
        logger.info('Role and token cleanup completed');
      } catch (error) {
        logger.error('Error in role cleanup scheduler:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Run once immediately on startup
    RoleManagementService.cleanupExpiredRoles()
      .then(() => logger.info('Initial role cleanup completed on scheduler start'))
      .catch(error => logger.error('Initial role cleanup failed:', error));
  }

  private setupRecurringEventProcessor() {
    // Check for new recurring instances every hour
    this.recurringCheckInterval = setInterval(async () => {
      try {
        await RecurrenceService.processRecurringEvents();
      } catch (error) {
        logger.error('Error in recurring event processor:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  private setupEventStartScheduler() {
    this.startCheckInterval = setInterval(async () => {
      try {
        await this.checkAndStartEvents();
        this.lastStartCheck = new Date();
      } catch (error) {
        logger.error('Error in event start scheduler:', error);
      }
    }, schedulerConfig.startCheckIntervalMs);
  }

  private setupEventEndScheduler() {
    this.endCheckInterval = setInterval(async () => {
      try {
        await this.checkAndEndEvents();
        this.lastEndCheck = new Date();
      } catch (error) {
        logger.error('Error in event end scheduler:', error);
      }
    }, schedulerConfig.endCheckIntervalMs);
  }

  private async checkAndStartEvents() {
    try {
      const eventsToStart = await EventService.getEventsToStart();

      if (eventsToStart.length === 0) {
        this.logNoEventsToStart();
        return;
      }

      logger.info(` Found ${eventsToStart.length} event(s) ready to start`);

      for (const event of eventsToStart) {
        await this.processEventStart(event);
      }

    } catch (error) {
      logger.error('Error checking events to start:', error);
    }
  }

  private logNoEventsToStart() {
    // Only log every 10th check to reduce noise but still provide visibility
    if (this.startedEventCount % 10 === 0) {
      logger.debug('No events to start at this time');
    }
  }

  private async processEventStart(event: any) {
    try {
      const canStart = await this.validateEventCanStart(event.id);
      if (!canStart) return;

      await EventService.autoStartEvent(event.id);
      this.startedEventCount++;

      await this.emitEventStartNotifications(event);

      logger.info(`✅ Auto-started event: "${event.title}" at ${event.location.name} (scheduled: ${new Date(event.startTime).toISOString()})`);

    } catch (error) {
      logger.error(`❌ Failed to auto-start event "${event.title}" (${event.id}):`, error);
    }
  }

  private async validateEventCanStart(eventId: string): Promise<boolean> {
    const currentEvent = await prisma.event.findUnique({
      where: { id: eventId },
      select: { isLive: true, status: true }
    });

    if (!currentEvent || currentEvent.isLive) {
      logger.debug(`Event ${eventId} already started or not found, skipping`);
      return false;
    }

    return true;
  }

  private async emitEventStartNotifications(event: any) {
    if (!io) return;

    const fullEvent = await this.getFullEventDetails(event.id);
    if (!fullEvent) return;

    this.broadcastEventLiveNotification(fullEvent);
    this.emitLegacyStatusUpdate(event);
    notifyEventStatusChange(io, event.id, 'LIVE');
  }

  private async getFullEventDetails(eventId: string) {
    return await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        location: {
          select: { id: true, name: true }
        }
      }
    });
  }

  private broadcastEventLiveNotification(fullEvent: any) {
    const socketHandler = (io as any).socketHandler;
    if (socketHandler && typeof socketHandler.broadcastEventLive === 'function') {
      socketHandler.broadcastEventLive(fullEvent);
    }
  }

  private emitLegacyStatusUpdate(event: any) {
    io.emit('eventStatusUpdate', {
      eventId: event.id,
      isLive: true,
      status: 'LIVE',
      locationId: event.location.id,
      timestamp: new Date().toISOString(),
      autoStarted: true
    });
  }

  private async checkAndEndEvents() {
    try {
      const eventsToEnd = await EventService.getEventsToEnd();

      if (eventsToEnd.length === 0) {
        // Only log every 10th check to reduce noise but still provide visibility
        if (this.endedEventCount % 10 === 0) {
          logger.debug('No events to end at this time');
        }
        return;
      }

      logger.info(` Found ${eventsToEnd.length} event(s) ready to end`);

      for (const event of eventsToEnd) {
        try {
          // Double-check event hasn't been ended by another process
          const currentEvent = await prisma.event.findUnique({
            where: { id: event.id },
            select: { isLive: true, status: true }
          });

          if (!currentEvent?.isLive) {
            logger.debug(`Event ${event.id} already ended or not found, skipping`);
            continue;
          }

          await EventService.autoEndEvent(event.id);
          this.endedEventCount++;

          // Force end all attendances and emit socket events
          if (io) {
            // Remove all attendees from the event
            await forceEndEventAttendance(io, event.id);

            // Broadcast to all connected clients
            io.emit('eventStatusUpdate', {
              eventId: event.id,
              isLive: false,
              status: 'ENDED',
              locationId: event.location.id,
              timestamp: new Date().toISOString(),
              autoEnded: true
            });

            io.emit('eventEnded', {
              eventId: event.id,
              timestamp: new Date().toISOString(),
              autoEnded: true
            });

            // Notify event room specifically
            notifyEventStatusChange(io, event.id, 'ENDED');
          }

          logger.info(`🔴 Auto-ended event: "${event.title}" at ${event.location.name} (scheduled end: ${event.endTime ? new Date(event.endTime).toISOString() : 'N/A'})`);

        } catch (error) {
          logger.error(`❌ Failed to auto-end event "${event.title}" (${event.id}):`, error);
        }
      }

    } catch (error) {
      logger.error('Error checking events to end:', error);
    }
  }

  // Method to manually trigger checks (useful for testing)
  async triggerStartCheck() {
    if (!this.isRunning) {
      throw new Error('Scheduler is not running');
    }

    logger.info('Manually triggering event start check');
    await this.checkAndStartEvents();
  }

  async triggerEndCheck() {
    if (!this.isRunning) {
      throw new Error('Scheduler is not running');
    }

    logger.info('Manually triggering event end check');
    await this.checkAndEndEvents();
  }

  // Health check method
  isHealthy(): boolean {
    if (!this.isRunning) return false;

    const now = new Date();
    const maxStaleTime = Math.max(
      schedulerConfig.startCheckIntervalMs,
      schedulerConfig.endCheckIntervalMs
    ) * 2; // Allow for 2x the check interval

    const startCheckStale = now.getTime() - this.lastStartCheck.getTime() > maxStaleTime;
    const endCheckStale = now.getTime() - this.lastEndCheck.getTime() > maxStaleTime;

    return !startCheckStale && !endCheckStale;
  }
}