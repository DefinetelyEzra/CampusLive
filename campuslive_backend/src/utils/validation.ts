import { z } from 'zod';
import Joi from 'joi';

const emailSchema = Joi.string()
  .email()
  .custom((value, helpers) => {
    if (value === 'ezraagun@gmail.com' || /^[a-zA-Z0-9._%+-]+@pau\.edu\.ng$/.test(value)) {
      return value;
    }
    return helpers.error('string.pattern.base');
  })
  .required()
  .messages({
    'string.pattern.base': 'Email must be a valid Pan-Atlantic University email (@pau.edu.ng) or an authorized admin email',
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  });

// ISO datetime regex pattern
const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;

export const registerSchema = z.object({
  email: z.string().refine(
    (value: string) => {
      const { error } = emailSchema.validate(value);
      return !error;
    },
    {
      message: 'Invalid email format',
      path: ['email'],
    }
  ),
  username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username must be at most 50 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  ),
  role: z.enum(['STUDENT', 'FACULTY', 'ADMIN']).optional().default('STUDENT'),
});

export const loginSchema = z.object({
  email: z.string().refine(
    (value: string) => {
      const { error } = emailSchema.validate(value);
      return !error;
    },
    {
      message: 'Invalid email format',
      path: ['email'],
    }
  ),
  password: z.string().min(1, 'Password is required'),
});

export const createLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  description: z.string().optional(),
  latitude: z.number().min(-90, 'Latitude must be ≥ -90').max(90, 'Latitude must be ≤ 90'),
  longitude: z.number().min(-180, 'Longitude must be ≥ -180').max(180, 'Longitude must be ≤ 180'),
  category: z.string().min(1, 'Category is required'),
});

// Helper functions for event validation
const validateEventTiming = (data: any, ctx: z.RefinementCtx) => {
  if (!data.endTime) return;

  const start = new Date(data.startTime);
  const end = new Date(data.endTime);

  if (end <= start) {
    ctx.addIssue({
      code: 'custom',
      message: 'End time must be after start time',
      path: ['endTime']
    });
  }

  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (durationHours > 24) {
    ctx.addIssue({
      code: 'custom',
      message: 'Event duration cannot exceed 24 hours',
      path: ['endTime']
    });
  }
};

const validateRecurringEvent = (data: any, ctx: z.RefinementCtx) => {
  if (!data.isRecurring) return;

  if (!data.recurrenceType) {
    ctx.addIssue({
      code: 'custom',
      message: 'Recurrence type is required for recurring events',
      path: ['recurrenceType']
    });
  }

  if (!data.recurrenceEndDate) {
    ctx.addIssue({
      code: 'custom',
      message: 'Recurrence end date is required for recurring events',
      path: ['recurrenceEndDate']
    });
    return;
  }

  validateRecurrenceEndDate(data, ctx);
};

const validateRecurrenceEndDate = (data: any, ctx: z.RefinementCtx) => {
  const start = new Date(data.startTime);
  const recurrenceEnd = new Date(data.recurrenceEndDate);

  if (recurrenceEnd <= start) {
    ctx.addIssue({
      code: 'custom',
      message: 'Recurrence end date must be after start time',
      path: ['recurrenceEndDate']
    });
  }

  const spanDays = (recurrenceEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (spanDays > 365) {
    ctx.addIssue({
      code: 'custom',
      message: 'Recurrence span cannot exceed 1 year',
      path: ['recurrenceEndDate']
    });
  }
};


export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().max(500, 'Description too long').optional(),
  startTime: z.string().regex(datetimeRegex, 'Invalid start time format (expected ISO 8601)'),
  endTime: z.string().regex(datetimeRegex, 'Invalid end time format (expected ISO 8601)').optional(),
  locationId: z.string().min(1, 'Invalid location ID'),
  maxAttendees: z.number().int().positive('Max attendees must be positive').optional(),
  isPrivate: z.boolean().optional().default(false),
  isRecurring: z.boolean().optional().default(false),
  recurrenceType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  recurrenceEndDate: z.string().regex(datetimeRegex, 'Invalid recurrence end date format').optional(),
  locationBounds: z.object({
    centerLat: z.number().min(-90).max(90),
    centerLng: z.number().min(-180).max(180),
    radiusMeters: z.number().int().min(10).max(5000)
  }).optional()
}).superRefine((data, ctx) => {
  validateEventTiming(data, ctx);
  validateRecurringEvent(data, ctx);
});

export const updateEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long').optional(),
  description: z.string().max(500, 'Description too long').optional(),
  startTime: z.string().regex(datetimeRegex, 'Invalid start time format (expected ISO 8601)').optional(),
  endTime: z.string().regex(datetimeRegex, 'Invalid end time format (expected ISO 8601)').optional(),
}).superRefine((data, ctx) => {
  // Only validate timing if both times are provided
  if (data.startTime && data.endTime) {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);

    if (end <= start) {
      ctx.addIssue({
        code: 'custom',
        message: 'End time must be after start time',
        path: ['endTime']
      });
    }

    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationHours > 24) {
      ctx.addIssue({
        code: 'custom',
        message: 'Event duration cannot exceed 24 hours',
        path: ['endTime']
      });
    }
  }
});

export const createPostSchema = z.object({
  content: z.string().max(1000, 'Content too long').optional(),
  mediaType: z.enum(['IMAGE', 'VIDEO']).optional(),
  locationId: z.string().min(1, 'Invalid location ID'),
  eventId: z.string().min(1, 'Invalid event ID').optional(),
}).refine(
  (data) => {
    return data.content || data.mediaType;
  },
  {
    message: 'Post must have content or media',
    path: ['content'],
  }
);

// Helper function for join event validation
const validateJoinEventLocation = (data: any, ctx: z.RefinementCtx) => {
  if ((data.role === 'POSTER' || data.role === 'MODERATOR')) {
    if (data.latitude === undefined || data.longitude === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `Location is required to join as ${data.role}`,
        path: ['latitude']
      });
    }
  }
};

export const joinEventSchema = z.object({
  role: z.enum(['MODERATOR', 'POSTER', 'WATCHER']).default('WATCHER'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accessKey: z.string().length(6, 'Access key must be exactly 6 characters').regex(
    /^[A-Z0-9]+$/,
    'Access key must contain only uppercase letters and numbers'
  ).optional()
}).superRefine((data, ctx) => {
  validateJoinEventLocation(data, ctx);
});