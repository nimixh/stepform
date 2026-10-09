"""FastAPI backend for Stepform."""

from __future__ import annotations
import csv
import io
import json
import os
import re
import uuid
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends, Response as FastAPIResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker, Session

from models import Base, Form, Question, Response, Answer

# Local dev persists next to the code; serverless (Vercel) only allows /tmp,
# which is ephemeral — instances reseed themselves (see ensure_seed).
DB_PATH = os.getenv(
    "STEPFORM_DB", "/tmp/stepform.db" if os.getenv("VERCEL") else "./typeform.db"
)
DATABASE_URL = f"sqlite:///{DB_PATH}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)


def ensure_seed() -> None:
    """Seed an empty database so fresh clones and cold instances just work."""
    db = SessionLocal()
    try:
        if db.query(Form).count() == 0:
            from seed import seed_db

            seed_db(db)
    finally:
        db.close()


ensure_seed()

app = FastAPI(title="Stepform API")

app.add_middleware(
    CORSMiddleware,
    # No cookies/auth in this app, so no credentials — plain open CORS.
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


ALLOWED_TYPES = {
    "short_text",
    "long_text",
    "multiple_choice",
    "dropdown",
    "email",
    "number",
    "yes_no",
    "rating",
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def form_to_dict(f: Form, db: Session) -> dict:
    qs = (
        db.query(Question)
        .filter(Question.form_id == f.id)
        .order_by(Question.position)
        .all()
    )
    rcount = (
        db.query(func.count(Response.id)).filter(Response.form_id == f.id).scalar() or 0
    )
    return {
        "id": f.id,
        "title": f.title,
        "description": f.description,
        "status": f.status,
        "theme_bg": f.theme_bg,
        "theme_text": f.theme_text,
        "theme_button": f.theme_button,
        "theme_font": f.theme_font,
        "welcome_enabled": f.welcome_enabled,
        "welcome_title": f.welcome_title,
        "welcome_description": f.welcome_description,
        "welcome_button": f.welcome_button,
        "thankyou_title": f.thankyou_title,
        "thankyou_description": f.thankyou_description,
        "created_at": f.created_at.isoformat() if f.created_at else None,
        "updated_at": f.updated_at.isoformat() if f.updated_at else None,
        "questions": [q_to_dict(q) for q in qs],
        "response_count": rcount,
    }


def q_to_dict(q: Question) -> dict:
    return {
        "id": q.id,
        "form_id": q.form_id,
        "type": q.type,
        "title": q.title,
        "description": q.description,
        "required": bool(q.required),
        "position": q.position,
        "settings": q.settings or {},
    }


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_answers(
    form_questions: list[Question], answers: list[dict]
) -> dict[str, str]:
    """Returns {question_id: error} if invalid."""
    errors: dict[str, str] = {}
    amap = {
        a.get("question_id"): ("" if a.get("value") is None else str(a.get("value")))
        for a in answers
    }
    for q in form_questions:
        raw = amap.get(q.id, "").strip()
        if q.required and not raw:
            errors[q.id] = "This question is required"
            continue
        if not raw:
            continue
        if q.type in ("multiple_choice", "dropdown"):
            opts = (q.settings or {}).get("options", [])
            labels = {o.get("label", "") for o in opts if isinstance(o, dict)}
            if labels and raw not in labels:
                errors[q.id] = "Please choose one of the available options"
        elif q.type == "email" and not EMAIL_RE.match(raw):
            errors[q.id] = "Please enter a valid email address"
        elif q.type == "number":
            # Same plain-decimal rule as the client: rejects hex/nan/inf.
            if not re.fullmatch(r"-?\d+(\.\d+)?", raw):
                errors[q.id] = "Please enter a valid number"
        elif q.type == "rating":
            try:
                # int() on purpose: "3.5" is not a valid rating step.
                v = int(raw)
                mx = int((q.settings or {}).get("max_rating", 5))
                if not (1 <= v <= mx):
                    errors[q.id] = f"Pick a rating between 1 and {mx}"
            except ValueError:
                errors[q.id] = "Please pick a rating"
        elif q.type == "yes_no":
            if raw.lower() not in ("yes", "no", "true", "false", "1", "0", "y", "n"):
                errors[q.id] = "Please answer Yes or No"
    return errors


# ---------- Forms CRUD ----------


@app.get("/api/forms")
def list_forms(db: Session = Depends(get_db)):
    forms = db.query(Form).order_by(Form.updated_at.desc()).all()
    out = []
    for f in forms:
        rcount = (
            db.query(func.count(Response.id)).filter(Response.form_id == f.id).scalar()
            or 0
        )
        out.append(
            {
                "id": f.id,
                "title": f.title,
                "description": f.description,
                "status": f.status,
                "response_count": rcount,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
                "question_count": db.query(func.count(Question.id))
                .filter(Question.form_id == f.id)
                .scalar()
                or 0,
            }
        )
    return out


@app.post("/api/forms", status_code=201)
def create_form(payload: dict = {}, db: Session = Depends(get_db)):
    f = Form(
        id=uuid.uuid4().hex[:8],
        title=payload.get("title", "New form"),
        description=payload.get("description", ""),
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return form_to_dict(f, db)


@app.get("/api/forms/{form_id}")
def get_form(form_id: str, db: Session = Depends(get_db)):
    f = db.query(Form).filter(Form.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form not found")
    return form_to_dict(f, db)


@app.put("/api/forms/{form_id}")
def update_form(form_id: str, payload: dict, db: Session = Depends(get_db)):
    f = db.query(Form).filter(Form.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form not found")
    for k in (
        "title",
        "description",
        "theme_bg",
        "theme_text",
        "theme_button",
        "theme_font",
        "welcome_enabled",
        "welcome_title",
        "welcome_description",
        "welcome_button",
        "thankyou_title",
        "thankyou_description",
    ):
        if k in payload:
            setattr(f, k, payload[k])
    f.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(f)
    return form_to_dict(f, db)


@app.delete("/api/forms/{form_id}")
def delete_form(form_id: str, db: Session = Depends(get_db)):
    f = db.query(Form).filter(Form.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form not found")
    db.delete(f)
    db.commit()
    return {"ok": True}


@app.post("/api/forms/{form_id}/duplicate", status_code=201)
def duplicate_form(form_id: str, db: Session = Depends(get_db)):
    src = db.query(Form).filter(Form.id == form_id).first()
    if not src:
        raise HTTPException(404, "Form not found")
    nf = Form(
        id=uuid.uuid4().hex[:8],
        title=src.title + " (copy)",
        description=src.description,
        status="draft",
        theme_bg=src.theme_bg,
        theme_text=src.theme_text,
        theme_button=src.theme_button,
        theme_font=src.theme_font,
        welcome_enabled=src.welcome_enabled,
        welcome_title=src.welcome_title,
        welcome_description=src.welcome_description,
        welcome_button=src.welcome_button,
        thankyou_title=src.thankyou_title,
        thankyou_description=src.thankyou_description,
    )
    db.add(nf)
    db.flush()
    qs = (
        db.query(Question)
        .filter(Question.form_id == src.id)
        .order_by(Question.position)
        .all()
    )
    for q in qs:
        db.add(
            Question(
                id=str(uuid.uuid4()),
                form_id=nf.id,
                type=q.type,
                title=q.title,
                description=q.description,
                required=q.required,
                position=q.position,
                settings=dict(q.settings or {}),
            )
        )
    db.commit()
    db.refresh(nf)
    return form_to_dict(nf, db)


@app.post("/api/forms/{form_id}/publish")
def publish_form(form_id: str, db: Session = Depends(get_db)):
    f = db.query(Form).filter(Form.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form not found")
    f.status = "published"
    f.updated_at = datetime.utcnow()
    db.commit()
    return form_to_dict(f, db)


@app.post("/api/forms/{form_id}/unpublish")
def unpublish_form(form_id: str, db: Session = Depends(get_db)):
    f = db.query(Form).filter(Form.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form not found")
    f.status = "draft"
    f.updated_at = datetime.utcnow()
    db.commit()
    return form_to_dict(f, db)


# ---------- Questions ----------


@app.post("/api/forms/{form_id}/questions", status_code=201)
def add_question(form_id: str, payload: dict, db: Session = Depends(get_db)):
    f = db.query(Form).filter(Form.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form not found")
    mx = (
        db.query(func.max(Question.position))
        .filter(Question.form_id == form_id)
        .scalar()
    )
    pos = payload.get("position")
    if pos is None:
        pos = (mx + 1) if mx is not None else 0
    qtype = payload.get("type", "short_text")
    if qtype not in ALLOWED_TYPES:
        raise HTTPException(422, f"Unknown question type: {qtype}")
    q = Question(
        id=str(uuid.uuid4()),
        form_id=form_id,
        type=qtype,
        title=payload.get("title", "..."),
        description=payload.get("description", ""),
        required=bool(payload.get("required", False)),
        position=pos,
        settings=payload.get("settings", {}),
    )
    db.add(q)
    f.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    return q_to_dict(q)


@app.put("/api/questions/{qid}")
def update_question(qid: str, payload: dict, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == qid).first()
    if not q:
        raise HTTPException(404, "Question not found")
    if "type" in payload and payload["type"] not in ALLOWED_TYPES:
        raise HTTPException(422, f"Unknown question type: {payload['type']}")
    for k in ("type", "title", "description", "required", "position", "settings"):
        if k in payload:
            setattr(q, k, payload[k])
    f = db.query(Form).filter(Form.id == q.form_id).first()
    if f:
        f.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    return q_to_dict(q)


@app.delete("/api/questions/{qid}")
def delete_question(qid: str, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == qid).first()
    if not q:
        raise HTTPException(404, "Question not found")
    fid = q.form_id
    db.delete(q)
    # Flush the delete first: with autoflush off, the renumber query below
    # would otherwise still see the deleted row and leave a position gap.
    db.flush()
    # renumber
    rest = (
        db.query(Question)
        .filter(Question.form_id == fid)
        .order_by(Question.position)
        .all()
    )
    for i, r in enumerate(rest):
        r.position = i
    db.commit()
    return {"ok": True}


@app.put("/api/forms/{form_id}/reorder")
def reorder_questions(form_id: str, payload: dict, db: Session = Depends(get_db)):
    order: list[str] = payload.get("order", [])
    existing = {
        qid
        for (qid,) in db.query(Question.id).filter(Question.form_id == form_id).all()
    }
    if set(order) != existing:
        raise HTTPException(422, "order must list exactly the form's questions")
    for i, qid in enumerate(order):
        db.query(Question).filter(
            Question.id == qid, Question.form_id == form_id
        ).update({"position": i})
    db.commit()
    qs = (
        db.query(Question)
        .filter(Question.form_id == form_id)
        .order_by(Question.position)
        .all()
    )
    return [q_to_dict(q) for q in qs]


# ---------- Public respondent ----------


@app.get("/api/public/forms/{form_id}")
def public_get(form_id: str, db: Session = Depends(get_db)):
    f = db.query(Form).filter(Form.id == form_id).first()
    if not f or f.status != "published":
        raise HTTPException(404, "Form not found or not published")
    return form_to_dict(f, db)


@app.post("/api/public/forms/{form_id}/responses", status_code=201)
def public_submit(form_id: str, payload: dict, db: Session = Depends(get_db)):
    f = db.query(Form).filter(Form.id == form_id).first()
    if not f or f.status != "published":
        raise HTTPException(404, "Form not found or not published")
    qs = (
        db.query(Question)
        .filter(Question.form_id == form_id)
        .order_by(Question.position)
        .all()
    )
    answers = payload.get("answers", [])
    errors = validate_answers(qs, answers)
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors})
    r = Response(id=str(uuid.uuid4()), form_id=form_id)
    db.add(r)
    db.flush()
    amap = {a.get("question_id"): a.get("value", "") for a in answers}
    for q in qs:
        v = amap.get(q.id, "")
        if v is None:
            v = ""
        if isinstance(v, (list, dict)):
            v = json.dumps(v)
        else:
            v = str(v)
        db.add(
            Answer(id=str(uuid.uuid4()), response_id=r.id, question_id=q.id, value=v)
        )
    db.commit()
    return {"id": r.id, "ok": True}


# ---------- Results ----------


@app.get("/api/forms/{form_id}/responses")
def list_responses(form_id: str, db: Session = Depends(get_db)):
    f = db.query(Form).filter(Form.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form not found")
    qs = (
        db.query(Question)
        .filter(Question.form_id == form_id)
        .order_by(Question.position)
        .all()
    )
    rs = (
        db.query(Response)
        .filter(Response.form_id == form_id)
        .order_by(Response.submitted_at.desc())
        .all()
    )
    out = []
    for r in rs:
        ans = {
            a.question_id: a.value
            for a in db.query(Answer).filter(Answer.response_id == r.id).all()
        }
        out.append(
            {
                "id": r.id,
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
                "answers": [
                    {"question_id": q.id, "value": ans.get(q.id, "")} for q in qs
                ],
            }
        )
    return {"questions": [q_to_dict(q) for q in qs], "responses": out}


@app.get("/api/forms/{form_id}/responses/{rid}")
def get_response(form_id: str, rid: str, db: Session = Depends(get_db)):
    r = (
        db.query(Response)
        .filter(Response.id == rid, Response.form_id == form_id)
        .first()
    )
    if not r:
        raise HTTPException(404, "Response not found")
    qs = (
        db.query(Question)
        .filter(Question.form_id == form_id)
        .order_by(Question.position)
        .all()
    )
    ans = {
        a.question_id: a.value
        for a in db.query(Answer).filter(Answer.response_id == r.id).all()
    }
    return {
        "id": r.id,
        "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
        "answers": [{"question": q_to_dict(q), "value": ans.get(q.id, "")} for q in qs],
    }


@app.get("/api/forms/{form_id}/stats")
def form_stats(form_id: str, db: Session = Depends(get_db)):
    f = db.query(Form).filter(Form.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form not found")
    qs = (
        db.query(Question)
        .filter(Question.form_id == form_id)
        .order_by(Question.position)
        .all()
    )
    answers_all = (
        db.query(Answer)
        .join(Response, Answer.response_id == Response.id)
        .filter(Response.form_id == form_id)
        .all()
    )
    by_q: dict[str, list[str]] = {q.id: [] for q in qs}
    for a in answers_all:
        if a.question_id in by_q:
            by_q[a.question_id].append(a.value or "")
    total = (
        db.query(func.count(Response.id)).filter(Response.form_id == form_id).scalar()
        or 0
    )
    stats = []
    for q in qs:
        vals = [v for v in by_q[q.id] if v != ""]
        s: dict = {
            "question_id": q.id,
            "type": q.type,
            "answered": len(vals),
            "total": total,
        }
        if q.type in ("multiple_choice", "dropdown", "yes_no", "rating"):
            counts: dict[str, int] = {}
            for v in vals:
                counts[v] = counts.get(v, 0) + 1
            s["counts"] = counts
            if q.type == "rating" and vals:
                try:
                    nums = [float(v) for v in vals]
                    s["average"] = round(sum(nums) / len(nums), 2)
                except ValueError:
                    s["average"] = None
        else:
            s["samples"] = vals[:5]
        stats.append(s)
    # NOTE: completion_rate is intentionally omitted — without partial-response
    # tracking any value here would be fabricated. Per-question answered/total
    # ratios above are the honest signal.
    return {"total_responses": total, "stats": stats}


@app.get("/api/forms/{form_id}/export.csv")
def export_csv(form_id: str, db: Session = Depends(get_db)):
    f = db.query(Form).filter(Form.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form not found")
    qs = (
        db.query(Question)
        .filter(Question.form_id == form_id)
        .order_by(Question.position)
        .all()
    )
    rs = (
        db.query(Response)
        .filter(Response.form_id == form_id)
        .order_by(Response.submitted_at.asc())
        .all()
    )
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["response_id", "submitted_at"] + [q.title for q in qs])
    for r in rs:
        amap = {
            a.question_id: a.value
            for a in db.query(Answer).filter(Answer.response_id == r.id).all()
        }
        w.writerow(
            [r.id, r.submitted_at.isoformat() if r.submitted_at else ""]
            + [amap.get(q.id, "") for q in qs]
        )
    return FastAPIResponse(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=form-{form_id}-responses.csv"
        },
    )


@app.get("/api/health")
def health():
    return {"ok": True}
