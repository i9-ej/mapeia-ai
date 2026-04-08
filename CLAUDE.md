# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClinicFlow Architect** — a full-stack web app for AI-powered process mapping and optimization for medical clinics. Consultants upload documents, the system extracts process flows via RAG + LLM, generates BPMN 2.0 XML, and produces improvement/automation reports.

## Commands

### Backend (Python / FastAPI)

```bash
# Install dependencies
cd backend && pip install -r requirements.txt

# Run dev server (with auto-reload)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Build Docker image
docker build -f backend/Dockerfile -t clinicflow-backend:latest ./backend
```

### Frontend (Next.js / TypeScript)

```bash
# Install dependencies
cd frontend && npm install

# Dev server
npm run dev          # http://localhost:3000

# Production build
npm run build && npm start

# Lint
npm run lint
```

### Full Stack via Docker Compose

```bash
# Start all services (PostgreSQL + backend + optional frontend)
docker-compose up

# Rebuild after dependency changes
docker-compose up --build
```

### Environment Setup

```bash
cp .env.example .env
# Required keys: GEMINI_API_KEY, CLAUDE_API_KEY, DATABASE_URL, NEXT_PUBLIC_API_URL
```

No test suite exists yet.

## Architecture

### Data Flow

```
Documents uploaded → Document Parser (PDF/DOCX/Excel/CSV)
                   → RAG Service: chunk text + embeddings → pgvector (PostgreSQL)
                   → Semantic search retrieves context
                   → Gemini 2.0 Flash (or Claude fallback) analyzes process
                   → Clarification Q&A loop with consultant
                   → BPMN 2.0 XML generated
                   → Improvement + n8n automation reports generated
```

### Backend (`backend/`)

| File/Dir | Role |
|---|---|
| `main.py` | FastAPI app, mounts all routers |
| `database.py` | SQLAlchemy async setup, pgvector config |
| `models.py` | ORM models: Project, Document, DocumentChunk, ClarificationSession, Process, Report, KnowledgeItem, Feedback |
| `routers/projects.py` | Project CRUD |
| `routers/documents.py` | File upload, parsing, RAG indexing |
| `routers/analysis.py` | Process analysis, clarification loop, BPMN generation trigger |
| `routers/bpmn.py` | BPMN XML retrieval/download |
| `routers/reports.py` | Improvement & n8n automation report generation |
| `services/document_parser.py` | Text extraction from PDF, DOCX, XLSX, CSV, TXT |
| `services/rag_service.py` | Sentence-transformer embeddings + pgvector semantic search |
| `services/gemini_service.py` | Google Gemini 2.0 Flash integration (primary AI) |
| `services/claude_service.py` | Anthropic Claude integration (alternative/fallback AI) |
| `services/bpmn_generator.py` | BPMN 2.0 XML generation from analysis JSON |

Both `gemini_service.py` and `claude_service.py` expose the same interface — they are drop-in replacements for each other.

### Frontend (`frontend/src/`)

| Path | Role |
|---|---|
| `app/page.tsx` | Dashboard — lists all projects |
| `app/projects/[id]/page.tsx` | Project detail — documents, analysis, BPMN, reports |
| `app/knowledge/page.tsx` | Knowledge base management |
| `app/layout.tsx` | Root layout with `Sidebar.tsx` |
| `lib/api.ts` | All backend API calls + TypeScript types |
| `lib/useProjects.ts` | React hook for project state |
| `lib/geminiClient.ts` / `lib/aiClient.ts` | Browser-side AI client wrappers |

### Project Lifecycle States

`draft` → `analysis` → `bpmn_ready` → `complete`

### Database

PostgreSQL 16 with pgvector extension (Docker image: `pgvector/pgvector:pg16`). Embeddings use `all-MiniLM-L6-v2` (384 dimensions). Alembic handles migrations.

### Key Design Decisions

- All backend routes are **async** throughout (FastAPI + asyncpg + SQLAlchemy async).
- The frontend's `lib/api.ts` is the single source of truth for backend API contracts and TypeScript types.
- `NEXT_PUBLIC_API_URL` in `.env` controls which backend the frontend hits.
