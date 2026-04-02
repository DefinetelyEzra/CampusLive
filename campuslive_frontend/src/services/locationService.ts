import type { NavigatorBattery } from '../types';

/**
 * LocationService — device geolocation with live tracking.
 *
 * Key design decisions vs. the previous version:
 *
 * 1. GeolocationCoordinates spread fix
 *    Browser's GeolocationCoordinates properties are prototype getters, NOT own
 *    enumerable properties.  `{ ...coords }` produces `{}` — losing accuracy,
 *    altitude, heading, speed.  We now copy each property explicitly.
 *
 * 2. Accuracy threshold relaxed (100 m)
 *    Mobile browsers — especially indoors or on fresh GPS lock — routinely report
 *    50–200 m accuracy.  The old 30 m filter silently dropped almost every reading.
 *
 * 3. Movement threshold removed from the watcher
 *    The threshold was suppressing real slow movements and causing the marker to
 *    freeze.  Deduplication now uses only the time gate (UPDATE_INTERVAL).
 *
 * 4. Smoothing is optional and non-lagging
 *    We keep a small Kalman-inspired exponential moving average instead of a
 *    fixed buffer average, so old positions don't drag the marker to a stale spot.
 *
 * 5. Background tracking uses a separate watch with coarser options.
 */
export class LocationService {
    // ── tuneable constants ────────────────────────────────────────────────────
    private static readonly UPDATE_INTERVAL = 3000;  // ms — minimum gap between callbacks
    private static readonly MAX_ACCURACY = 100;   // m  — drop obviously bad readings (e.g. 500 m Wi-Fi only)
    private static readonly EMA_ALPHA = 0.6;   // exponential moving average weight for newest reading

    // ── internal state ────────────────────────────────────────────────────────
    private static lastUpdateTime = 0;
    private static emaLat: number | null = null;
    private static emaLng: number | null = null;

    private static isBackgroundTracking = false;
    private static backgroundWatchId: number | undefined;

    private static readonly locationCache = new Map<string, { position: GeolocationPosition; timestamp: number }>();
    private static readonly CACHE_DURATION = 30_000; // ms

    // ── public API ────────────────────────────────────────────────────────────

