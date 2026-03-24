# Hackathon 2026 - Avasar Patra

Avasar Patra is a full-stack procurement intelligence platform for Nepal SME vendors.
It ingests publicly available PPMO tender data, matches tenders to vendor profiles, and helps vendors decide and prepare faster.

## What This Project Solves

Government procurement notices are hard to navigate for small local businesses.
This platform provides:

- Vendor profile based matching (category, district, capacity)
- Personalized tender feed with match insights
- Notifications for matching tenders (in-app, optional email)
- Bookmark and tracking workflow
- Category-based checklist and document readiness support

## Core Features

- Authentication and role-aware access (vendor/admin)
- Personalized tender ranking and decision insights
- Boardroom brief with recommendation, pressure snapshot, and simulation
- Bookmark tracking and operations workflow
- Document vault with expiry handling
- Admin panel for scraper runs, digests, and trend stats

## Tech Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: MongoDB with Mongoose
- Data ingestion: Puppeteer scraper for PPMO sources
- Notifications: In-app alerts, SMTP-based email pipeline

## Workspace Structure

```text
hackathon-2026/
  client/
    public/
    src/
      api/
      assets/
      components/
      context/
      hooks/
      pages/
    index.html
    package.json
    vite.config.js
    tailwind.config.js

  server/
    controllers/
    middleware/
    models/
    routes/
    scrapers/
    utils/
    uploads/
    index.js
    seed.js
    package.json

  .gitignore
  README.md
```

## Quick Start

### 1) Install dependencies

```bash
cd client && npm install
cd ../server && npm install
```

### 2) Configure environment

Create or update `server/.env` with at least:

- `MONGO_URI`
- `JWT_SECRET`
- Optional email keys:
  - `EMAIL_NOTIFICATIONS_ENABLED`
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

### 3) Seed and run

```bash
cd server
npm run seed
npm start
```

In another terminal:

```bash
cd client
npm run dev
```

## Notes

- Node modules are intentionally ignored by git via `.gitignore`.
- Email alert sending requires SMTP configuration and `EMAIL_NOTIFICATIONS_ENABLED=true`.
- Scraper and digest schedulers can be toggled through environment flags.
