# WatchParty Code Walkthrough 🚀

A friendly, plain-English guide to understanding how WatchParty works under the hood. Whether you're new to WebSockets, Express, React, Prisma, or state synchronization, this document explains each component step by step.

---

## 1. What Happens When a User Opens the App?

1. **Vite + React Load**: The browser requests the frontend from Vercel (or `localhost:5173`).
2. **Landing Page (`client/src/pages/LandingPage.tsx`)**:
   - The user enters their display name (e.g. *"Alex"*) and clicks **"Create WatchParty Room"**.
   - The client issues an HTTP `POST /api/rooms` request to the Express backend.
   - The server creates a unique room with a cryptographically random 8-character code (e.g. `DEMO2026`, avoiding confusing letters like `0`, `O`, `1`, `I`).
   - The client receives `{ roomId }` and navigates to `/room/:id`.
3. **Entering the Room (`client/src/pages/RoomPage.tsx`)**:
   - The `RoomContext` initiates a WebSocket connection to the server via Socket.IO.
   - The client emits the `join_room` event with `{ roomId, username }`.

---

## 2. Express Backend & HTTP Layer (`server/src/app.ts`)

Express is the HTTP server handling initial web requests and health checks.

- **Helmet (`app.use(helmet())`)**: Sets essential security headers (like Content Security Policy and X-Frame-Options) to shield users from cross-site scripting (XSS) and clickjacking.
- **CORS Allowlist**: Makes sure only approved web frontends (configured via `CLIENT_ORIGIN`) can communicate with our API.
- **Rate Limiting**: Protects endpoints like `POST /api/rooms` from denial-of-service (DoS) or automated spam bots by restricting how many requests an IP can make in 15 minutes.
- **GET `/health`**: Returns `{ status: "ok" }` and executes a `SELECT 1` query against PostgreSQL to ensure both the Node server and the database are healthy.

---

## 3. Real-Time WebSockets with Socket.IO (`server/src/socket/message-handler.ts`)

Socket.IO enables two-way, bidirectional communication between the server and all users in a room.

### A. How a Room Works in Memory
When someone creates or joins a room:
1. The server checks if the room is already in its memory (`RoomManager`).
2. If it is in memory, it adds the participant.
3. If the server just restarted, it loads ("hydrates") the room from PostgreSQL, resets the playback to paused at 0, and restores all role permissions and bans.

### B. Why Video Playback Stays In Memory
Database writes take time (tens of milliseconds). If we wrote every play, pause, or seek to PostgreSQL, watching together would feel laggy and strain the database.
Instead:
- The server stores `currentTime`, `playState` (PLAYING or PAUSED), and `updatedAt` in RAM.
- When the Host presses "Play", the server immediately broadcasts `sync_state` to everyone in the room via WebSockets in less than 5 milliseconds.

---

## 4. Role-Based Access Control: `PermissionPolicy`

The single source of truth for all permissions lives in `server/src/domain/permissions.ts`.

### The Three Roles:
1. **HOST (The Creator)**:
   - Can do everything: play, pause, seek, change videos, promote users to Moderator, kick and ban troublemakers, and transfer host rights.
   - **Protection Rule**: The host cannot be demoted or removed by anyone (including themselves) unless they explicitly transfer the host role.
2. **MODERATOR (The Co-Host)**:
   - Assigned by the Host.
   - Can play, pause, seek, change video, and approve/reject participant requests.
   - Cannot assign roles, ban users, or transfer host.
3. **PARTICIPANT (The Viewers)**:
   - Default role when entering a room.
   - Can watch, chat, and react with floating emojis.
   - Cannot pause or seek directly; instead, they have a **"Request Action"** button that sends a polite notification to the Host and Moderators.

### Zero-Trust Rule:
The server never trusts what the client claims. Even if a user modified their browser JavaScript to say `role = "HOST"`, the server checks its own internal map for that socket's verified user ID. Unauthorized actions are immediately rejected with an `error_event`.

---

## 5. The YouTube Player & Sync Algorithm (`client/src/components/YouTubePlayer.tsx`)

### The 2-Second Drift Check
People's internet speeds and browser rendering speeds vary slightly. If one viewer gets 2 seconds behind, the experience is ruined.
Here's how we fix that:
- Every 2 seconds, an interval runs on the client.
- It calculates where the video *should* be right now:
  $$\text{ExpectedTime} = \text{currentTime} + (\text{now} - \text{updatedAt})/1000$$
- If the viewer's local player is more than **1.5 seconds** off from the expected time, the player automatically seeks forward or backward to match the room.

### Preventing Echo Loops:
When the client seeks programmatically to correct drift, YouTube triggers an `onStateChange` event. We set `isProgrammaticAction = true` for 500ms so the client doesn't mistakenly broadcast a seek command back to the server.

---

## 6. Database with Prisma ORM (`server/prisma/schema.prisma`)

We use PostgreSQL (Neon) with Prisma ORM.

- **`rooms`**: Stores durable room details (code, host ID, current video ID, expiration date).
- **`members`**: Tracks who joined the room and their assigned role (`HOST`, `MODERATOR`, `PARTICIPANT`).
- **`banned_users`**: Remembers kicked users so they cannot refresh their page to rejoin.
- **`audit_logs`**: Keeps a clean moderation log of every significant action (`ROOM_CREATED`, `ROLE_ASSIGNED`, `MEMBER_REMOVED`, `HOST_TRANSFERRED`, `VIDEO_CHANGED`).
- **`chat_messages`**: Optional chat persistence table (active only when `PERSIST_CHAT=true`).

Multi-step actions (such as creating a room + registering the host member + writing the first audit log) are wrapped in `prisma.$transaction` so that if any step fails, everything is rolled back cleanly.

---

## 7. Privacy and Security Guardrails

1. **No Accounts / No PII**: Users pick a temporary display name. We never ask for emails, passwords, or personal data.
2. **HTML Sanitization**: Usernames have HTML tags removed (`sanitizeUsername`), and chat messages are entity-escaped (`escapeHtml`) to prevent script injection.
3. **Pino Redaction**: Server logs automatically strip tokens, socket IDs, IPs, and chat messages.
4. **Session Storage Only**: Only the user's display name is saved in `sessionStorage` (cleared when the tab is closed). No persistent tracking in `localStorage`.
