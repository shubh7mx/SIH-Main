# 🛰️ SIH26162 — AI-Based Thermal Anomaly & Industrial Fire Detection

> **Sponsoring Organization:** National Technical Research Organisation (NTRO)  
> **Problem Statement ID:** SIH26162  
> **Domain:** Geospatial Intelligence (GEOINT), Thermal Remote Sensing, Multi-Agent Anomaly Detection  

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js:** v20+ / v22+
- **pnpm:** v9+
- **Python:** v3.11+ / v3.13
- **Docker & Docker Compose**

### 2. Start Infrastructure
```bash
docker compose up -d
```
This boots:
- **PostgreSQL 17 + PostGIS 3.6** (`localhost:5432`)
- **Redpanda 24.x** (`localhost:9092`) + Redpanda Console (`localhost:8080`)
- **RisingWave 2.x** (`localhost:4566`)
- **Qdrant Vector DB** (`localhost:6333`)
- **Redis 7** (`localhost:6379`)
- **MinIO S3** (`localhost:9000`, UI at `9001`)

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Run Development Servers
```bash
# Run both Frontend & Backend
pnpm dev

# Or run separately:
# Frontend (Next.js 15): http://localhost:3000
# Backend (FastAPI):     http://localhost:8000/docs
```

---

## 🏗️ Architecture Monorepo Layout

```
SIH26162/
├── apps/
│   ├── web/               # Next.js 15 + React 19 + deck.gl + Tailwind 4 (Dark Tactical UI)
│   └── api/               # FastAPI + Pydantic v2 + WebSocket Gateway
├── packages/
│   ├── agents/            # LangGraph 1.2 Multi-Agent Swarm (Python)
│   ├── database/          # PostGIS schema, migrations, Drizzle ORM models
│   └── contracts/         # Shared TypeScript types & JSON schemas
├── docker-compose.yml     # Complete 2026 local microservice stack
├── turbo.json             # Turborepo build pipeline
└── agents.md              # Master System Architecture & Production Specifications
```
