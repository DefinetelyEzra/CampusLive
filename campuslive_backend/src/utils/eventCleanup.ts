import cron from 'node-cron';
import { AttendanceService } from '../services/attendance.service.js';
import { RoleManagementService } from '../services/roleManagement.service.js';
import prisma from '../config/database.js';

export function startEventCleanupTask() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('Running event cleanup task...');
      
      // Clean up old attendance system
      await AttendanceService.cleanupExpiredAttendances();
      
      // Clean up new participant system
      await cleanupEventParticipants();
      
      // Clean up expired user roles
      await RoleManagementService.cleanupExpiredRoles();
      
      console.log('Event cleanup completed');
    } catch (error) {
      console.error('Event cleanup failed:', error);
    }
  });

  console.log('Event cleanup task scheduled (every 5 minutes)');
}

async function cleanupEventParticipants() {
  // Remove participants from ended events
  const endedEvents = await prisma.event.findMany({
    where: {
      OR: [
        { status: 'ENDED' },
        { status: 'CANCELLED' },
        {
          endTime: { lt: new Date() },
          status: { in: ['LIVE', 'UPCOMING'] }
        }
      ]
    },
    select: { id: true }
  });

  for (const event of endedEvents) {
    await prisma.eventParticipant.deleteMany({
      where: { eventId: event.id }
    });
  }

  console.log(`Cleaned up participants from ${endedEvents.length} ended events`);
}