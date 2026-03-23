import prisma from '../config/database.js';

export class GeolocationService {

    /**
     * Set or update event location bounds with PostGIS geometry
     */
    static async setEventLocationBound(
        eventId: string,
        centerLat: number,
        centerLng: number,
        radiusMeters: number = 100
    ) {
        // First, upsert the basic record
        const bound = await prisma.locationBound.upsert({
            where: { eventId },
            update: {
                centerLat,
                centerLng,
                radiusMeters
            },
            create: {
                eventId,
                centerLat,
                centerLng,
                radiusMeters
            }
        });

        // The trigger will automatically update the geometry columns
        return bound;
    }

    /**
     * Validate user location against event bounds using PostGIS
     */
    static async validateUserLocation(
        eventId: string,
        userLat: number,
        userLng: number
    ): Promise<{
        isWithinBounds: boolean;
        distance: number;
        radiusMeters: number;
    }> {
        // Validate inputs
        if (!eventId) {
            throw new TypeError('Event ID is required for location validation');
        }

        if (typeof userLat !== 'number' || typeof userLng !== 'number' ||
            Number.isNaN(userLat) || Number.isNaN(userLng)) {
            throw new TypeError('Valid latitude and longitude are required');
        }

        // Check if coordinates are reasonable (basic sanity check)
        if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
            throw new TypeError('Latitude or longitude out of valid range');
        }

        const locationBound = await prisma.locationBound.findUnique({
            where: { eventId }
        });

        if (!locationBound) {
            throw new Error('Event location bounds not configured');
        }

        // Use PostGIS for accurate distance calculation
        const result = await prisma.$queryRaw<Array<{
            distance: number;
            is_within_bounds: boolean;
        }>>`
            SELECT 
                ST_Distance(
                    center_geom::geography,
                    ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography
                ) as distance,
                ST_DWithin(
                    center_geom::geography,
                    ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography,
                    ${locationBound.radiusMeters}::float
                ) as is_within_bounds
            FROM location_bounds
            WHERE "eventId" = ${eventId}
        `;

        if (!result || result.length === 0) {
            throw new Error('Failed to calculate distance');
        }

        const { distance, is_within_bounds } = result[0];

        return {
            isWithinBounds: is_within_bounds,
            distance: Math.round(distance), // Distance in meters
            radiusMeters: locationBound.radiusMeters
        };
    }

    /**
     * Update user's last location check timestamp
     */
    static async updateUserLocation(eventId: string, userId: string) {
        await prisma.eventParticipant.updateMany({
            where: {
                eventId,
                userId,
                isActive: true
            },
            data: {
                lastLocationCheck: new Date()
            }
        });
    }

    /**
     * Check if a point is within campus bounds using PostGIS
     */
    static async isWithinCampusBounds(latitude: number, longitude: number): Promise<boolean> {
        // Validate inputs
        if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
            Number.isNaN(latitude) || Number.isNaN(longitude)) {
            return false;
        }

        // PAU Campus bounds polygon (Southwest, Southeast, Northeast, Northwest, close)
        const campusBounds = [
            [6.48, 3.85],    // Southwest
            [6.493, 3.85],   // Southeast  
            [6.493, 3.862],  // Northeast
            [6.48, 3.862],   // Northwest
            [6.48, 3.85]     // Close polygon
        ];

        // Convert bounds to WKT polygon format for PostGIS (note: lng lat order for PostGIS)
        const polygonCoordinates = campusBounds.map(([lat, lng]) => `${lng} ${lat}`).join(', ');
        const wktPolygon = `POLYGON((${polygonCoordinates}))`;

        try {
            const result = await prisma.$queryRaw<Array<{ is_within: boolean }>>`
                SELECT ST_Within(
                    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326),
                    ST_GeomFromText(${wktPolygon}, 4326)
                ) as is_within
            `;

            return result[0]?.is_within ?? false;
        } catch (error) {
            console.error('Error checking campus bounds:', error);
            // Fallback to simple bounds check
            return (
                latitude >= 6.48 && latitude <= 6.493 &&
                longitude >= 3.85 && longitude <= 3.862
            );
        }
    }

    /**
     * Calculate distance between two points using Haversine formula
     * (Fallback method if PostGIS is not available)
     */
    static calculateDistance(
        lat1: number,
        lng1: number,
        lat2: number,
        lng2: number
    ): number {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    }
}