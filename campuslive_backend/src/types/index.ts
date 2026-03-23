import { EventStatus } from "@prisma/client";

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: string;
}

export interface CreateLocationRequest {
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  category: string;
}

export interface CreatePostRequest {
  content?: string;
  locationId: string;
  eventId?: string;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  locationId: string;
  maxAttendees?: number;
  
  // Advanced options
  isPrivate?: boolean;
  isRecurring?: boolean;
  recurrenceType?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  recurrenceEndDate?: string; 
  skipConflicts?: boolean;
}

export interface EventAccessKeyResponse {
  eventId: string;
  accessKey: string;
  message: string;
}

export interface EventWithAttendance {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isLive: boolean;
  status: EventStatus;
  maxAttendees?: number;
  attendeeCount: number;
  isUserAttending: boolean;
  canJoin: boolean;
  organizer: {
    id: string;
    username: string;
  };
  location: {
    id: string;
    name: string;
  };
}

export interface AttendanceInfo {
  id: string;
  joinedAt: Date;
  leftAt?: Date;
  isActive: boolean;
  userId: string;
  eventId: string;
  event: {
    id: string;
    title: string;
    location: {
      id: string;
      name: string;
    };
  };
}

export interface PostWithEvent {
  id: string;
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
  createdAt: Date;
  user: {
    id: string;
    username: string;
  };
  location: {
    id: string;
    name: string;
  };
  event?: {
    id: string;
    title: string;
    status: EventStatus;
    isLive: boolean;
  };
}