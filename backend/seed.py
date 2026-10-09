"""Seed the database with sample published forms + responses.

Run directly to (re)build a local database::

    python seed.py

The ``seed_db`` function is also imported by ``main.py`` so serverless
instances (Vercel) and fresh clones self-seed on first boot.
"""

import os
import random
import uuid
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Answer, Base, Form, Question, Response

DB_FILE = os.getenv("STEPFORM_DB", "./typeform.db")


def seed_db(db):
    """Wipe and reseed everything. Takes an open SQLAlchemy session."""

    def mkform(fid, title, desc, status="published", welcome=False):
        f = Form(
            id=fid,
            title=title,
            description=desc,
            status=status,
            welcome_enabled=welcome,
            welcome_title="Hey there 👋, let's get to know you",
            welcome_description="This will take about 2 minutes.",
            welcome_button="Start",
            thankyou_title="Thanks for completing this form 🙏",
            thankyou_description="We appreciate your time. Now it's time to create your own form.",
        )
        db.add(f)
        return f

    def q(form_id, pos, typ, title, desc="", req=True, settings=None):
        qq = Question(
            id=str(uuid.uuid4()),
            form_id=form_id,
            position=pos,
            type=typ,
            title=title,
            description=desc,
            required=req,
            settings=settings or {},
        )
        db.add(qq)
        db.flush()
        return qq

    # wipe
    for t in (Answer, Response, Question, Form):
        db.query(t).delete()
    db.commit()

    mkform(
        "demo01",
        "Customer Feedback Survey",
        "Help us improve — 2 min survey",
        "published",
        welcome=True,
    )
    mkform(
        "demo02",
        "Job Application — Product Designer",
        "Tell us about yourself",
        "published",
        welcome=True,
    )
    mkform(
        "draft01", "Untitled — Event RSVP", "Draft form to play with builder", "draft"
    )

    # Form 1 questions (mixed types)
    q1 = q("demo01", 0, "short_text", "What's your name?", "First things first", True)
    q2 = q(
        "demo01",
        1,
        "email",
        "What's your email address?",
        "We'll only use it to follow up",
        True,
    )
    q3 = q(
        "demo01",
        2,
        "rating",
        "How would you rate your overall experience?",
        "1 = poor, 5 = amazing",
        True,
        {"max_rating": 5},
    )
    q4 = q(
        "demo01",
        3,
        "multiple_choice",
        "What did you like most?",
        "Pick one",
        False,
        {
            "options": [
                {"id": "o1", "label": "Ease of use"},
                {"id": "o2", "label": "Design"},
                {"id": "o3", "label": "Speed"},
                {"id": "o4", "label": "Support"},
            ]
        },
    )
    q5 = q(
        "demo01",
        4,
        "long_text",
        "Anything we could do better?",
        "Be honest — we can take it",
        False,
    )
    q6 = q("demo01", 5, "yes_no", "Would you recommend us to a friend?", "", True)
    q7 = q(
        "demo01", 6, "number", "How many times have you used our product?", "", False
    )

    # Form 2
    r1 = q("demo02", 0, "short_text", "Full name", "", True)
    r2 = q("demo02", 1, "email", "Email", "", True)
    r3 = q(
        "demo02",
        2,
        "dropdown",
        "Years of experience",
        "",
        True,
        {
            "options": [
                {"id": "d1", "label": "0–1 years"},
                {"id": "d2", "label": "1–3 years"},
                {"id": "d3", "label": "3–5 years"},
                {"id": "d4", "label": "5+ years"},
            ]
        },
    )
    r4 = q("demo02", 3, "long_text", "Link to your portfolio + a short intro", "", True)
    r5 = q("demo02", 4, "yes_no", "Are you available full-time?", "", True)

    # Draft form minimal
    q("draft01", 0, "short_text", "What's the event name?", "", True)
    q("draft01", 1, "email", "Your email for the invite", "", True)

    db.commit()

    # Responses for demo01
    names = [
        "Ava Stone",
        "Liam Chen",
        "Maya Rao",
        "Noah Smith",
        "Zoe Park",
        "Eli Brown",
        "Ivy Kim",
    ]
    emails = [
        "ava@x.com",
        "liam@x.com",
        "maya@x.com",
        "noah@x.com",
        "zoe@x.com",
        "eli@x.com",
        "ivy@x.com",
    ]
    likes = ["Ease of use", "Design", "Speed", "Support"]
    for i in range(7):
        rr = Response(
            id=str(uuid.uuid4()),
            form_id="demo01",
            submitted_at=datetime.utcnow() - timedelta(days=7 - i),
        )
        db.add(rr)
        db.flush()
        vals = {
            q1.id: names[i],
            q2.id: emails[i],
            q3.id: str(random.randint(3, 5)),
            q4.id: random.choice(likes),
            q5.id: "Loved it! Maybe faster load times." if i % 2 == 0 else "",
            q6.id: "Yes" if i < 6 else "No",
            q7.id: str(random.randint(1, 20)),
        }
        for qid, v in vals.items():
            db.add(
                Answer(
                    id=str(uuid.uuid4()), response_id=rr.id, question_id=qid, value=v
                )
            )

    for i in range(3):
        rr = Response(
            id=str(uuid.uuid4()),
            form_id="demo02",
            submitted_at=datetime.utcnow() - timedelta(days=3 - i),
        )
        db.add(rr)
        db.flush()
        vals = {
            r1.id: names[i],
            r2.id: emails[i],
            r3.id: "1–3 years",
            r4.id: "https://portfolio.example.com — 4 yrs product design",
            r5.id: "Yes",
        }
        for qid, v in vals.items():
            db.add(
                Answer(
                    id=str(uuid.uuid4()), response_id=rr.id, question_id=qid, value=v
                )
            )

    db.commit()
    print(
        "Seeded:",
        db.query(Form).count(),
        "forms,",
        db.query(Question).count(),
        "questions,",
        db.query(Response).count(),
        "responses",
    )


def main() -> None:
    engine = create_engine(
        f"sqlite:///{DB_FILE}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    try:
        seed_db(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
