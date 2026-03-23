import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database.js';
import { AttendanceService } from '../services/attendance.service.js';
import { EventStatus } from '@prisma/client';

// User must be actively attending the event to post
export const canPostToEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { eventId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // If no eventId, this is a regular location post (allow)
    if (!eventId) {
      return next();
    }

    // Check if event exists and is live
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.status !== EventStatus.LIVE) {
      return res.status(403).json({
        success: false,
        message: 'Event is not currently live'
      });
    }

    // Check if event has ended
    if (event.endTime && new Date() > event.endTime) {
      return res.status(403).json({
        success: false,
        message: 'Event has ended'
      });
    }

    // Check if user is attending this event
    const isAttending = await AttendanceService.isUserAttending(userId, eventId);

    if (!isAttending) {
      return res.status(403).json({
        success: false,
        message: 'You must be attending the event to post content'
      });
    }

    next();
  } catch (error) {
    console.error('Event posting middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Middleware to ensure user can only attend one event at a time
 * Exception: WATCHERS can join multiple events
 */
export const singleEventAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { id: eventId } = req.params;
    const { role = 'WATCHER' } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // WATCHERS can join multiple events - skip check
    if (role === 'WATCHER') {
      return next();
    }

    // For POSTER and MODERATOR roles, check for concurrent attendance
    const currentAttendance = await AttendanceService.getCurrentAttendance(userId);

    if (currentAttendance && currentAttendance.eventId !== eventId) {
      return res.status(409).json({
        success: false,
        message: `You are already attending "${currentAttendance.event.title}". Leave that event first.`,
        currentEvent: {
          id: currentAttendance.event.id,
          title: currentAttendance.event.title,
          location: currentAttendance.event.location.name
        }
      });
    }

    next();
  } catch (error) {
    console.error('Single event attendance middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Middleware to check if user can join/leave events
 */
export const canManageAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { id: eventId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Only allow attendance management for live events
    if (event.status !== EventStatus.LIVE) {
      return res.status(403).json({
        success: false,
        message: 'Can only join/leave live events'
      });
    }

    next();
  } catch (error) {
    console.error('Attendance management middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};