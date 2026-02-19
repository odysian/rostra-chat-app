# Rostra Chat

Real-time chat app built to learn WebSockets.

**Live Demo:** https://rostra.odysian.dev

## What It Does

- Real-time messaging using WebSockets
- Multi-room chat with room discovery, joining, and leaving
- Infinite scroll message history with cursor-based pagination
- Unread message counters (server-authoritative, cached in Redis)
- User authentication with JWT
- Online presence per room
- Typing indicators per room
- Room membership access control
- Neon/Amber themes with optional CRT overlay (enabled by default for first-time visitors)
- Grouped message display with date dividers and compact timestamps
- Frontend room-name display normalization (`My Room` → `My-Room`)

## Tech Stack

**Backend:**
- FastAPI (Python)
- PostgreSQL (Render) with schema isolation
- Redis (Upstash) for caching unread counts
- WebSockets for real-time communication
- JWT authentication, rate-limited auth endpoints
- 90+ backend tests (pytest, real DB with transaction rollback)

**Frontend:**
- React with TypeScript
- Tailwind CSS
- Centralized WebSocket context with multi-room subscriptions
- Theme context (Neon/Amber), CRT preference persistence, and room-aware message input UX

**Deployment:**
- Frontend: Vercel
- Backend: Render
- Database: Render PostgreSQL (shared across 3 portfolio projects via schema isolation)
- Cache: Upstash Redis
- All free tier

## What I Learned

### WebSockets & Real-time Architecture
- Persistent connections vs HTTP request/response
- Connection manager pattern for tracking active connections per room
- Broadcasting messages and managing user presence (join/leave events)
- Centralized WebSocket context with multi-room subscriptions (LRU capping at 10)
- Preventing duplicate subscriptions on React effect re-runs
- Authenticating via JWT on initial WebSocket connection

### Room System & Access Control
- Room membership model with a `user_room` join table
- Room discovery modal with browse/join/leave workflows
- Server-authoritative unread counts with Redis caching
- Fixing N+1 queries when fetching rooms with unread counts

### Pagination & Performance
- Cursor-based (keyset) pagination instead of offset — stable results even with real-time inserts
- Composite database index `(room_id, created_at DESC, id DESC)` for efficient seeks
- IntersectionObserver for scroll detection instead of scroll event listeners
- Scroll position preservation when prepending older messages (useLayoutEffect)

### TypeScript
- First project using TypeScript on frontend
- Typed WebSocket message schemas for different actions
- Props and state typing in React
- Deterministic user-color utility (Neon mode) for consistent avatar/name accents

### Deployment & Infrastructure
- Free tier trade-offs (Render cold starts, shared PostgreSQL connection limits)
- Schema-based isolation: three apps sharing one database via separate schemas
- Adding Redis (Upstash) as a caching layer on a shared instance with key prefixing
- WebSocket deployment is trickier than REST APIs
- Environment variables across four platforms

### Key Insights
- **WebSocket lifecycle:** Proper cleanup matters: unsubscribe from rooms on disconnect and remove from connection manager
- **Race conditions:** Switching rooms fast can cause message fetch races; needed careful state management
- **State management:** Keeping client and server in sync is harder than with REST
- **Scroll management:** Three distinct scroll scenarios (initial load, prepend history, append new messages) need coordinated state — ended up with a discriminated union for pending scroll adjustments
- **Free hosting:** Cold starts mean users wait 30+ seconds on first connection; added loading overlay with feedback

## Running Locally

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL

### Backend Setup

```bash
# Clone repository
git clone https://github.com/odysian/rostra-chat-app
cd rostra-chat-app/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your database URL

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

Backend runs at http://localhost:8000

### Frontend Setup

```bash
# In a new terminal
cd rostra-chat-app/frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:8000" > .env
echo "VITE_WS_URL=ws://localhost:8000" >> .env

# Start development server
npm run dev
```

Frontend runs at http://localhost:5173

## Testing WebSockets

The backend includes a test HTML file for WebSocket debugging:

```bash
# Open in browser
open backend/test_websocket.html
```

## Project Structure

### Backend
```
backend/
├── app/
│   ├── api/              # REST endpoints (auth, rooms, messages)
│   ├── websocket/        # WebSocket handlers and connection manager
│   ├── crud/             # Database operations
│   ├── models/           # SQLAlchemy models (includes user_room membership)
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # Business logic (Redis caching, etc.)
│   └── core/             # Config, database, security
├── alembic/              # Database migrations
└── tests/                # Pytest suite
```

### Frontend
```
frontend/
├── src/
│   ├── components/       # ChatLayout, RoomList, RoomDiscoveryModal, etc.
│   ├── pages/            # Login, Register, Chat, Landing
│   ├── context/          # Auth and centralized WebSocket context
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API calls
│   └── types/            # TypeScript definitions
```

## Deployment

**Frontend (Vercel):**
- Automatic deploys from `main` branch
- Environment variables set in Vercel dashboard

**Backend (Render):**
- Free tier with cold starts (~30 second spin-up)
- Connects to Render PostgreSQL and Upstash Redis
- WebSocket support enabled

**Database (Render PostgreSQL):**
- Shared free-tier instance (`portfolio-db`)
- Uses `rostra` schema for table isolation
- Shared with 2 other portfolio projects (3 apps × pool_size=3 = 9 base connections)

**Cache (Upstash Redis):**
- Shared instance with `rostra:` key prefix
- Caches unread message counts

## Contact

**Chris**
- GitHub: [@odysian](https://github.com/odysian)
- Website: https://odysian.dev
- Email: c.colosimo@odysian.dev

## License

MIT License - feel free to use this as a learning reference.
