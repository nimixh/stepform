# Architecture

How Stepform fits together: a Next.js frontend talking to a FastAPI backend over a small JSON
API, with SQLite underneath. No auth service, no ORM magic beyond vanilla SQLAlchemy, no
framework CSS — every layer is explainable in an interview.

## System

```mermaid
flowchart LR
    Creator([Creator browser]) --> FE[Next.js 14 frontend]
    Respondent([Respondent browser]) --> FE
    FE -->|dashboard + builder<br>GET/PUT/POST/DELETE /api/forms...| API[FastAPI backend]
    FE -->|fill flow, no auth<br>GET /api/public/forms/:id<br>POST /api/public/forms/:id/responses| API
    API --> DB[(SQLite)]
    SEED[seed.py / ensure_seed] --> DB
```

- `frontend/` — three routes: `/` (dashboard), `/forms/[id]` (builder with Content/Share/Results
  tabs), `/s/[id]` (public respondent flow). Typed API client in `frontend/lib/api.ts`.
- Dark mode covers the creator workspace only: a `data-theme` attribute on `<html>`
  (`components/theme.tsx`, sun/moon toggle, stored preference with OS fallback, applied before
  first paint), with all colors flowing through CSS variables in `app/globals.css`. The
  respondent flow always renders the form's own theme, untouched.
- `backend/main.py` — all routes plus server-side validation (`validate_answers`).
- `backend/models.py` — four tables (below). `backend/seed.py` builds the demo dataset and is
  re-run automatically when the database is empty (fresh clones, serverless cold starts).

## Data model (key columns — see `models.py` for the full detail)

```mermaid
erDiagram
    FORMS ||--o{ QUESTIONS : has
    FORMS ||--o{ RESPONSES : collects
    RESPONSES ||--o{ ANSWERS : contains
    QUESTIONS ||--o{ ANSWERS : answered-by
    FORMS {
        string id PK
        string title
        string status
        string theme_bg
        string theme_text
        string theme_button
        string theme_font
        boolean welcome_enabled
        string welcome_title
        string thankyou_title
    }
    QUESTIONS {
        string id PK
        string form_id FK
        string type
        string title
        string description
        boolean required
        int position
        json settings
    }
    RESPONSES {
        string id PK
        string form_id FK
        datetime submitted_at
    }
    ANSWERS {
        string id PK
        string response_id FK
        string question_id FK
        text value
    }
```

```
forms (id PK short hex, title, description, status draft|published,
       theme_bg/text/button/font, welcome_enabled/title/description/button,
       thankyou_title/description, created_at, updated_at)
  1───* questions (id PK uuid, form_id FK→forms, type, title, description,
                   required, position, settings JSON {options[], max_rating})
  1───* responses (id PK uuid, form_id FK→forms, submitted_at)
            1───* answers (id PK uuid, response_id FK→responses,
                           question_id FK→questions, value TEXT)
```

Design notes:

- All 8 question types share one table; type-specific config (`options[]`, `max_rating`) lives in
  the `settings` JSON column. New types need no migration — the API whitelists them
  (`ALLOWED_TYPES` in `main.py`).
- Answers are stored as plain text (numbers/ratings are validated, then stringified), which keeps
  the CSV export a straight row dump.
- Deletes cascade: form → questions → responses → answers; deleting a question deletes its answers
  and renumbers the survivors. No partial-response tracking by design (see
  [setup](setup.md#demo-access) — an honest omission, not a missing feature.

## Respondent flow (one question at a time)

```mermaid
flowchart TD
    A[Open /s/:id] --> B{Form published?}
    B -- No --> X[Not-available screen]
    B -- Yes --> C{Welcome screen enabled?}
    C -- Yes --> W[Welcome + Start] --> Q
    C -- No --> Q[Question N of M]
    Q --> V{Validate answer}
    V -- Invalid --> E[Inline error + shake]
    E --> Q
    V -- Valid --> N{Last question?}
    N -- No --> Q
    N -- Yes --> S[POST responses]
    S --> OK{422 errors?}
    OK -- Yes --> Q
    OK -- No --> T[Thank-you screen]
```

Keyboard: `Enter` advances (opens/commits dropdowns), `↑`/`↓` move or navigate, `1–9`/`0`
pick choices/ratings, `Y`/`N` answer yes/no.

## Builder autosave

```mermaid
sequenceDiagram
    participant C as Creator
    participant UI as Builder (React state)
    participant API as FastAPI
    participant DB as SQLite
    C->>UI: Edit title / question / toggle
    UI->>UI: Optimistic update + 600ms debounce (separate timers per form / per question)
    UI->>API: PUT /api/forms/:id or PUT /api/questions/:qid
    API->>DB: UPDATE + touch updated_at
    API-->>UI: 200 OK
```

Reorders are optimistic too, then confirmed with `PUT /api/forms/:id/reorder`. Pending edits flush
on page leave, so rapid interleaved edits can't cancel each other.
