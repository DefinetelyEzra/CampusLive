import moment from 'moment-timezone';

const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || 'Africa/Lagos';

export class TimezoneUtils {
  /**
   * Convert UTC date to local timezone
   */
  static toLocalTime(date: Date | string, timezone: string = DEFAULT_TIMEZONE): string {
    return moment(date).tz(timezone).format();
  }

  /**
   * Convert UTC date to local timezone (ISO format)
   */
  static toLocalTimeISO(date: Date | string, timezone: string = DEFAULT_TIMEZONE): string {
    return moment(date).tz(timezone).toISOString();
  }

  /**
   * Get current time in specified timezone
   */
  static now(timezone: string = DEFAULT_TIMEZONE): string {
    return moment().tz(timezone).format();
  }

  /**
   * Convert local timezone to UTC
   */
  static toUTC(date: Date | string, fromTimezone: string = DEFAULT_TIMEZONE): Date {
    return moment.tz(date, fromTimezone).utc().toDate();
  }

  /**
   * Format date for display
   */
  static formatForDisplay(date: Date | string, timezone: string = DEFAULT_TIMEZONE): string {
    return moment(date).tz(timezone).format('YYYY-MM-DD HH:mm:ss z');
  }

  /**
   * Convert event object with timezone-aware dates
   */
  static convertEventDates(event: any, timezone: string = DEFAULT_TIMEZONE) {
    return {
      ...event,
      startTime: this.toLocalTime(event.startTime, timezone),
      endTime: event.endTime ? this.toLocalTime(event.endTime, timezone) : null,
      createdAt: this.toLocalTime(event.createdAt, timezone),
      updatedAt: this.toLocalTime(event.updatedAt, timezone),
      // Add display formats for frontend
      displayTimes: {
        startTime: this.formatForDisplay(event.startTime, timezone),
        endTime: event.endTime ? this.formatForDisplay(event.endTime, timezone) : null,
        createdAt: this.formatForDisplay(event.createdAt, timezone),
        updatedAt: this.formatForDisplay(event.updatedAt, timezone),
      }
    };
  }

  /**
   * Convert multiple events
   */
  static convertEventsDates(events: any[], timezone: string = DEFAULT_TIMEZONE) {
    return events.map(event => this.convertEventDates(event, timezone));
  }
}