    /** One-shot position request. */
    static getCurrentPosition(): Promise<GeolocationPosition> {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported'));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10_000,
                maximumAge: 0,
            });
        });
    }

    /**
     * Continuous position watch with filtering and smoothing.
     *
     * Returns the watchId so the caller can clear it with `clearWatch()`.
     */
    static watchPosition(
        onSuccess: (position: GeolocationPosition) => void,
        onError: (error: GeolocationPositionError) => void,
    ): number {
        if (!navigator.geolocation) throw new Error('Geolocation is not supported');

        const wrapped = (raw: GeolocationPosition) => {
            // 1. Drop readings that are obviously wrong (no-GPS, Wi-Fi only fallback)
            if (raw.coords.accuracy > this.MAX_ACCURACY) {
                console.debug(`[LocationService] Dropped low-accuracy reading: ${raw.coords.accuracy.toFixed(0)} m`);
                return;
            }

            // 2. Time gate — don't flood the UI
            const now = Date.now();
            if (now - this.lastUpdateTime < this.UPDATE_INTERVAL) return;
            this.lastUpdateTime = now;

            // 3. Exponential moving average — smooth without lagging
            const smoothed = this.applyEMA(raw);

            // 4. Cache for offline / GPS gap recovery
            this.cacheLocation(smoothed, 'watch');

            onSuccess(smoothed);
        };

        return navigator.geolocation.watchPosition(wrapped, onError, {
            enableHighAccuracy: true,
            timeout: 10_000,
            maximumAge: 0,
        });
    }

    /** Stop a watch and reset smoothing state. */
    static clearWatch(watchId: number): void {
        navigator.geolocation.clearWatch(watchId);
        this.resetSmoothingState();
    }

    // ── background tracking (battery-optimised) ───────────────────────────────

    static enableBackgroundTracking(
        onSuccess: (position: GeolocationPosition) => void,
        onError: (error: GeolocationPositionError) => void,
    ): void {
        if (this.isBackgroundTracking) return;

        const BACKGROUND_INTERVAL = 15_000;
        let lastBgUpdate = 0;

        this.backgroundWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                const now = Date.now();
                if (now - lastBgUpdate < BACKGROUND_INTERVAL) return;
                lastBgUpdate = now;
                this.cacheLocation(pos, 'background');
                onSuccess(pos);
            },
            onError,
            { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10_000 },
        );

        this.isBackgroundTracking = true;
        console.debug('[LocationService] Background tracking enabled');
    }

    static disableBackgroundTracking(): void {
        if (this.backgroundWatchId !== undefined) {
            navigator.geolocation.clearWatch(this.backgroundWatchId);
            this.backgroundWatchId = undefined;
            this.isBackgroundTracking = false;
            console.debug('[LocationService] Background tracking disabled');
        }
    }

    // ── cache ─────────────────────────────────────────────────────────────────

    static getCachedLocation(key = 'default'): GeolocationPosition | null {
        const cached = this.locationCache.get(key);
        if (!cached) return null;
        if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
            this.locationCache.delete(key);
            return null;
        }
        return cached.position;
    }

    static clearExpiredCache(): void {
        const now = Date.now();
        for (const [key, value] of this.locationCache) {
            if (now - value.timestamp > this.CACHE_DURATION) {
                this.locationCache.delete(key);
            }
        }
    }

    // ── utilities ─────────────────────────────────────────────────────────────

    /** Haversine distance in metres. */
    static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6_371_000;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lng2 - lng1) * Math.PI) / 180;
        const a =
            Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    static getAccuracyStatus(): 'high' | 'medium' | 'low' | 'unknown' {
        const pos = this.getCachedLocation('watch');
        if (!pos) return 'unknown';
        const acc = pos.coords.accuracy;
        if (acc <= 10) return 'high';
        if (acc <= 50) return 'medium';
        return 'low';
    }

    static async optimizeForBattery(): Promise<void> {
        if (!('getBattery' in navigator)) return;
        try {
            const battery = await (navigator as NavigatorBattery).getBattery();
            if (battery.level < 0.2 && !battery.charging && !this.isBackgroundTracking) {
                console.debug('[LocationService] Low battery — enabling background tracking');
                this.enableBackgroundTracking(
                    (p) => console.debug('[LocationService] Background update', p.coords.latitude, p.coords.longitude),
                    (e) => console.error('[LocationService] Background error', e),
                );
            }
        } catch (e) {
            console.warn('[LocationService] Battery API unavailable', e);
        }
    }

    static resetTracking(): void {
        this.resetSmoothingState();
        this.locationCache.clear();
        this.disableBackgroundTracking();
    }

    // ── private helpers ───────────────────────────────────────────────────────

    /**
     * Exponential moving average applied to lat/lng.
     *
     * Newest reading is weighted by EMA_ALPHA (0.6), history by (1 - alpha).
     * This keeps the marker responsive while still smoothing out GPS jitter.
     * Critically, it does NOT lag behind old buffer positions like a fixed-window
     * average does.
     *
     * We also explicitly copy every GeolocationCoordinates property here because
     * `{ ...coords }` does NOT work — those are prototype getters, not own props.
     */
    private static applyEMA(raw: GeolocationPosition): GeolocationPosition {
        const { latitude, longitude } = raw.coords;

        if (this.emaLat === null || this.emaLng === null) {
            // First reading — initialise
            this.emaLat = latitude;
            this.emaLng = longitude;
        } else {
            this.emaLat = this.EMA_ALPHA * latitude + (1 - this.EMA_ALPHA) * this.emaLat;
            this.emaLng = this.EMA_ALPHA * longitude + (1 - this.EMA_ALPHA) * this.emaLng;
        }

        // Explicit property copy — avoids the prototype-getter spread bug
        const smoothedCoords: GeolocationCoordinates = {
            latitude: this.emaLat,
            longitude: this.emaLng,
            accuracy: raw.coords.accuracy,
            altitude: raw.coords.altitude,
            altitudeAccuracy: raw.coords.altitudeAccuracy,
            heading: raw.coords.heading,
            speed: raw.coords.speed,
            // GeolocationCoordinates also has a toJSON method in some runtimes
            toJSON() {
                return {
                    latitude: this.latitude,
                    longitude: this.longitude,
                    accuracy: this.accuracy,
                    altitude: this.altitude,
                    altitudeAccuracy: this.altitudeAccuracy,
                    heading: this.heading,
                    speed: this.speed,
                };
            },
        };

        return {
            coords: smoothedCoords,
            timestamp: raw.timestamp,
            toJSON() { return { coords: this.coords.toJSON(), timestamp: this.timestamp }; },
        };
    }

    private static cacheLocation(position: GeolocationPosition, key = 'default'): void {
        this.locationCache.set(key, { position, timestamp: Date.now() });
    }

    private static resetSmoothingState(): void {
        this.lastUpdateTime = 0;
        this.emaLat = null;
        this.emaLng = null;
    }
}

// Prune stale cache entries every minute
if (typeof globalThis !== 'undefined') {
    setInterval(() => LocationService.clearExpiredCache(), 60_000);
}