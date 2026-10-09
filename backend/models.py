"""SQLAlchemy models for Stepform."""

from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    Integer,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def short_id() -> str:
    return uuid.uuid4().hex[:8]


class Form(Base):
    __tablename__ = "forms"

    id = Column(String(16), primary_key=True, default=short_id)
    title = Column(String(255), nullable=False, default="New form")
    description = Column(Text, default="")
    status = Column(String(16), default="draft")  # draft | published
    # theme
    theme_bg = Column(String(32), default="#FAFAFA")
    theme_text = Column(String(32), default="#1A1A1A")
    theme_button = Column(String(32), default="#1A1A1A")
    theme_font = Column(String(64), default="Inter")
    # welcome screen
    welcome_enabled = Column(Boolean, default=False)
    welcome_title = Column(String(500), default="")
    welcome_description = Column(Text, default="")
    welcome_button = Column(String(100), default="Start")
    # thank-you / ending screen
    thankyou_title = Column(String(500), default="Thanks for completing this form 🙏")
    thankyou_description = Column(
        Text, default="Now it's time to create your own form."
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    questions = relationship(
        "Question",
        back_populates="form",
        cascade="all, delete-orphan",
        order_by="Question.position",
    )
    responses = relationship(
        "Response", back_populates="form", cascade="all, delete-orphan"
    )


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    form_id = Column(
        String(16),
        ForeignKey("forms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type = Column(String(32), nullable=False, default="short_text")
    # short_text | long_text | multiple_choice | dropdown | email | number | yes_no | rating
    title = Column(String(1000), nullable=False, default="...")
    description = Column(Text, default="")
    required = Column(Boolean, default=False)
    position = Column(Integer, default=0)
    # flexible settings: {options: [{id,label}], max_rating, etc.}
    settings = Column(JSON, default=dict)

    form = relationship("Form", back_populates="questions")
    answers = relationship(
        "Answer", back_populates="question", cascade="all, delete-orphan"
    )


class Response(Base):
    __tablename__ = "responses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    form_id = Column(
        String(16),
        ForeignKey("forms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    submitted_at = Column(DateTime, default=datetime.utcnow)

    form = relationship("Form", back_populates="responses")
    answers = relationship(
        "Answer", back_populates="response", cascade="all, delete-orphan"
    )


class Answer(Base):
    __tablename__ = "answers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    response_id = Column(
        String(36),
        ForeignKey("responses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id = Column(
        String(36),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # store everything as text; numbers/ratings parsed on read
    value = Column(Text, default="")

    response = relationship("Response", back_populates="answers")
    question = relationship("Question", back_populates="answers")
