import crypto from 'node:crypto';

export class AccessKeyUtils {
    /**
     * Generate a unique 6-character access key
     */
    static generateAccessKey(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar-looking characters
        let key = '';

        for (let i = 0; i < 6; i++) {
            const randomIndex = crypto.randomInt(0, chars.length);
            key += chars[randomIndex];
        }

        return key;
    }

    /**
     * Validate access key format
     */
    static validateAccessKey(key: string): boolean {
        return /^[A-Z0-9]{6}$/.test(key);
    }

    /**
     * Generate unique access key (checks database for uniqueness)
     */
    static async generateUniqueAccessKey(prisma: any): Promise<string> {
        let key: string;
        let attempts = 0;
        const maxAttempts = 10;

        do {
            key = this.generateAccessKey();
            const existing = await prisma.event.findFirst({
                where: { accessKey: key }
            });

            if (!existing) return key;

            attempts++;
        } while (attempts < maxAttempts);

        throw new Error('Failed to generate unique access key');
    }
}