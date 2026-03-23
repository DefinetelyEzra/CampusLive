import prisma from "../config/database.js";
import { CreatePostRequest } from "../types/index.js";
import { UploadService } from "./upload.service.js";

export class PostService {
  static async createPost(
    data: CreatePostRequest,
    userId: string,
    file?: Express.Multer.File
  ) {
    let mediaUrl: string | undefined;
    let mediaType: "IMAGE" | "VIDEO" | undefined;

    if (file) {
      if (file.mimetype.startsWith("image/")) {
        mediaUrl = await UploadService.uploadImage(
          file.buffer,
          file.originalname,
          file.mimetype
        );
        mediaType = "IMAGE";
      } else if (file.mimetype.startsWith("video/")) {
        mediaUrl = await UploadService.uploadVideo(
          file.buffer,
          file.originalname
        );
        mediaType = "VIDEO";
      }
    }

    const post = await prisma.post.create({
      data: {
        content: data.content,
        mediaUrl,
        mediaType,
        userId,
        locationId: data.locationId,
        eventId: data.eventId,
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
        location: {
          select: { id: true, name: true },
        },
        event: {
          select: { id: true, title: true, isLive: true },
        },
      },
    });

    return post;
  }

  static async getPostsByLocation(
    locationId: string,
    page: number,
    limit: number,
    eventOnly: boolean = false
  ) {
    const skip = (page - 1) * limit;

    const whereClause: any = { locationId };

    if (eventOnly) {
      whereClause.eventId = { not: null };
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, username: true },
          },
          event: {
            select: {
              id: true,
              title: true,
              status: true,
              isLive: true,
            },
          },
          location: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.post.count({ where: whereClause }),
    ]);

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Updated getPostsByEvent method with pagination
  static async getPostsByEvent(
    eventId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { eventId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, username: true },
          },
          location: {
            select: { id: true, name: true },
          },
          event: {
            select: {
              id: true,
              title: true,
              status: true,
              isLive: true,
            },
          },
        },
      }),
      prisma.post.count({ where: { eventId } }),
    ]);

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get posts accessible to a specific user
  static async getPostsForUser(userId: string, currentEventId?: string) {
    const whereClause: any = {
      OR: [
        // Regular location posts (not event-specific)
        { eventId: null },
        // Posts from events the user is currently attending
        ...(currentEventId ? [{ eventId: currentEventId }] : []),
      ],
    };

    const posts = await prisma.post.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 50, // Limit for performance
      include: {
        user: {
          select: { id: true, username: true },
        },
        location: {
          select: { id: true, name: true },
        },
        event: {
          select: {
            id: true,
            title: true,
            status: true,
            isLive: true,
          },
        },
      },
    });

    return posts;
  }

  // Check if user can view a specific post
  static async canUserViewPost(
    userId: string,
    postId: string
  ): Promise<boolean> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        eventId: true,
        event: {
          select: { status: true },
        },
      },
    });

    if (!post) return false;

    // If post is not event-specific, anyone can view
    if (!post.eventId) return true;

    // If post is event-specific, user must be attending the event
    const isAttending = await prisma.eventParticipant.findUnique({
      where: {
        eventId_userId: {
          userId,
          eventId: post.eventId,
        },
      },
    });

    return isAttending?.isActive || false;
  }

  static async deletePost(id: string, userId: string) {
    const post = await prisma.post.findUnique({
      where: { id },
      select: { userId: true, mediaUrl: true },
    });

    if (!post) {
      throw new Error("Post not found");
    }

    if (post.userId !== userId) {
      throw new Error("Unauthorized to delete this post");
    }

    // Delete media file if exists
    if (post.mediaUrl) {
      try {
        await UploadService.deleteFile(post.mediaUrl);
      } catch (error) {
        // Log error but don't fail the deletion
        console.error("Failed to delete media file:", error);
      }
    }

    await prisma.post.delete({ where: { id } });
  }
}
