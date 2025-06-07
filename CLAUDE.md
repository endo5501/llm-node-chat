# CLAUDE.md
必ず日本語で回答してください

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a full-stack LLM chat application with conversation branching functionality. Users can branch conversations from any previous point, creating tree-like conversation structures.

### Technology Stack
- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS
- **Backend**: FastAPI with Python 3.12, SQLAlchemy ORM, SQLite/PostgreSQL
- **State Management**: Zustand for frontend state
- **Package Management**: pnpm for frontend, uv for backend

### Core Components

**Backend (`backend/src/backend/`)**:
- `main.py`: FastAPI app with CORS and router configuration
- `models.py`: SQLAlchemy models for Conversation, Message (with parent/child relationships), LLMProvider
- `routers/`: API endpoints for chat, conversations, providers, websocket_chat
- `llm_service.py`: LLM provider integrations (OpenAI, Claude, Gemini, Ollama)
- `database.py`: Database connection and initialization

**Frontend (`frontend/src/`)**:
- `store/conversationStore.ts`: Zustand store managing conversation tree state and API integration
- `components/`: React components for UI (ConversationTree, MessageList, etc.)
- `lib/api.ts`: HTTP API client
- `lib/websocket.ts`: WebSocket client for streaming messages

### Key Architecture Patterns

**Conversation Tree Structure**: Messages are stored as nodes with parent-child relationships, enabling branching conversations. The frontend maintains a tree structure in Zustand store, tracking current path and selected nodes.

**Dual Communication**: Supports both HTTP API and WebSocket for message sending. WebSocket enables real-time streaming responses.

**LLM Provider Abstraction**: Backend abstracts multiple LLM providers (OpenAI, Claude, Gemini, Ollama) with configurable API keys and endpoints.

## Development Commands

### Setup
```bash
# Install all dependencies
npm install

# Backend setup
cd backend
uv venv
source .venv/bin/activate  # Linux/Mac
uv sync
cd ..

# Frontend setup  
cd frontend
pnpm install
cd ..
```

### Running Development Servers
```bash
# Start both backend and frontend
npm run dev

# Individual services
npm run dev:backend  # Backend on port 8000
npm run dev:frontend # Frontend on port 3000
```

### Testing
```bash
# Backend tests
cd backend
uv run pytest

# Single test file
uv run pytest tests/test_api.py

# Frontend linting
cd frontend
npm run lint
```

### Building
```bash
npm run build  # Builds frontend only
```

### Database
The backend uses SQLAlchemy with auto-migration on startup. Database is SQLite by default, configurable via DATABASE_URL environment variable.

## Environment Configuration

Backend environment variables (create `backend/.env`):
- `DATABASE_URL`: Database connection string
- LLM provider API keys are configured through the frontend settings UI and stored in database