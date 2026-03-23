import prisma from '../config/database.js';
import { RecurrenceType } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { EventConflictService } from './eventConflict.service.js';

export class RecurrenceService {
    /**
     * Calculate the next occurrence date based on recurrence type
     */
    static calculateNextOccurrence(
        currentDate: Date,
        recurrenceType: RecurrenceType
    ): Date {
        const nextDate = new Date(currentDate);

        switch (recurrenceType) {
            case RecurrenceType.DAILY:
                nextDate.setDate(nextDate.getDate() + 1);
                break;
            case RecurrenceType.WEEKLY:
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case RecurrenceType.MONTHLY:
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
        }

        return nextDate;
    }

    /**
     * Create recurring event instances
     */
    static async createRecurringEvents(
        parentEventId: string,
        recurrenceType: RecurrenceType,
        recurrenceEndDate: Date
    ): Promise<number> {
        try {
            const parentEvent = await prisma.event.findUnique({
                where: { id: parentEventId },
                include: { location: true }
            });

            if (!parentEvent) {
                throw new Error('Parent event not found');
            }

            let currentDate = new Date(parentEvent.startTime);
            let eventsCreated = 0;
            const maxRecurrences = 52;

            while (
                currentDate <= recurrenceEndDate &&
                eventsCreated < maxRecurrences
            ) {
                currentDate = this.calculateNextOccurrence(currentDate, recurrenceType);

                if (currentDate > recurrenceEndDate) break;

                const duration = parentEvent.endTime
                    ? parentEvent.endTime.getTime() - parentEvent.startTime.getTime()
                    : 0;

                const endTime = duration > 0 ? new Date(currentDate.getTime() + duration) : null;

                await prisma.event.create({
                    data: {
                        title: parentEvent.title,
                        description: parentEvent.description,
                        startTime: currentDate,
                        endTime,
                        organizerId: parentEvent.organizerId,
                        locationId: parentEvent.locationId,
                        maxAttendees: parentEvent.maxAttendees,
                        isPrivate: parentEvent.isPrivate,
                        accessKey: parentEvent.accessKey,
                        isRecurring: false,
                        parentEventId: parentEvent.id,
                        status: 'UPCOMING'
                    }
                });

                eventsCreated++;
            }

            logger.info(
                `Created ${eventsCreated} recurring instances for event "${parentEvent.title}"` +
                `${parentEvent.isPrivate ? ' (Private)' : ''}`
            );

            return eventsCreated;
        } catch (error) {
            logger.error('Error creating recurring events:', error);
            throw error;
        }
    }

    /**
    * Check for conflicts without creating any events
    */
    static async checkRecurringConflictsOnly(
        locationId: string,
        baseStartTime: Date,
        baseEndTime: Date,
        recurrenceType: RecurrenceType,
        recurrenceEndDate: Date
    ): Promise<{
        totalInstances: number;
        conflictingInstances: Array<{
            startTime: Date;
            endTime: Date;
            conflictsWith: string[];
        }>;
    }> {
        try {
            let currentDate = new Date(baseStartTime);
            const duration = baseEndTime.getTime() - baseStartTime.getTime();
            const maxRecurrences = 52;

            // Generate all instances
            const instances: Array<{ startTime: Date; endTime: Date }> = [];
            let instanceCount = 0;

            while (
                currentDate <= recurrenceEndDate &&
                instanceCount < maxRecurrences
            ) {
                currentDate = this.calculateNextOccurrence(currentDate, recurrenceType);

                if (currentDate > recurrenceEndDate) break;

                const endTime = new Date(currentDate.getTime() + duration);
                instances.push({ startTime: currentDate, endTime });
                instanceCount++;
            }

            // Check all instances for conflicts
            const { conflictingInstances } =
                await EventConflictService.checkRecurringConflicts(
                    locationId,
                    instances
                );

            const formattedConflicts = conflictingInstances.map(conf => ({
                startTime: conf.startTime,
                endTime: conf.endTime,
                conflictsWith: conf.conflicts.map(c => c.title)
            }));

            return {
                totalInstances: instances.length,
                conflictingInstances: formattedConflicts
            };
        } catch (error) {
            logger.error('Error checking recurring conflicts:', error);
            throw error;
        }
    }

