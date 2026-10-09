# Setup, demo access & deployment

## Local development

Prerequisites: Python 3.12+, Node 18+.

```bash
# backend → http://localhost:8000
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python seed.py            # optional: an empty DB self-seeds on first boot
uvicorn main:app --port 8000

# frontend → http://localhost:3000 (new terminal)
cd frontend
npm install
npm run dev               # or: npm run build && npm start
```

Environment:

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | frontend (build time) | `http://localhost:8000` | API base URL |
| `STEPFORM_DB` | backend | `./typeform.db` (`/tmp/stepform.db` on Vercel) | SQLite file path |

Reset the database: `rm backend/typeform.db && cd backend && python seed.py`
(or just restart — an empty DB reseeds automatically).

## Demo access

There is **no login screen — by design**, not missing:

- The creator is permanently "signed in" (avatar `NB`, top-right). No password exists.
- Respondents need no account: open any published form's `/s/{id}` link.
- Try the seeded content: **Customer Feedback Survey** (`/s/demo01`, all question types),
  **Job Application** (`/s/demo02`, incl. dropdown), or publish the **Event RSVP** draft.
- Creators can preview drafts without publishing via `/s/{id}?draft=1` (responses aren't saved).

## Deployment

Two Vercel projects from this one repo (all via CLI):

```bash
# 1. backend → https://stepform-api.vercel.app
cd backend
vercel --prod --yes --name stepform-api

# 2. frontend, pointed at the API
cd ../frontend
printf '%s' 'https://stepform-api.vercel.app' \
  | vercel env add NEXT_PUBLIC_API_URL production --force
vercel --prod --yes --name stepform
```

How it works / what to know:

- Vercel runs the FastAPI `app` in `backend/main.py` natively (Python runtime, zero config).
- Serverless filesystems are ephemeral: the database lives in `/tmp` and **resets on cold
  starts** — the app detects this and reseeds the sample data automatically, so the demo never
  breaks. This is accepted behavior for the demo; run your own persistent SQLite/Postgres for
  anything real by setting `STEPFORM_DB` (SQLite path) accordingly.
- `NEXT_PUBLIC_*` vars bake in at frontend **build** time — set the env var before deploying.

Why not Cloudflare Workers? Python Workers exist and even support FastAPI, but Workers have no
filesystem (local SQLite impossible) and D1 would require rewriting all data access against
binding APIs — a worse demo and a harder interview. Vercel keeps the exact code you see here.

Note: if a CLI deploy ever comes back `Blocked` ("commit author doesn't have permission"),
Redeploy that deployment from the dashboard, or run `vercel git connect` so pushes deploy
automatically instead.
