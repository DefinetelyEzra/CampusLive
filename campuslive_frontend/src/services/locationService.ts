import type { NavigatorBattery } from "../types";
export class LocationService {
    private static lastPosition: GeolocationPosition | null = null;
    private static positionBuffer: Array<{ lat: number; lng: number; timestamp: number; accuracy: number }> = [];
    private static readonly BUFFER_SIZE = 3; 
    private static readonly MOVEMENT_THRESHOLD = 8; // 8 meters
    private static readonly UPDATE_INTERVAL = 5000; // 5000ms
    private static lastUpdateTime = 0;
    private static readonly MAX_ACCURACY = 30; // 30 meters

    // Location cache for handling temporary GPS issues
    private static readonly locationCache: Map<string, { position: GeolocationPosition; timestamp: number }> = new Map();
    private static readonly CACHE_DURATION = 30000; // 30 seconds

    // Background tracking state
    private static isBackgroundTracking = false;
    private static backgroundWatchId: number | undefined;

    static getCurrentPosition(): Promise<GeolocationPosition> {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0 // don't use cached positions
                }
            );
        });
    }

    /**
    * Get cached location if GPS temporarily unavailable
    */
    static getCachedLocation(key: string = 'default'): GeolocationPosition | null {
        const cached = this.locationCache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > this.CACHE_DURATION) {
            this.locationCache.delete(key);
            return null;
        }

        return cached.position;
    }

    /**
     * Cache current location
     */
    private static cacheLocation(position: GeolocationPosition, key: string = 'default'): void {
        this.locationCache.set(key, {
            position,
            timestamp: Date.now()
        });
    }

    static watchPosition(
        onSuccess: (position: GeolocationPosition) => void,
        onError: (error: GeolocationPositionError) => void
    ): number {
        if (!navigator.geolocation) {
            throw new Error('Geolocation is not supported');
        }

        const wrappedSuccess = (position: GeolocationPosition) => {
            // Filter out low accuracy readings
            if (position.coords.accuracy > this.MAX_ACCURACY) {
                console.log(`Ignoring low accuracy reading: ${position.coords.accuracy.toFixed(2)}m`);
                return;
            }

            // Check if enough time has passed since last update
            const now = Date.now();
            if (now - this.lastUpdateTime < this.UPDATE_INTERVAL) {
                return;
            }

            // Check if position has changed significantly
            if (this.lastPosition) {
                const distance = this.calculateDistance(
                    this.lastPosition.coords.latitude,
                    this.lastPosition.coords.longitude,
                    position.coords.latitude,
                    position.coords.longitude
                );

                // Ignore small movements (GPS jitter)
                if (distance < this.MOVEMENT_THRESHOLD) {
                    console.log(`Ignoring small movement: ${distance.toFixed(2)}m`);
                    return;
                }
            }

            // Add to position buffer for smoothing (with accuracy)
            this.positionBuffer.push({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                timestamp: now,
                accuracy: position.coords.accuracy
            });

            // Keep buffer size limited
            if (this.positionBuffer.length > this.BUFFER_SIZE) {
                this.positionBuffer.shift();
            }

            // Calculate smoothed position
            const smoothedPosition = this.getSmoothedPosition(position);

            // Update last position and time
            this.lastPosition = smoothedPosition;
            this.lastUpdateTime = now;

            // Call the original success callback with smoothed position
            onSuccess(smoothedPosition);
        };

        return navigator.geolocation.watchPosition(
            wrappedSuccess,
            onError,
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0 // Don't use cached positions
            }
        );
    }


    /**
     * Enable background location tracking with battery optimization
     */
    static enableBackgroundTracking(
        onSuccess: (position: GeolocationPosition) => void,
        onError: (error: GeolocationPositionError) => void
    ): void {
        if (this.isBackgroundTracking) {
            console.log('Background tracking already enabled');
            return;
        }

        // Use lower frequency for background tracking (battery optimization)
        const BACKGROUND_UPDATE_INTERVAL = 15000; // 15 seconds
        let lastBackgroundUpdate = 0;

        const backgroundSuccess = (position: GeolocationPosition) => {
            const now = Date.now();
            if (now - lastBackgroundUpdate < BACKGROUND_UPDATE_INTERVAL) {
                return;
            }

            lastBackgroundUpdate = now;
            this.cacheLocation(position, 'background');
            onSuccess(position);
        };

        this.backgroundWatchId = navigator.geolocation.watchPosition(
            backgroundSuccess,
            onError,
            {
                enableHighAccuracy: false, // Lower accuracy for battery saving
                timeout: 15000,
                maximumAge: 10000
            }
        );

        this.isBackgroundTracking = true;
        console.log('Background location tracking enabled');
    }

    /**
     * Disable background tracking
     */
    static disableBackgroundTracking(): void {
        if (this.backgroundWatchId !== undefined) {
            navigator.geolocation.clearWatch(this.backgroundWatchId);
            this.backgroundWatchId = undefined;
            this.isBackgroundTracking = false;
            console.log('Background location tracking disabled');
        }
    }

    static clearWatch(watchId: number): void {
        navigator.geolocation.clearWatch(watchId);
        this.lastPosition = null;
        this.positionBuffer = [];
        this.lastUpdateTime = 0;
    }

    private static getSmoothedPosition(currentPosition: GeolocationPosition): GeolocationPosition {
        if (this.positionBuffer.length < 2) {
            return currentPosition;
        }

        // Use accuracy-weighted average (more accurate positions have higher weight)
        let totalLat = 0;
        let totalLng = 0;
        let totalWeight = 0;

        for (const pos of this.positionBuffer) {
            // Inverse accuracy weighting - lower accuracy value = higher weight
            const weight = 1 / (pos.accuracy || 1);
            totalLat += pos.lat * weight;
            totalLng += pos.lng * weight;
            totalWeight += weight;
        }

        const avgLat = totalLat / totalWeight;
        const avgLng = totalLng / totalWeight;

        // Create a new position object with smoothed coordinates
        return {
            ...currentPosition,
            coords: {
                ...currentPosition.coords,
                latitude: avgLat,
                longitude: avgLng
            }
        };
    }

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

        return R * c;
    }

    static resetTracking(): void {
        this.lastPosition = null;
        this.positionBuffer = [];
        this.lastUpdateTime = 0;
        this.locationCache.clear();
        this.disableBackgroundTracking();
    }

    /**
     * Check battery level and adjust tracking accordingly
     */
    static async optimizeForBattery(): Promise<void> {
        if ('getBattery' in navigator) {
            try {
                const battery = await (navigator as NavigatorBattery).getBattery();
                const level = battery.level * 100;
                const charging = battery.charging;

                console.log(`Battery: ${level.toFixed(0)}%, Charging: ${charging}`);

                // If battery is low and not charging, use background tracking
                if (level < 20 && !charging && !this.isBackgroundTracking) {
                    console.log('Low battery detected, switching to background tracking');
                    this.enableBackgroundTracking(
                        (position: GeolocationPosition) => {
                            console.log('Background position update:', position.coords.latitude, position.coords.longitude);
                        },
                        (error: GeolocationPositionError) => {
                            console.error('Background tracking error:', error);
                        }
                    );
                }
            } catch (error) {
                console.warn('Battery API error:', error);
            }
        }
    }

    /**
     * Get location accuracy status
     */
    static getAccuracyStatus(): 'high' | 'medium' | 'low' | 'unknown' {
        if (!this.lastPosition) return 'unknown';

        const accuracy = this.lastPosition.coords.accuracy;
        if (accuracy <= 10) return 'high';
        if (accuracy <= 30) return 'medium';
        return 'low';
    }

    /**
     * Clear expired cache entries
     */
    static clearExpiredCache(): void {
        const now = Date.now();
        for (const [key, value] of this.locationCache.entries()) {
            if (now - value.timestamp > this.CACHE_DURATION) {
                this.locationCache.delete(key);
            }
        }
    }
}

// Clear expired cache every minute
if (typeof globalThis !== 'undefined') {
    setInterval(() => {
        LocationService.clearExpiredCache();
    }, 60000);
}