# WatchParty 🎬🍿

A production-quality, real-time synchronized YouTube watch party web application with role-based room controls, low-latency drift correction, in-memory playback coordination, and persistent room state.

---

## 🌐 Live URLs

- **Web Client (Vercel):** `https://watchparty-client.vercel.app` *(placeholder - configure with your deployment URL)*
- **Server API & WebSockets (Render):** `https://watchparty-server.onrender.com` *(placeholder - configure with your deployment URL)*

---

## ✨ Features

- **Sub-Second Real-Time Playback Synchronization**: Continuous 2-second drift correction detects timestamp deviations exceeding 1.5s and seamlessly re-aligns players.
- **Privacy-Enhanced Player Embed**: YouTube IFrame API loaded via `https://www.youtube-nocookie.com`.
- **Role-Based Access Control (RBAC)**:
  - **Host**: Complete control over playback, room settings, participant promotion/demotion, user removal/banning, and atomic host transfer.
  - **Moderator**: Immediate playback control (play, pause, seek, change video) and request approval/rejection.
  - **Participant**: Synced viewing, live chat, floating emoji reactions, and polite request flow to suggest playback changes to hosts/moderators.
- **In-Memory + Database Hybrid Architecture**:
  - Live playback ticks (`currentTime`, `playState`) stay strictly in-memory for instant broadcasting with 0 DB overhead.
  - Durable changes (room creation, role changes, removals, host transfers, video changes) persist to PostgreSQL via Prisma ORM transactions.
