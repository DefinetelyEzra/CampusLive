# CampusLive Backend

CampusLive is a real-time event and social platform backend built with Node.js, Express, Socket.IO, and Prisma. It supports event management, user attendance tracking, real-time updates, and secure API interactions for a campus community. This README provides a detailed explanation of the logic based on the provided files.

## Table of Contents
- [Project Overview](#project-overview)
- [File Structure](#file-structure)
- [Setup and Installation](#setup-and-installation)
- [Key Components and Logic](#key-components-and-logic)
- [API and Real-Time Features](#api-and-real-time-features)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Development Scripts](#development-scripts)
- [Contributing](#contributing)

## Project Overview
CampusLive enables users to manage events, join/leave them in real-time, post content, and track attendance. The backend uses Express for HTTP requests, Socket.IO for WebSocket communication, Prisma for PostgreSQL interactions, and a scheduler for automating event lifecycles. Security middleware and rate limiting ensure robust protection.

## File Structure
- **`src/`**: Main source code.
  - **`config/`**: Configuration files (e.g., `cors.ts`, `database.ts`, `scheduler.ts`).
  - **`controllers/`**: Business logic for routes.
  - **`middleware/`**: Security and sanitization middleware.
  - **`routes/`**: API endpoints.
  - **`services/`**: Business logic services (e.g., `attendance.service.ts`, `event.service.ts`).
  - **`socket/`**: WebSocket handlers (e.g., `attendanceHandler.ts`).
  - **`utils/`**: Utility functions (e.g., `logger.ts`, `eventCleanup.ts`).
  - **`types/`**: TypeScript type definitions.
  - **`app.ts`**: Express application setup.
  - **`server.ts`**: Server entry point.
- **`prisma/`**: Prisma configuration and migrations.
  - **`schema.prisma`**: Database schema.
- **`.env`**: Environment variables.
- **`package.json`**: Dependencies and scripts.
- **`tsconfig.json`**: TypeScript configuration.

## Setup and Installation
1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd campuslive_backend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**:
   Create a `.env` file. See [Environment Variables](#environment-variables).

4. **Set Up PostgreSQL and Redis**:
   - Configure `DATABASE_URL` for PostgreSQL.
   - Set up Redis if caching is used.

5. **Run Database Migrations**:
   ```bash
   npm run db:migrate
   ```

6. **Start the Application**:
   ```bash
   npm run dev
   ```

## Key Components and Logic

### `src/server.ts`
- **Logic**: Initializes the HTTP server with `createServer` and Socket.IO with CORS. Sets up `SocketHandler` for WebSocket events and `startEventCleanupTask` for periodic cleanup. Handles graceful shutdown on `SIGTERM`, `SIGINT`, and errors, closing connections with a 10-second timeout.

### `src/app.ts`
- **Logic**: Configures Express with security middleware (`helmet`, `cors`), rate limiting, and sanitization (`mongoSanitizer`, `xssProtection`, `sanitizeInput`). Defines API routes (`/api/v1/*`) and a `/health` endpoint with scheduler status. Integrates `SchedulerService` with a 2-second delay in non-test environments.

### `src/utils/eventCleanup.ts`
- **Logic**: Uses `node-cron` to run `startEventCleanupTask` every 5 minutes. Calls `AttendanceService.cleanupExpiredAttendances` to remove attendees from ended events and update event statuses from `LIVE` to `ENDED`. Includes a commented `startFrequentEventCleanupTask` for minute-level cleanup (optional).

### `src/services/scheduler.service.ts`
- **Logic**: Implements a singleton `SchedulerService` to manage event lifecycles. 
  - **`start()`**: Initializes interval-based checks for event start (`setupEventStartScheduler`) and end (`setupEventEndScheduler`) if enabled via `schedulerConfig`. Logs configuration details.
  - **`stop()`**: Clears intervals and stops the scheduler.
  - **`checkAndStartEvents()`**: Queries `EventService.getEventsToStart`, updates `isLive` to `true` and `status` to `LIVE`, emits `eventStatusUpdate` via Socket.IO, and increments `startedEventCount`.
  - **`checkAndEndEvents()`**: Queries `EventService.getEventsToEnd`, updates `isLive` to `false` and `status` to `ENDED`, forces attendance cleanup with `forceEndEventAttendance`, and increments `endedEventCount`.
  - **`isHealthy()`**: Checks if the scheduler is running and checks are recent (within 2x interval).
  - Supports manual triggers (`triggerStartCheck`, `triggerEndCheck`) for testing.

### `src/middleware/security.middleware.ts`
- **Logic**: Implements rate limiting with `express-rate-limit` and `express-slow-down`:
  - **`generalLimiter`**: 100 requests/15 minutes per IP.
  - **`authLimiter`**: 5 failed attempts/15 minutes per IP.
  - **`uploadLimiter`**: 20 uploads/hour per IP.
  - **`postLimiter`**: 10 posts/5 minutes per IP.
  - **`speedLimiter`**: Delays requests after 50/15 minutes with 500ms delay.
  - **`createUserBasedLimiter`**: Custom limiter using `userId` or `ip` as key.

### `src/middleware/sanitization.middleware.ts`
- **Logic**: Provides input sanitization:
  - **`mongoSanitizer`**: Removes MongoDB operators (e.g., `$`, `.`) from `body`, `query`, and `params`, storing sanitized versions in custom properties.
  - **`xssProtection`**: Removes XSS risks (e.g., `<script>`, `javascript:`, `on*`) from `body` and specific headers.
  - **`sanitizeInput`**: Combines sanitized data into `cleanQuery`, `cleanParams`, and `body` for route use. Uses utility functions (`sanitizeMongoInjection`, `cleanXSS`, `sanitizeObject`) to recursively clean objects and strings.

### `src/socket/attendanceHandler.ts`
- **Logic**: Manages WebSocket attendance:
  - **`setupAttendanceHandlers`**: Authenticates sockets with JWT, attaching `userId`. Handles:
    - **`join-event-room`**: Joins `event:${eventId}` room.
    - **`leave-event-room`**: Leaves `event:${eventId}` room.
    - **`join-event`**: Calls `AttendanceService.joinEvent`, joins room, notifies others with `user-joined-event`, and updates `attendance-updated`.
    - **`leave-event`**: Calls `AttendanceService.leaveEvent`, leaves room, notifies others with `user-left-event`, and updates `attendance-updated`.
    - **`post-to-event`**: Checks attendance with `isUserAttending`, broadcasts `new-event-post`.
  - **`notifyEventStatusChange`**: Emits `event-status-changed` to event room.
  - **`forceEndEventAttendance`**: Ends all attendances with `endEventAttendance`, notifies with `event-ended`, and disconnects sockets.

## API and Real-Time Features
- **API**: `/api/v1/*` routes for auth, events, locations, and posts with rate limiting.
- **Real-Time**: Socket.IO handles join/leave events, attendance updates, and status changes. Scheduler emits updates via `io.emit`.

## Database Schema
Defined in `prisma/schema.prisma` with models (`User`, `Location`, `Post`, `Event`, `EventAttendance`) and enums (`UserRole`, `MediaType`, `EventStatus`).

## Environment Variables
Create a `.env` file:
```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/campuslive
JWT_SECRET=your-secret-key
REDIS_URL=redis://localhost:6379
```

## Running the Application
- **Development**: `npm run dev`.
- **Production**: `npm run build` and `npm run start`.

## Development Scripts
- `npm run dev`: Run with nodemon.
- `npm run build`: Compile TypeScript.
- `npm run start`: Run compiled app.
- `npm run db:generate`: Generate Prisma client.
- `npm run db:push`: Push schema changes.
- `npm run db:migrate`: Apply migrations.
- `npm run db:studio`: Open Prisma Studio.

## Contributing
1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Commit changes: `git commit -m "Add your feature"`.
4. Push to the branch: `git push origin feature/your-feature`.
5. Open a pull request.