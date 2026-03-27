# HD Performance Tracker MVP

A simple full-stack MVP for a martial arts school to track students, private lesson packages, lesson usage, progress notes, and renewal risks.

## Folder structure

```text
hd-performance-tracker-mvp/
  server/
    prisma/
      schema.prisma
    src/
      index.js
    package.json
    .env.example
  client/
    src/
      App.jsx
      main.jsx
      api.js
      styles.css
    index.html
    package.json
```

## Features

- Student management (create + list + detail)
- Private package creation
- Session logging
  - Automatically increments used sessions for linked packages
  - Prevents logging when no sessions remain
- Progress note creation
- Dashboard visibility
  - Active students
  - Active packages
  - Renewal risk packages (2 or fewer sessions remaining)

## Install steps

### 1) Backend install

```bash
cd hd-performance-tracker-mvp/server
cp .env.example .env
npm install
```

### 2) Prisma setup

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 3) Run backend

```bash
npm run dev
```

Backend runs at `http://localhost:4000`.

### 4) Frontend install and run

```bash
cd ../client
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## API endpoints

- `GET /`
- `GET /dashboard`
- `GET /students`
- `GET /students/:id`
- `POST /students`
- `POST /packages`
- `GET /packages/renewals`
- `POST /sessions`
- `POST /notes`
