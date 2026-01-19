# Rostra Chat

Real-time chat app built to learn WebSockets. First time working with persistent connections instead of regular HTTP requests.

**Live Demo:** [Coming soon - setting up custom domain]
**GitHub:** https://github.com/odysian/rostra-chat-app

## What It Does

- Real-time messaging using WebSockets
- Multi-room chat functionality
- User authentication
- Message history per room
- Shows who's online in each room

## Tech Stack

**Backend:**
- FastAPI (Python)
- PostgreSQL (via Supabase)
- WebSockets for real-time communication
- JWT authentication

**Frontend:**
- React with TypeScript
- Tailwind CSS
- WebSocket client

**Deployment:**
- Frontend: Vercel
- Database: Supabase (PostgreSQL)
- Backend: Render
- All free tier

## What I Learned

### WebSockets
- How persistent connections differ from HTTP requests
- Managing connection state (connect, disconnect, reconnect)
- Broadcasting messages to multiple clients
- Handling user presence (join/leave events)

### Real-time Architecture
- Connection manager pattern for tracking active WebSocket connections
- Message routing between users in the same room
- State synchronization between server and clients
- Dealing with disconnections and cleanup

### Authentication with WebSockets
- Authenticating via JWT on initial WebSocket connection
- Using the authenticated user context for all subsequent messages

### TypeScript
- First project using TypeScript on frontend
- Type definitions for WebSocket messages
- Props and state typing in React

### Deployment Challenges
- Free tier limitations (Render spins down after inactivity)
- WebSocket deployment is trickier than REST APIs
- Database connection management with Supabase
- CORS configuration for WebSocket connections
- Environment variables across three platforms

### Key Insights
- **WebSocket lifecycle:** Had to learn proper cleanup. Unsubscribe from rooms on disconnect and remove from connection manager
- **Message types:** Created typed message schemas for different actions (subscribe, send_message, etc.). Helped to debug and keep code structured.
- **Error handling:** WebSocket errors are different from HTTP, can't rely on status codes
- **State management:** Keeping client and server in sync is harder than with REST
- **Free hosting:** WebSocket connections on free tiers means users wait 30+ seconds on first connection

## Running Locally

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL (or use Supabase)

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
│   ├── models/           # SQLAlchemy models
│   ├── schemas/          # Pydantic schemas
│   └── core/             # Config, database, security
├── alembic/              # Database migrations
└── test_websocket.html   # WebSocket testing tool
```

### Frontend
```
frontend/
├── src/
│   ├── components/       # Chat UI components
│   ├── pages/            # Login, Register, Chat
│   ├── context/          # Auth and WebSocket context
│   ├── services/         # API calls
│   └── types/            # TypeScript definitions
```

## Deployment

**Frontend (Vercel):**
- Automatic deploys from `main` branch
- Environment variables set in Vercel dashboard

**Backend (Render):**
- Free tier with cold starts (~30 second spin-up)
- Connects to Supabase PostgreSQL
- WebSocket support enabled

**Database (Supabase):**
- Free PostgreSQL instance
- Connection pooling enabled
- SSL required for connections

## Challenges & Limitations

**Free Tier Trade-offs:**
- Render backend spins down after 15 minutes of inactivity
- First connection after cold start can take a bit longer
- Supabase has connection limits on free tier

**Learning Curve:**
- WebSocket state management more complex than REST
- Debugging real-time issues harder than request/response
- TypeScript learning curve on frontend
- Refactoring bloated return statements in React

## Contact

**Chris**
- GitHub: [@odysian](https://github.com/odysian)
- Website: https://odysian.dev
- Email: c.colosimo@odysian.dev

## License

MIT License - feel free to use this as a learning reference.
