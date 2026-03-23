/**
 * Notification Service
 * Handles browser notifications and notification sounds for live events
 */

import notificationSound from '../assets/notification-sound.mp3';

class NotificationService {
    private audio: HTMLAudioElement | null = null;
    private permission: NotificationPermission = 'default';
    private soundEnabled = true;

    constructor() {
        this.initializeAudio();
        this.checkPermission();
    }

    /**
        * Initialize audio element for notification sound
        */
    private initializeAudio() {
        try {
            // Create audio element with notification sound
            this.audio = new Audio(notificationSound);
            this.audio.volume = 0.5;

            // Fallback: Use a beep sound if custom sound fails
            this.audio.addEventListener('error', () => {
                console.warn('Custom notification sound failed, using fallback');
                this.audio = null;
            });
        } catch (error) {
            console.error('Failed to initialize notification audio:', error);
            this.audio = null;
        }
    }

    /**
     * Check current notification permission status
     */
    private checkPermission() {
        if ('Notification' in globalThis) {
            this.permission = Notification.permission;
        }
    }

    /**
     * Request notification permission from user
     */
    async requestPermission(): Promise<boolean> {
        if (!('Notification' in globalThis)) {
            console.warn('Browser does not support notifications');
            return false;
        }

        if (this.permission === 'granted') {
            return true;
        }

        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            return permission === 'granted';
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }

    /**
     * Play notification sound
     */
    private playSound() {
        if (!this.soundEnabled) return;

        try {
            if (this.audio) {
                // Reset and play
                this.audio.currentTime = 0;
                this.audio.play().catch(err => {
                    console.warn('Failed to play notification sound:', err);
                });
            } else {
                // Fallback: Use Web Audio API for a simple beep
                this.playBeep();
            }
        } catch (error) {
            console.error('Error playing notification sound:', error);
        }
    }

    /**
    * Fallback beep sound using Web Audio API
    */
    private playBeep() {
        try {
            // Define interface for globalThis with AudioContext and webkitAudioContext
            interface AudioContextGlobal {
                AudioContext?: typeof AudioContext;
                webkitAudioContext?: typeof AudioContext;
            }

            const global = globalThis as unknown as AudioContextGlobal;
            const AudioContextClass = global.AudioContext || global.webkitAudioContext;

            if (!AudioContextClass) {
                console.warn('Web Audio API not supported');
                return;
            }

            const audioContext = new AudioContextClass();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.error('Failed to play beep sound:', error);
        }
    }

    /**
     * Show browser notification for live event
     */
    async showEventLiveNotification(eventData: {
        eventId: string;
        title: string;
        locationName: string;
        timestamp: string;
    }): Promise<void> {
        // Play sound regardless of notification permission
        this.playSound();

        // Check if notifications are supported and permitted
        if (!('Notification' in globalThis) || this.permission !== 'granted') {
            return;
        }

        try {
            const notificationOptions: NotificationOptions = {
                body: `${eventData.title} at ${eventData.locationName}`,
                icon: '/logo.png',
                badge: '/logo.png',
                tag: `event-live-${eventData.eventId}`,
                requireInteraction: false,
                silent: true, // handle sound separately
            };

            const notification = new Notification('🔴 Event Now Live!', notificationOptions);

            // Auto-close after 10 seconds
            setTimeout(() => notification.close(), 10000);

            // Optional: Handle notification click
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } catch (error) {
            console.error('Failed to show notification:', error);
        }
    }

    /**
     * Enable/disable notification sound
     */
    setSoundEnabled(enabled: boolean) {
        this.soundEnabled = enabled;
    }

    /**
     * Check if notifications are supported
     */
    isSupported(): boolean {
        return 'Notification' in globalThis;
    }

    /**
     * Get current permission status
     */
    getPermission(): NotificationPermission {
        return this.permission;
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }
    }
}

// Export singleton instance
export const notificationService = new NotificationService();