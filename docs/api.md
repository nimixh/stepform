# API reference

Base URL: `http://localhost:8000` locally (see [Setup](setup.md) for the deployed URLs).
All bodies and responses are JSON. No authentication on any route (by design — see assumptions).

## Forms

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/forms` | list, newest first, with `response_count` + `question_count` |
| POST | `/api/forms` | create → `{"title": "New form"}` (201) |
| GET | `/api/forms/{id}` | detail with nested ordered `questions` + `response_count` |
| PUT | `/api/forms/{id}` | patch theme/welcome/thank-you/title (autosave target) |
| DELETE | `/api/forms/{id}` | cascade-deletes questions, responses, answers |
| POST | `/api/forms/{id}/duplicate` | deep copy with questions, stays `draft` (201) |
| POST | `/api/forms/{id}/publish` | status → `published` (link goes live) |
| POST | `/api/forms/{id}/unpublish` | status → `draft` |

## Questions

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/forms/{id}/questions` | append at end; `type` must be one of the 8 allowed (else 422) |
| PUT | `/api/questions/{qid}` | patch any field; unknown `type` → 422 |
| DELETE | `/api/questions/{qid}` | deletes its answers too, renumbers survivors |
| PUT | `/api/forms/{id}/reorder` | `{"order": ["qid1", "qid2", …]}` — must list exactly the form's questions (else 422) |

Allowed types: `short_text`, `long_text`, `multiple_choice`, `dropdown`, `email`, `number`,
`yes_no`, `rating`. Choice/dropdown options live in `settings.options` as
`[{id, label}]`; rating steps in `settings.max_rating`.

## Public respondent (no auth)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/public/forms/{id}` | published forms only, else 404 |
| POST | `/api/public/forms/{id}/responses` | `{"answers": [{"question_id", "value"}]}` → 201 `{id}`, or 422 `{errors: {qid: msg}}` |

## Results

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/forms/{id}/responses` | questions + all submissions (newest first) |
| GET | `/api/forms/{id}/responses/{rid}` | one full submission (404 on unknown id) |
| GET | `/api/forms/{id}/stats` | `total_responses` + per-question `answered/total`, `counts`, rating `average` |
| GET | `/api/forms/{id}/export.csv` | CSV download, question titles as headers |

## Validation (client + server)

| Rule | Client | Server |
|------|--------|--------|
| Required | "Please fill this in" | "This question is required" (422) |
| Email | regex | same regex (422) |
| Number | plain-decimal regex | same regex (422) — rejects hex/`nan`/`inf` |
| Rating | integer within `1..max_rating` | same, via strict `int()` (422) |
| Choice/dropdown | UI only offers listed options (click/keys) | must match `settings.options` labels (422) |
| Yes/No | `Y`/`N` keys, buttons | accepts yes/no/true/false/1/0/y/n (422 otherwise) |

## Examples

```bash
# list forms
curl localhost:8000/api/forms | python3 -m json.tool | head -20

# submit a response (all-or-nothing: any invalid answer → 422, nothing stored)
curl -X POST localhost:8000/api/public/forms/demo01/responses \
  -H 'Content-Type: application/json' \
  -d '{"answers":[{"question_id":"<qid>","value":"Ava"}]}'

# download responses
curl -O localhost:8000/api/forms/demo01/export.csv
```
