import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../config/s3.js';
import sharp from 'sharp';
import { logger } from '../utils/logger.js';
import { randomBytes } from 'node:crypto';

interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
}

interface VideoMetadata {
  duration?: number;
  width?: number;
  height?: number;
  size: number;
}

export class UploadService {
  private static readonly BUCKET_NAME = process.env.AWS_S3_BUCKET!;
  private static readonly MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
  private static readonly MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly CDN_URL = process.env.CDN_URL;

  /**
   * Generate unique filename with timestamp and random hash
   */
  private static generateFileName(originalName: string, prefix: string): string {
    const ext = originalName.split('.').pop()?.toLowerCase() || '';
    const hash = randomBytes(8).toString('hex');
    const timestamp = Date.now();
    return `${prefix}/${timestamp}-${hash}.${ext}`;
  }

  /**
   * Get optimized URL (CDN if available, otherwise S3)
   */
  private static getOptimizedUrl(key: string): string {
    if (this.CDN_URL) {
      return `${this.CDN_URL}/${key}`;
    }
    return `https://${this.BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }

  /**
   * Upload and optimize image with multiple quality levels
   */
  static async uploadImage(
    file: Buffer,
    fileName: string,
    mimeType: string,
    options: ImageCompressionOptions = {}
  ): Promise<string> {
    try {
      if (file.length > this.MAX_IMAGE_SIZE) {
        throw new Error('Image file too large. Maximum size is 20MB');
      }

      const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 85,
        format = 'jpeg'
      } = options;

      // Get image metadata
      const metadata = await sharp(file).metadata();
      logger.info('Original image:', {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: file.length
      });

      // Optimize image based on format
      let optimizedImage: Buffer;
      let outputFormat: string;

      if (format === 'webp') {
        optimizedImage = await sharp(file)
          .rotate() // Auto-rotate based on EXIF
          .resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality, effort: 4 })
          .toBuffer();
        outputFormat = 'image/webp';
      } else if (format === 'png' && metadata.hasAlpha) {
        // Preserve transparency for PNG
        optimizedImage = await sharp(file)
          .rotate()
          .resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .png({ quality, compressionLevel: 9 })
          .toBuffer();
        outputFormat = 'image/png';
      } else {
        // Default to JPEG
        optimizedImage = await sharp(file)
          .rotate()
          .resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality, progressive: true })
          .toBuffer();
        outputFormat = 'image/jpeg';
      }

      const compressionRatio = ((1 - optimizedImage.length / file.length) * 100).toFixed(2);
      logger.info('Image compressed:', {
        originalSize: file.length,
        optimizedSize: optimizedImage.length,
        compressionRatio: `${compressionRatio}%`
      });

      // Generate unique key
      const key = this.generateFileName(fileName, 'images');

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.BUCKET_NAME,
        Key: key,
        Body: optimizedImage,
        ContentType: outputFormat,
        CacheControl: 'max-age=31536000', // 1 year
        Metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
          compressionRatio
        }
      });

      await s3Client.send(command);

      const imageUrl = this.getOptimizedUrl(key);
      logger.info(`Image uploaded successfully: ${imageUrl}`);

      return imageUrl;
    } catch (error) {
      logger.error('Image upload failed:', error);
      throw new Error('Failed to upload image');
    }
  }

  /**
   * Upload video with basic validation
   */
  static async uploadVideo(file: Buffer, fileName: string): Promise<string> {
    try {
      if (file.length > this.MAX_VIDEO_SIZE) {
        throw new Error(`Video file too large. Maximum size is ${this.MAX_VIDEO_SIZE / (1024 * 1024)}MB`);
      }

      const metadata: VideoMetadata = {
        size: file.length
      };

      logger.info('Uploading video:', metadata);

      // Generate unique key
      const key = this.generateFileName(fileName, 'videos');

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.BUCKET_NAME,
        Key: key,
        Body: file,
        ContentType: 'video/mp4',
        CacheControl: 'max-age=31536000',
        Metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
          size: metadata.size.toString()
        }
      });

      await s3Client.send(command);

      const videoUrl = this.getOptimizedUrl(key);
      logger.info(`Video uploaded successfully: ${videoUrl}`);

      return videoUrl;
    } catch (error) {
      logger.error('Video upload failed:', error);
      throw new Error('Failed to upload video');
    }
  }

  /**
   * Create thumbnail from video (first frame)
   */

  /**
static async createVideoThumbnail(file: Buffer, fileName: string): Promise<string> {
  try {
    // Extract first frame using sharp (works for video formats supported by libvips)
    // For better video support, you would need ffmpeg-static package
    logger.info('Generating video thumbnail for:', fileName);
    
    // Note: For production use with proper video support, install:
    // npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg
    // Then use the implementation below:
    
    const ffmpeg = await import('fluent-ffmpeg').catch(() => null);
    
    if (!ffmpeg) {
      logger.warn('ffmpeg not available, skipping thumbnail generation');
      throw new Error('Video thumbnail generation requires ffmpeg');
    }

    // Save buffer to temp file
    const tempVideoPath = `/tmp/video-${Date.now()}-${fileName}`;
    const tempThumbPath = `/tmp/thumb-${Date.now()}.jpg`;
    
    const fs = await import('fs/promises');
    await fs.writeFile(tempVideoPath, file);

    return new Promise((resolve, reject) => {
      ffmpeg.default(tempVideoPath)
        .screenshots({
          count: 1,
          folder: '/tmp',
          filename: `thumb-${Date.now()}.jpg`,
          size: '1920x1080'
        })
        .on('end', async () => {
          try {
            // Read the generated thumbnail
            const thumbnailBuffer = await fs.readFile(tempThumbPath);
            
            // Upload thumbnail using the same logic as uploadImage
            const thumbnailUrl = await this.uploadImage(
              thumbnailBuffer,
              `${fileName}-thumb.jpg`,
              'image/jpeg',
              { maxWidth: 1920, maxHeight: 1080, quality: 80 }
            );
            
            // Cleanup temp files
            await fs.unlink(tempVideoPath).catch(() => {});
            await fs.unlink(tempThumbPath).catch(() => {});
            
            logger.info('Video thumbnail created successfully:', thumbnailUrl);
            resolve(thumbnailUrl);
          } catch (error) {
            logger.error('Failed to process thumbnail:', error);
            reject(error);
          }
        })
        .on('error', (error: Error) => {
          logger.error('FFmpeg thumbnail generation failed:', error);
          reject(error);
        });
    });
  } catch (error) {
    logger.error('Thumbnail creation failed:', error);
    throw new Error('Failed to create video thumbnail');
  }
}
   */


  /**
   * Delete file from S3
   */
  static async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract key from URL
      let key: string;
      if (fileUrl.includes('amazonaws.com/')) {
        key = fileUrl.split('.amazonaws.com/')[1];
      } else if (this.CDN_URL && fileUrl.startsWith(this.CDN_URL)) {
        key = fileUrl.replace(`${this.CDN_URL}/`, '');
      } else {
        throw new Error('Invalid file URL format');
      }

      const command = new DeleteObjectCommand({
        Bucket: this.BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
      logger.info(`File deleted successfully: ${key}`);
    } catch (error) {
      logger.error('File deletion failed:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Validate file type
   */
  static validateFileType(mimeType: string): 'image' | 'video' | null {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return null;
  }

  /**
   * Get file size in human readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}