    /**
     * Create recurring event instances (called after conflicts are resolved)
     */
    static async createRecurringInstances(
        parentEventId: string,
        recurrenceType: RecurrenceType,
        recurrenceEndDate: Date
    ): Promise<{
        createdCount: number;
    }> {
        try {
            const parentEvent = await prisma.event.findUnique({
                where: { id: parentEventId },
                include: { location: true }
            });

            if (!parentEvent || !parentEvent.endTime) {
                throw new Error('Parent event not found or missing end time');
            }

            let currentDate = new Date(parentEvent.startTime);
            let eventsCreated = 0;
            const maxRecurrences = 52;
            const duration = parentEvent.endTime.getTime() - parentEvent.startTime.getTime();

            while (
                currentDate <= recurrenceEndDate &&
                eventsCreated < maxRecurrences
            ) {
                currentDate = this.calculateNextOccurrence(currentDate, recurrenceType);

                if (currentDate > recurrenceEndDate) break;

                const endTime = new Date(currentDate.getTime() + duration);

                await prisma.event.create({
                    data: {
                        title: parentEvent.title,
                        description: parentEvent.description,
                        startTime: currentDate,
                        endTime,
                        organizerId: parentEvent.organizerId,
                        locationId: parentEvent.locationId,
                        maxAttendees: parentEvent.maxAttendees,
                        isPrivate: parentEvent.isPrivate,
                        accessKey: parentEvent.accessKey,
                        isRecurring: false,
                        parentEventId: parentEvent.id,
                        status: 'UPCOMING'
                    }
                });

                eventsCreated++;
            }

            logger.info(
                `Created ${eventsCreated} recurring instances for event "${parentEvent.title}"`
            );

            return {
                createdCount: eventsCreated
            };
        } catch (error) {
            logger.error('Error creating recurring instances:', error);
            throw error;
        }
    }

    /**
     * Check and create upcoming recurring events (called by scheduler)
     */
    static async processRecurringEvents(): Promise<void> {
        try {
            // Find recurring events that need new instances
            const recurringEvents = await prisma.event.findMany({
                where: {
                    isRecurring: true,
                    status: 'UPCOMING'
                },
                include: {
                    childEvents: {
                        orderBy: { startTime: 'desc' },
                        take: 1
                    }
                }
            });

            for (const event of recurringEvents) {
                const lastChild = event.childEvents[0];
                const lastOccurrence = lastChild ? lastChild.startTime : event.startTime;

                // Check if we need to create next occurrence (within 7 days)
                const now = new Date();
                const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

                const nextOccurrence = this.calculateNextOccurrence(
                    lastOccurrence,
                    event.recurrenceType!
                );

                if (nextOccurrence <= sevenDaysFromNow) {
                    // Create next occurrence
                    const duration = event.endTime
                        ? event.endTime.getTime() - event.startTime.getTime()
                        : 0;
                    const endTime = duration > 0 ? new Date(nextOccurrence.getTime() + duration) : null;

                    await prisma.event.create({
                        data: {
                            title: event.title,
                            description: event.description,
                            startTime: nextOccurrence,
                            endTime,
                            organizerId: event.organizerId,
                            locationId: event.locationId,
                            maxAttendees: event.maxAttendees,
                            isPrivate: event.isPrivate,
                            accessKey: event.accessKey,
                            isRecurring: false,
                            parentEventId: event.id,
                            status: 'UPCOMING'
                        }
                    });

                    logger.info(`Created next recurring instance for "${event.title}"`);
                }
            }
        } catch (error) {
            logger.error('Error processing recurring events:', error);
        }
    }
}