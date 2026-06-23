# Feedback Management Platform

A full-stack feedback / pedagogical content management platform.

- **frontend/** — Next.js + Chakra UI interface (pages router, i18n FR/EN)
- **backend/** — Node.js + Express + Prisma REST API (Swagger docs at `/api-docs`)
- **db** — PostgreSQL database

Everything runs together via Docker Compose.

## Quick start

```bash
# 1. Configure environment (defaults work out of the box)
cp .env.example .env

# 2. Build and start the whole stack
docker compose up --build
```

On first start the backend automatically:
1. Syncs the Prisma schema to PostgreSQL (`prisma db push`)
2. Seeds default users (`prisma db seed`)

### URLs (default ports)

| Service      | URL                              |
|--------------|----------------------------------|
| Frontend     | http://localhost:3300            |
| Backend API  | http://localhost:3301            |
| Swagger docs | http://localhost:3301/api-docs   |
| PostgreSQL   | localhost:5433                   |

### Seeded accounts (password `123456`)

| Email                     | Role        |
|---------------------------|-------------|
| admin@example.com         | admin       |
| auteur@example.com        | auteur      |
| superadmin@example.com    | super_admin |

## Configuration

All settings live in `.env` (see `.env.example`). Ports, DB credentials,
`JWT_SECRET`, and optional SMTP credentials (`EMAIL_USER` / `EMAIL_PASS`) for
password-link emails can be customised there.

## Common commands

```bash
docker compose up --build        # build + run
docker compose up -d             # run detached
docker compose logs -f backend   # tail backend logs
docker compose down              # stop
docker compose down -v           # stop + wipe the database volume
```

## Local development (without Docker)

```bash
# Backend
cd backend
npm install
DATABASE_URL=postgresql://feedback:feedback@localhost:5433/feedback npx prisma db push
npm start

# Frontend
cd frontend
npm install
npm run dev
```
