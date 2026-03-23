import { Request, Response, NextFunction } from 'express';
import { LocationService } from '../services/location.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export class LocationController {
  static async createLocation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return sendError(res, 'Authentication required', undefined, 401);
      }

      const location = await LocationService.createLocation(req.body, userId);

      logger.info(`Location created: ${location.name} by user ${userId}`);
      return sendSuccess(res, 'Location created successfully', location, 201);
    } catch (error) {
      logger.error('Create location error:', error);
      next(error);
    }
  }

  static async getAllLocations(req: Request, res: Response, next: NextFunction) {
    try {
      const { latitude, longitude, radius } = req.query;

      let locations;
      if (latitude && longitude) {
        locations = await LocationService.getLocationsInRadius(
          Number.parseFloat(latitude as string), 
          Number.parseFloat(longitude as string), 
          radius ? Number.parseFloat(radius as string) : 5 
        );
      } else {
        locations = await LocationService.getAllLocations();
      }

      return sendSuccess(res, 'Locations retrieved successfully', locations);
    } catch (error) {
      logger.error('Get locations error:', error);
      next(error);
    }
  }

  static async getLocationById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const location = await LocationService.getLocationById(id);

      if (!location) {
        return sendError(res, 'Location not found', undefined, 404);
      }

      return sendSuccess(res, 'Location retrieved successfully', location);
    } catch (error) {
      logger.error('Get location error:', error);
      next(error);
    }
  }

  static async updateLocation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const location = await LocationService.updateLocation(id, req.body);

      logger.info(`Location updated: ${id}`);
      return sendSuccess(res, 'Location updated successfully', location);
    } catch (error) {
      logger.error('Update location error:', error);
      next(error);
    }
  }

  static async deleteLocation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await LocationService.deleteLocation(id);

      logger.info(`Location deleted: ${id}`);
      return sendSuccess(res, 'Location deleted successfully');
    } catch (error) {
      logger.error('Delete location error:', error);
      next(error);
    }
  }
}