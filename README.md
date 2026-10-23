# WatchParty 🎬🍿

A real-time, synchronized YouTube watch party platform with role-based room controls, sub-second playback drift correction, live chat, and persistent room state.

---

## 🌐 Live Application

- **Web Client (Vercel):** [https://youtube-watch-party-omega-mocha.vercel.app](https://youtube-watch-party-omega-mocha.vercel.app)
- **API & WebSocket Server (Render):** [https://watchparty-server-ids7.onrender.com](https://watchparty-server-ids7.onrender.com)
- **Database (Neon):** Serverless PostgreSQL

---

## ✨ Key Features

- **Sub-Second Synchronization**: Continuous drift detection (>1.5s) automatically aligns viewer playback to the host.
- **Role-Based Access Control (RBAC)**:
  - **Host**: Full room control, video management, participant promotion/demotion, user removal/banning, atomic host transfer.
  - **Moderator**: Playback control (play, pause, seek, change video) and request approval/rejection.
  - **Participant**: Synchronized playback, live chat, floating emoji reactions, and polite playback change requests.
- **Hybrid Performance Architecture**: High-frequency playback ticks run entirely in-memory with zero database lag, while room state, membership, and audits persist durably to PostgreSQL via Prisma.
- **Zero-Trust Security**: Server-side role validation on every WebSocket event, Helmet security headers, rate limiting, and HTML-sanitized chat.
- **Privacy First**: No account required, zero tracking cookies, zero PII stored.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Socket.IO Client |
| **Backend** | Node.js, Express, Socket.IO, Prisma ORM, Zod, Pino Logger |
| **Database** | PostgreSQL (Neon Serverless) |
| **Infrastructure**| Vercel (Frontend SPA), Render (Backend Web Service) |

---

## 📁 Repository Structure

```
watchparty-monorepo/
├── client/              # React + Vite frontend application
│   ├── src/             # Components, pages, and socket/REST services
│   └── vercel.json      # Routing rewrites and security headers
├── server/              # Express + Socket.IO backend service
│   ├── prisma/          # Database schema & seed scripts
│   └── src/             # Domain logic, socket handlers, and REST API
├── render.yaml          # Render deployment blueprint
└── package.json         # Monorepo workspace configuration
```

---

## 🚀 Local Development

### 1. Prerequisites
- **Node.js**: `v20+` or `v24+`
- **npm**: `v10+`
- **PostgreSQL**: Local instance or free [Neon DB](https://neon.tech)

### 2. Installation
```bash
git clone https://github.com/prasadsumit1315/Youtube_watch_party.git
cd Youtube_watch_party
npm install
```

### 3. Environment Setup

**Server (`server/.env`):**
```env
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL="your-neon-pooled-connection-string"
DIRECT_URL="your-neon-direct-connection-string"
PERSIST_CHAT=false
LOG_LEVEL=info
```

**Client (`client/.env`):**
```env
VITE_SERVER_URL=http://localhost:5000
```

### 4. Database Initialization
```bash
cd server
npx prisma db push
# (Optional) Seed demo room:
npm run prisma:seed
cd ..
```

### 5. Run Development Servers
```bash
# Start both client and server concurrently from root
npm run dev:all
```
- **Client**: `http://localhost:5173`
- **Server**: `http://localhost:5000`
- **Health Check**: `http://localhost:5000/health`

---

## 🧪 Testing & Verification

```bash
# Run server test suite (32 unit & integration tests)
npm run test --workspace=server

# Run client production build & TypeScript validation
npm run build --workspace=client
```

---

## 🚢 Deployment Configuration

### Backend (Render Web Service)
- **Root Directory:** `server`
- **Build Command:** `npm ci --include=dev && npx prisma generate && npm run build && npx prisma db push`
- **Start Command:** `node dist/index.js`
- **Health Check:** `/health`
- **Key Environment Variables:** `DATABASE_URL`, `DIRECT_URL`, `CLIENT_ORIGIN`, `NODE_ENV=production`

### Frontend (Vercel SPA)
- **Framework Preset:** `Vite`
- **Root Directory:** `client`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variable:** `VITE_SERVER_URL`
