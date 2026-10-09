"use client";
import type { QuestionType } from "@/lib/types";
import { QUESTION_TYPES } from "@/lib/types";

export function QIcon({ type }: { type: QuestionType }) {
  const icon = QUESTION_TYPES.find((t) => t.value === type)?.icon ?? "?";
  return <span className="qicon">{icon}</span>;
}

/** Small pink badge with icon + number, like Typeform's page list. */
export function PageBadge({ index, type }: { index: number; type: QuestionType }) {
  return (
    <span className="page-num">
      <QIcon type={type} />
      {index + 1}
    </span>
  );
}
