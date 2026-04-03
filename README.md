# Message Control System (v1)

A mobile-friendly personal message triage and reply assistant.

## What this version includes

- Dashboard with message cards including sender, source, timestamp, content, priority, category, and status.
- Manual message intake form.
- Seed data with 12 realistic messages across family, friends, work, appointments, school, and spam.
- Simulated AI analysis on each message:
  - summary
  - category
  - urgency
  - recommended action
  - draft reply
- Message detail view for draft review/editing.
- Approval workflow (manual only):
  - save draft
  - approve
  - mark sent
  - set waiting
  - ignore
- Saved response library (pre-seeded + editable + add new).
- Filters and sorting (status, priority, category, source; newest/oldest/urgent first).
- Private notes per message.
- Settings page with editable:
  - default tone
  - preferred signature
  - auto-priority rules placeholder
  - AI prompt template placeholder

## Tech stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Persistence: local JSON file (`server/data/store.json`), structured so a DB can be added later.

## Project structure

```text
hd-performance-tracker-mvp/
  client/
    src/
      App.jsx
      api.js
      styles.css
  server/
    src/
      index.js
    data/
      store.json (auto-created with seed data)
```

## Run locally

### 1) Backend

```bash
cd hd-performance-tracker-mvp/server
npm install
npm run dev
```

Server runs on `http://localhost:4000`.

### 2) Frontend

In a separate terminal:

```bash
cd hd-performance-tracker-mvp/client
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## API overview

- `GET /metadata`
- `GET /messages`
- `GET /messages/:id`
- `POST /messages`
- `PATCH /messages/:id`
- `GET /saved-replies`
- `POST /saved-replies`
- `PATCH /saved-replies/:id`
- `GET /settings`
- `PATCH /settings`

## Future integration placeholders (designed in)

The code is organized so these can be added without major rewrites:

- OpenAI API integration for live drafting and analysis
- Gmail and WhatsApp adapters
- approval-before-send workflow to external services
- authentication + per-user data
- API-based message imports
- analytics dashboard

## Important behavior

- No automatic sending is implemented in v1.
- “Mark Sent” is manual only.
