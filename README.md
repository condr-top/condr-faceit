# CONDR Faceit

Competitive matchmaking platform for Standoff 2, built as a Telegram WebApp.

## Stack

**Frontend:** Next.js 14 + TypeScript + TailwindCSS + Framer Motion + Zustand  
**Backend:** NestJS + TypeORM + PostgreSQL + Redis + Socket.io  
**Auth:** Telegram WebApp initData HMAC validation + JWT  

## Quick Start

### 1. Prerequisites

- Node.js 18+
- Docker Desktop (for PostgreSQL + Redis)

### 2. Start databases

```bash
cd condr_faceit
docker-compose up -d
```

### 3. Backend

```bash
cd backend
npm install
npm run start:dev
```

Runs on http://localhost:4000

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:3000

### 5. Dev login

The frontend auto-logins with Telegram ID 1145050367 in development mode.  
To change: edit `src/app/auth/page.tsx` and update the `devTelegramId`.

## ELO System

- Start: 1000
- K-factor: 32 (dynamic planned)
- Team balancing: brute-force all C(10,5)=252 combinations, pick lowest avg ELO diff
- Expected score: standard Elo formula `1 / (1 + 10^((oppAvg - myAvg)/400))`
- Minimum ELO: 100

## ELO Ranks

| Rank    | ELO     |
|---------|---------|
| BRONZE  | < 900   |
| SILVER  | 900-1099|
| GOLD    | 1100-1299|
| PLATINUM| 1300-1599|
| DIAMOND | 1600-1999|
| ELITE   | 2000+   |

## Maps

PRISON, SANDSTONE, PROVINCE, BREEZE, HANAMI, RUST, DUNE

## Map Veto

6 bans (alternating A→B), last remaining map is played.

## Match Flow

1. 10 players found in queue
2. 20s ready check (all must click Ready)
3. Map veto (6 rounds alternating)
4. Match in progress (host creates room manually)
5. Both teams submit screenshots with score
6. Admin confirms result → ELO applied

## Admin

First user with telegramId 1145050367 or 313909752 auto-gets admin.  
Admin panel: Profile → "Панель администратора"

## Environment

### Backend `.env`
```
DATABASE_URL=postgresql://condr:condr_secret@localhost:5432/condr_faceit
REDIS_URL=redis://localhost:6379
JWT_SECRET=condr-faceit-super-secret-2026
BOT_TOKEN=your_bot_token
FRONTEND_URL=http://localhost:3000
PORT=4000
```

### Frontend `.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
```
