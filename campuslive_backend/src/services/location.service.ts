import prisma from '../config/database.js';
import { CreateLocationRequest } from '../types/index.js';

export class LocationService {
  static async createLocation(data: CreateLocationRequest, userId: string) {
    const location = await prisma.location.create({
      data: {
        name: data.name,
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
        category: data.category,
      },
    });

    return location;
  }

  static async getAllLocations() {
    const locations = await prisma.location.findMany({
      where: { isActive: true },
      include: {
        posts: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, username: true }
            }
          }
        },
        events: {
          where: { 
            status: 'LIVE',
            isLive: true 
          },
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      },
    });

    return locations;
  }

  static async getLocationById(id: string) {
    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        posts: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, username: true }
            },
            event: {
              select: { id: true, title: true, isLive: true }
            }
          }
        },
        events: {
          orderBy: { createdAt: 'desc' }
        }
      },
    });

    return location;
  }

  static async updateLocation(id: string, data: Partial<CreateLocationRequest>) {
    const location = await prisma.location.update({
      where: { id },
      data,
    });

    return location;
  }

  static async deleteLocation(id: string) {
    await prisma.location.update({
      where: { id },
      data: { isActive: false },
    });
  }

  static async getLocationsInRadius(latitude: number, longitude: number, radiusKm: number = 5) {
    // Simple distance calculation (for production, use PostGIS)
    const locations = await prisma.location.findMany({
      where: { isActive: true },
    });

    return locations.filter(location => {
      const distance = this.calculateDistance(
        latitude, longitude,
        location.latitude, location.longitude
      );
      return distance <= radiusKm;
    });
  }

  // Haversine Formula
  public static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}