- **Zero-Trust Server Validation**: Client role or user claims are never trusted; role enforcement is evaluated on every socket event via `PermissionPolicy`.
- **Privacy-by-Design**: No account creation, no emails, no IPs, no tracker cookies, and zero PII stored in DB. Pino logger redacts tokens and sensitive data automatically.
- **Interactive Social Features**: Live chat with HTML sanitization and a 300-character limiter; ephemeral floating emoji reactions over the stream.
- **Cold-Start Resilience**: Built-in visual indicator detecting when free-tier hosts (e.g. Render) are waking up.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Monorepo** | npm Workspaces, TypeScript (ES2022) |
| **Server** | Node.js, Express, Socket.IO, Zod, Helmet, CORS, Express-Rate-Limit, Pino, Nanoid |
| **Database** | PostgreSQL (Neon), Prisma ORM |
| **Client** | React 18, Vite, TypeScript, Tailwind CSS, React Router, Socket.IO Client, Lucide Icons |
| **Hosting** | Render (Web Service), Vercel (SPA) |

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- Node.js `v20+` or `v24+`
- npm `v10+`
- PostgreSQL instance (or free [Neon Serverless Postgres](https://neon.tech))

### 2. Clone and Install
```bash
git clone <your-repo-url>
cd "youtube watch"
npm install
```

### 3. Server Configuration
Create `server/.env` based on `server/.env.example`:
```bash
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL="postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/watchparty?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-sample.us-east-2.aws.neon.tech/watchparty?sslmode=require"
PERSIST_CHAT=false
LOG_LEVEL=info
```

Generate Prisma client and run migrations:
```bash
cd server
npx prisma generate
npx prisma migrate dev --name init
# (Optional) Seed demo room:
npm run prisma:seed
cd ..
```

### 4. Client Configuration
Create `client/.env` based on `client/.env.example`:
```bash
VITE_SERVER_URL=http://localhost:5000
```

### 5. Run Development Servers
From the root monorepo directory, start both client and server:
```bash
npm run dev:all
```
- Client runs at: `http://localhost:5173`
- Server runs at: `http://localhost:5000`
- Health check: `http://localhost:5000/health`

---

## 🔐 Roles and Permissions Matrix

The server strictly evaluates every socket action through the centralized `PermissionPolicy` class:

| Action | Host | Moderator | Participant | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Play / Pause / Seek** | ✅ | ✅ | ❌ | Participants must use `request_action` |
| **Change Video** | ✅ | ✅ | ❌ | Host/Mod can load any YouTube URL or 11-char ID |
| **Request Playback Action** | ✅ | ✅ | ✅ | Sends request to Host/Moderator queue |
| **Approve / Reject Requests**| ✅ | ✅ | ❌ | Evaluates participant request and applies change |
| **Assign Roles** | ✅ | ❌ | ❌ | Promote to Moderator or demote to Participant |
| **Remove & Ban User** | ✅ | ❌ | ❌ | Target is kicked, disconnected, and banned |
| **Transfer Host** | ✅ | ❌ | ❌ | Atomic transfer; old host becomes Moderator |
| **Chat & Emoji Reactions** | ✅ | ✅ | ✅ | Ephemeral reactions; throttled chat |

---

## 📡 Socket Events Reference

### Client -> Server

| Event | Payload | Description |
| :--- | :--- | :--- |
| `join_room` | `{ roomId, username, reconnectToken? }` | Join room; creates/hydrates session |
| `leave_room` | `{}` | Gracefully leaves room |
| `play` | `{ currentTime? }` | Starts playback at given timestamp |
| `pause` | `{ currentTime? }` | Pauses playback at given timestamp |
| `seek` | `{ targetTime: number }` | Jumps playback to target second |
| `change_video` | `{ urlOrId: string }` | Changes YouTube video ID |
| `assign_role` | `{ targetUserId: string, newRole: Role }` | Host assigns role to participant |
| `remove_participant`| `{ targetUserId: string }` | Host removes and bans user from room |
| `transfer_host` | `{ targetUserId: string }` | Host transfers room ownership |
| `request_action` | `{ actionType, targetTime?, videoId? }` | Participant requests playback action |
| `approve_request` | `{ requestId: string }` | Host/Mod approves pending request |
| `reject_request` | `{ requestId: string }` | Host/Mod rejects pending request |
| `chat_message` | `{ text: string }` | Sends sanitized message to room |
| `reaction` | `{ emoji: string }` | Broadcasts floating emoji reaction |

### Server -> Client

| Event | Payload | Description |
| :--- | :--- | :--- |
| `sync_state` | `SyncStatePayload` | Full state broadcast (video, playState, time, participants, requests) |
| `user_joined` | `{ user: PublicParticipant }` | Broadcast when a new participant joins |
| `user_left` | `{ userId, username }` | Broadcast when a user leaves |
| `role_assigned` | `{ targetUserId, role, actorUserId }` | Broadcast when role changes |
| `participant_removed` | `{ targetUserId, actorUserId }` | Broadcast when user is kicked/banned |
| `host_transferred` | `{ newHostUserId, oldHostUserId }` | Broadcast when room ownership transfers |
| `action_requested` | `ActionRequest` | Broadcast when participant submits request |
| `action_rejected` | `{ requestId }` | Broadcast when request is denied |
| `chat_message` | `ChatMessage` | Broadcast to all room members |
| `reaction` | `ReactionEvent` | Ephemeral floating reaction |
| `error_event` | `{ code, message }` | Sent on permission denial or rate limit |
| `removed` | `{ message }` | Sent directly to user being banned before disconnect |

---

## 🧪 Testing

The server includes full unit, integration, and end-to-end tests:

```bash
# Run all server tests (32 tests in Vitest)
npm run test --workspace=server

# Run client production build & TypeScript check
npm run build --workspace=client
```

---

## 🚢 Deployment

### Render (Server Web Service)
- **Root Directory:** `server`
- **Build Command:** `npm ci && npx prisma generate && npm run build && npx prisma migrate deploy`
- **Start Command:** `node dist/index.js`
- **Health Check Path:** `/health`

### Vercel (Client Web App)
- **Framework Preset:** `Vite`
- **Root Directory:** `client`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variable:** `VITE_SERVER_URL=https://your-server.onrender.com`
