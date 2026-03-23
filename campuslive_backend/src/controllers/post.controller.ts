import { Request, Response, NextFunction } from "express";
import { PostService } from "../services/post.service.js";
import { AttendanceService } from "../services/attendance.service.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import { EventStatus } from "@prisma/client";
import { AuthenticatedUser } from "../types/index.js";
import prisma from "../config/database.js";

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export class PostController {
  /**
   * Validate file upload
   */
  private static validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    const fileType = file.mimetype.split('/')[0];
    if (!['image', 'video'].includes(fileType)) {
      return { valid: false, error: 'Only images and videos allowed' };
    }

    logger.info('File upload attempt:', {
      fileName: file.originalname,
      size: file.size,
      type: file.mimetype
    });

    return { valid: true };
  }

  /**
   * Validate event for posting
   */
  private static async validateEventForPosting(
    eventId: string,
    userId: string
  ): Promise<{ valid: boolean; error?: string; statusCode?: number }> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return { valid: false, error: "Event not found", statusCode: 404 };
    }

    if (event.status !== EventStatus.LIVE) {
      return { valid: false, error: "Event is not currently live", statusCode: 403 };
    }

    if (event.endTime && new Date() > event.endTime) {
      return { valid: false, error: "Event has ended", statusCode: 403 };
    }

    const isAttending = await AttendanceService.isUserAttending(userId, eventId);
    if (!isAttending) {
      return {
        valid: false,
        error: "You must be attending the event to post content",
        statusCode: 403
      };
    }

    return { valid: true };
  }

  /**
   * Create a new post
   */
  static async createPost(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return sendError(res, "Authentication required", undefined, 401);
      }

      const { eventId } = req.body;

      // Validate file if present
      if (req.file) {
        const fileValidation = PostController.validateFile(req.file);
        if (!fileValidation.valid) {
          return sendError(res, 'Invalid file type', fileValidation.error, 400);
        }
      }

      // Validate event if posting to an event
      if (eventId) {
        const eventValidation = await PostController.validateEventForPosting(eventId, userId);
        if (!eventValidation.valid) {
          return sendError(
            res,
            eventValidation.error || "Event validation failed",
            undefined,
            eventValidation.statusCode || 403
          );
        }
      }

      // Create post
      const post = await PostService.createPost(req.body, userId, req.file);

      const message = eventId
        ? `Post created by user ${userId} for event ${eventId}`
        : `Post created by user ${userId} at location ${req.body.locationId}`;

      logger.info(message);

      return sendSuccess(res, "Post created successfully", post, 201);
    } catch (error) {
      logger.error("Create post error:", error);

      if (error instanceof Error) {
        if (error.message.includes('too large')) {
          return sendError(res, 'File too large', error.message, 413);
        }
        if (error.message.includes('Invalid file type')) {
          return sendError(res, 'Invalid file', error.message, 400);
        }
      }

      next(error);
    }
  }

  /**
   * Get posts by location
   */
  static async getPostsByLocation(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { locationId } = req.params;
      const page = Number.parseInt(req.query.page as string) || 1;
      const limit = Number.parseInt(req.query.limit as string) || 20;
      const eventOnly = req.query.eventOnly === "true";

      const result = await PostService.getPostsByLocation(
        locationId,
        page,
        limit,
        eventOnly
      );

      return sendSuccess(res, "Posts retrieved successfully", result);
    } catch (error) {
      logger.error("Get posts error:", error);
      next(error);
    }
  }

  /**
   * Get posts by event
   */
  static async getPostsByEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { eventId } = req.params;
      const page = Number.parseInt(req.query.page as string) || 1;
      const limit = Number.parseInt(req.query.limit as string) || 20;

      const posts = await PostService.getPostsByEvent(eventId, page, limit);

      return sendSuccess(res, "Event posts retrieved successfully", posts);
    } catch (error) {
      logger.error("Get event posts error:", error);
      next(error);
    }
  }

  /**
   * Validate post deletion permissions
   */
  private static async validatePostDeletion(
    postId: string,
    userId: string,
    isAdmin: boolean
  ): Promise<{
    valid: boolean;
    error?: string;
    statusCode?: number;
    post?: {
      userId: string;
      eventId: string | null;
      event: { status: EventStatus; endTime: Date | null } | null;
    }
  }> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        userId: true,
        eventId: true,
        event: {
          select: {
            status: true,
            endTime: true,
          },
        },
      },
    });

    if (!post) {
      return { valid: false, error: "Post not found", statusCode: 404 };
    }

    // Check ownership
    if (post.userId !== userId && !isAdmin) {
      return {
        valid: false,
        error: "Unauthorized to delete this post",
        statusCode: 403
      };
    }

    // Check event attendance for live events
    if (post.eventId && post.event?.status === EventStatus.LIVE && !isAdmin) {
      const isStillAttending = await AttendanceService.isUserAttending(
        userId,
        post.eventId
      );

      if (!isStillAttending) {
        return {
          valid: false,
          error: "You can only delete event posts while attending the event",
          statusCode: 403
        };
      }
    }

    return { valid: true, post };
  }

  /**
   * Delete a post
   */
  static async deletePost(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, "Authentication required", undefined, 401);
      }

      const isAdmin = req.user?.role === "ADMIN";

      // Validate deletion permissions
      const validation = await PostController.validatePostDeletion(id, userId, isAdmin);
      if (!validation.valid) {
        return sendError(
          res,
          validation.error || "Validation failed",
          undefined,
          validation.statusCode || 403
        );
      }

      // Delete post
      await PostService.deletePost(id, userId);

      logger.info(`Post deleted: ${id} by user ${userId}`);

      return sendSuccess(res, "Post deleted successfully");
    } catch (error) {
      logger.error("Delete post error:", error);

      if (error instanceof Error) {
        const statusCode = error.message.includes("not found") ? 404
          : error.message.includes("Unauthorized") ? 403
            : 500;

        return sendError(res, "Delete failed", error.message, statusCode);
      }

      next(error);
    }
  }

  /**
   * Get posts accessible to current user
   */
  static async getMyAccessiblePosts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, "Authentication required", undefined, 401);
      }

      // Get current attendance
      const currentAttendance = await AttendanceService.getCurrentAttendance(userId);

      // Get accessible posts
      const posts = await PostService.getPostsForUser(
        userId,
        currentAttendance?.eventId
      );

      return sendSuccess(res, "Accessible posts retrieved successfully", posts);
    } catch (error) {
      logger.error("Get accessible posts error:", error);
      next(error);
    }
  }
}