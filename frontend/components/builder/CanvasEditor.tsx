"use client";
import { useState } from "react";
import type { Question } from "@/lib/types";
import { letter } from "./hooks";

interface Props {
  q: Question;
  index: number;
  onPatch: (patch: Partial<Question>) => void;
}

/** Center canvas: editable title/description + live answer widget preview. */
export default function CanvasEditor({ q, index, onPatch }: Props) {
  const [previewChoice, setPreviewChoice] = useState<string | null>(null);
  const opts = q.settings.options ?? [];
  const maxRating = Number(q.settings.max_rating ?? 5);

  return (
    <div className="q-edit">
      <span className="q-badge">{index + 1}</span>
      <input
        className="q-title-input"
        value={q.title}
        placeholder="Your question here…"
        onChange={(e) => onPatch({ title: e.target.value })}
      />
      <input
        className="q-desc-input"
        value={q.description}
        placeholder="Description (optional)"
        onChange={(e) => onPatch({ description: e.target.value })}
      />

      {q.required && (
        <div className="help" style={{ marginBottom: 10 }}>
          <span style={{ color: "var(--red)" }}>*</span> Required
        </div>
      )}

      {(q.type === "short_text" || q.type === "email" || q.type === "number") && (
        <input
          className="pv-input"
          disabled
          placeholder={
            q.type === "email" ? "name@example.com" : q.type === "number" ? "123" : "Type your answer here…"
          }
        />
      )}

      {q.type === "long_text" && (
        <textarea className="pv-input" disabled placeholder="Type your answer here…" rows={2} style={{ fontSize: 22 }} />
      )}

      {(q.type === "multiple_choice" || q.type === "dropdown") && (
        <div style={{ marginTop: 6 }}>
          {opts.length === 0 && <div className="help">No options yet — add them in the right panel →</div>}
          {opts.map((o, i) => (
            <button
              key={o.id}
              className={`pv-choice${previewChoice === o.id ? " selected" : ""}`}
              style={{ pointerEvents: "auto" } as React.CSSProperties}
              onClick={() => setPreviewChoice(previewChoice === o.id ? null : o.id)}
            >
              <span className="key">{letter(i)}</span>
              {o.label || `Option ${i + 1}`}
              {previewChoice === o.id && <span className="check">✓</span>}
            </button>
          ))}
        </div>
      )}

      {q.type === "yes_no" && (
        <div className="yn-row">
          {(["Yes", "No"] as const).map((v) => (
            <button
              key={v}
              className={`pv-choice${previewChoice === v ? " selected" : ""}`}
              onClick={() => setPreviewChoice(previewChoice === v ? null : v)}
            >
              <span className="key">{v[0]}</span>
              {v}
              {previewChoice === v && <span className="check">✓</span>}
            </button>
          ))}
        </div>
      )}

      {q.type === "rating" && (
        <div className="pv-stars">
          {Array.from({ length: maxRating }, (_, i) => (
            <button
              key={i}
              className={`pv-star${previewChoice === String(i + 1) ? " selected" : ""}`}
              onClick={() => setPreviewChoice(String(i + 1))}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
