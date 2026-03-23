import prisma from '../config/database.js';
import { EventStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';

interface ConflictingEvent {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    organizer: {
        username: string;
    };
}

interface ConflictCheckResult {
    hasConflict: boolean;
    conflictingEvents: ConflictingEvent[];
    message?: string;
}

export class EventConflictService {
    /**
     * Default event duration if not specified (2 hours)
     */
    private static readonly DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

    /**
     * Minimum buffer time between events at same location (5 minutes)
     */
    private static readonly BUFFER_TIME_MS = 5 * 60 * 1000;

    /**
     * Ensure event has an end time, calculate default if needed
     */
    private static ensureEndTime(startTime: Date, endTime?: Date): Date {
        if (endTime) return endTime;
        return new Date(startTime.getTime() + this.DEFAULT_DURATION_MS);
    }

    /**
     * Check if two time ranges overlap (with buffer)
     */
    private static timeRangesOverlap(
        start1: Date,
        end1: Date,
        start2: Date,
        end2: Date
    ): boolean {
        // Add buffer time to both ranges
        const bufferedEnd1 = new Date(end1.getTime() + this.BUFFER_TIME_MS);
        const bufferedStart2 = new Date(start2.getTime() - this.BUFFER_TIME_MS);
        const bufferedEnd2 = new Date(end2.getTime() + this.BUFFER_TIME_MS);
        const bufferedStart1 = new Date(start1.getTime() - this.BUFFER_TIME_MS);

        return bufferedStart1 < bufferedEnd2 && bufferedEnd1 > bufferedStart2;
    }

    /**
     * Check for conflicts with existing events at a location
     */
    static async checkLocationTimeConflict(
        locationId: string,
        startTime: Date,
        endTime: Date,
        excludeEventId?: string
    ): Promise<ConflictCheckResult> {
        try {
            // Find all events at this location that could potentially conflict
            const potentialConflicts = await prisma.event.findMany({
                where: {
                    locationId,
                    id: excludeEventId ? { not: excludeEventId } : undefined,
                    status: {
                        in: [EventStatus.UPCOMING, EventStatus.LIVE]
                    },
                    OR: [
                        {
                            // Events that start during our time range
                            startTime: {
                                gte: startTime,
                                lt: endTime
                            }
                        },
                        {
                            // Events that end during our time range
                            endTime: {
                                gt: startTime,
                                lte: endTime
                            }
                        },
                        {
                            // Events that completely encompass our time range
                            AND: [
                                { startTime: { lte: startTime } },
                                { endTime: { gte: endTime } }
                            ]
                        },
                        {
                            // Our event encompasses their time range
                            AND: [
                                { startTime: { gte: startTime } },
                                { endTime: { lte: endTime } }
                            ]
                        }
                    ]
                },
                select: {
                    id: true,
                    title: true,
                    startTime: true,
                    endTime: true,
                    organizer: {
                        select: {
                            username: true
                        }
                    }
                }
            });

            // Filter to actual conflicts considering buffer time
            const conflictingEvents: ConflictingEvent[] = potentialConflicts
                .filter(event => {
                    const eventEnd = this.ensureEndTime(event.startTime, event.endTime || undefined);
                    return this.timeRangesOverlap(startTime, endTime, event.startTime, eventEnd);
                })
                .map(event => ({
                    id: event.id,
                    title: event.title,
                    startTime: event.startTime,
                    endTime: this.ensureEndTime(event.startTime, event.endTime || undefined),
                    organizer: event.organizer
                }));

            if (conflictingEvents.length === 0) {
                return { hasConflict: false, conflictingEvents: [] };
            }

            const conflictDescriptions = conflictingEvents.map(event => {
                const start = event.startTime.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const end = event.endTime.toLocaleString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                return `"${event.title}" (${start} - ${end})`;
            }).join(', ');

            return {
                hasConflict: true,
                conflictingEvents,
                message: `Location is already booked during this time. Conflicts with: ${conflictDescriptions}`
            };
        } catch (error) {
            logger.error('Error checking location-time conflict:', error);
            throw new Error('Failed to check for scheduling conflicts');
        }
    }

    /**
     * Check conflicts for multiple recurring event instances
     */
    static async checkRecurringConflicts(
        locationId: string,
        instances: Array<{ startTime: Date; endTime: Date }>
    ): Promise<{
        validInstances: Array<{ startTime: Date; endTime: Date }>;
        conflictingInstances: Array<{
            startTime: Date;
            endTime: Date;
            conflicts: ConflictingEvent[];
        }>;
    }> {
        const validInstances: Array<{ startTime: Date; endTime: Date }> = [];
        const conflictingInstances: Array<{
            startTime: Date;
            endTime: Date;
            conflicts: ConflictingEvent[];
        }> = [];

        for (const instance of instances) {
            const result = await this.checkLocationTimeConflict(
                locationId,
                instance.startTime,
                instance.endTime
            );

            if (result.hasConflict) {
                conflictingInstances.push({
                    startTime: instance.startTime,
                    endTime: instance.endTime,
                    conflicts: result.conflictingEvents
                });
            } else {
                validInstances.push(instance);
            }
        }

        return { validInstances, conflictingInstances };
    }

    /**
     * Check if a location is available to go live right now
     */
    static async checkLocationAvailableForLive(
        locationId: string,
        excludeEventId?: string
    ): Promise<ConflictCheckResult> {
        try {
            const liveEvents = await prisma.event.findMany({
                where: {
                    locationId,
                    id: excludeEventId ? { not: excludeEventId } : undefined,
                    status: EventStatus.LIVE,
                    isLive: true
                },
                select: {
                    id: true,
                    title: true,
                    startTime: true,
                    endTime: true,
                    organizer: {
                        select: {
                            username: true
                        }
                    }
                }
            });

            if (liveEvents.length === 0) {
                return { hasConflict: false, conflictingEvents: [] };
            }

            const conflictingEvent = liveEvents[0];
            return {
                hasConflict: true,
                conflictingEvents: liveEvents.map(event => ({
                    ...event,
                    endTime: this.ensureEndTime(event.startTime, event.endTime || undefined)
                })),
                message: `Cannot start event. "${conflictingEvent.title}" is currently live at this location.`
            };
        } catch (error) {
            logger.error('Error checking location availability:', error);
            throw new Error('Failed to check location availability');
        }
    }

    /**
     * Get detailed conflict information for user feedback
     */
    static async getConflictDetails(
        locationId: string,
        startTime: Date,
        endTime: Date
    ): Promise<ConflictingEvent[]> {
        const result = await this.checkLocationTimeConflict(
            locationId,
            startTime,
            endTime
        );
        return result.conflictingEvents;
    }

    /**
     * Calculate suggested alternative times (next available slot)
     */
    static async suggestAlternativeTime(
        locationId: string,
        desiredStartTime: Date,
        duration: number
    ): Promise<{ startTime: Date; endTime: Date } | null> {
        try {
            const desiredEndTime = new Date(desiredStartTime.getTime() + duration);

            // Check if desired time is available
            const initialCheck = await this.checkLocationTimeConflict(
                locationId,
                desiredStartTime,
                desiredEndTime
            );

            if (!initialCheck.hasConflict) {
                return { startTime: desiredStartTime, endTime: desiredEndTime };
            }

            // Find next available slot after the conflicting events
            const latestConflictEnd = Math.max(
                ...initialCheck.conflictingEvents.map(e => e.endTime.getTime())
            );

            const nextAvailableStart = new Date(latestConflictEnd + this.BUFFER_TIME_MS);
            const nextAvailableEnd = new Date(nextAvailableStart.getTime() + duration);

            // Verify this slot is actually available
            const verifyCheck = await this.checkLocationTimeConflict(
                locationId,
                nextAvailableStart,
                nextAvailableEnd
            );

            if (!verifyCheck.hasConflict) {
                return { startTime: nextAvailableStart, endTime: nextAvailableEnd };
            }

            return null; // Too complex to suggest, let user decide
        } catch (error) {
            logger.error('Error suggesting alternative time:', error);
            return null;
        }
    }
}