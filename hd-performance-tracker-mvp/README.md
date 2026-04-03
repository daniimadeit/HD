# Message Control System

Message Control System is a personal message triage and reply assistant. You can intake messages, review simulated AI draft replies, approve/edit, and manually mark as sent.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Local persistence: `server/data/store.json`

## Run locally

### 1) Backend

```bash
cd hd-performance-tracker-mvp/server
cp .env.example .env
npm install
npm run dev
```

Backend runs on `http://localhost:4000`.

### 2) Frontend

```bash
cd hd-performance-tracker-mvp/client
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

---

## Environment variables

In `server/.env`:

- `PORT`
- `ZAPIER_WEBHOOK_SECRET`
- `ZAPIER_OUTGOING_WEBHOOK_URL`

In `client/.env`:

- `VITE_ZAPIER_WEBHOOK_SECRET` (must match `ZAPIER_WEBHOOK_SECRET`)

---

## Zapier integration

### A) Incoming (Zapier → App)
Use **Webhooks by Zapier** with action **POST**.

- URL: `http://localhost:4000/api/messages/incoming`
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <ZAPIER_WEBHOOK_SECRET>`
- Body (JSON):

```json
{
  "sender": "Jordan",
  "source": "gmail",
  "message": "Can you confirm our call tomorrow at 10?",
  "timestamp": "2026-04-03T15:30:00.000Z",
  "contact": "jordan@example.com"
}
```

Success response:

```json
{ "success": true }
```

### B) Outgoing (App → Zapier)
Create a Zap using **Webhooks by Zapier → Catch Hook**.

1. Zapier gives you a hook URL.
2. Put that URL into `ZAPIER_OUTGOING_WEBHOOK_URL` in `server/.env`.
3. In the app, open Message Detail and click **Send to Zapier**.

The app sends this payload to Zapier:

```json
{
  "to": "jordan@example.com",
  "source": "gmail",
  "message": "Thanks for reaching out! I can confirm and follow up shortly. — Thanks",
  "originalMessageId": 14
}
```

Server response:

```json
{ "success": true }
```

---

## Webhook security

Both webhook endpoints require:

`Authorization: Bearer <token>`

The token must match `ZAPIER_WEBHOOK_SECRET`.

If invalid, server returns `401 Unauthorized`.

---

## Endpoints

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
- `POST /api/messages/incoming` (protected)
- `POST /api/messages/send-approved` (protected)

---

## Notes

- No automatic send to end channels (SMS/email/WhatsApp) is implemented.
- Status updates remain user-controlled from the app workflow.
