"use client";
import type { Question } from "@/lib/types";
import { QUESTION_TYPES } from "@/lib/types";
import { letter, uid } from "./hooks";

interface Props {
  q: Question;
  onPatch: (patch: Partial<Question>) => void;
  notify: (m: string) => void;
}

export default function RightPanel({ q, onPatch, notify }: Props) {
  const opts = q.settings.options ?? [];
  const needsOptions = q.type === "multiple_choice" || q.type === "dropdown";

  const setOptions = (next: { id: string; label: string }[]) =>
    onPatch({ settings: { ...q.settings, options: next } });

  return (
    <div className="side side-right">
      <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}>
        Question <span className="help" title="Edit the question text in the canvas">ⓘ</span>
      </h4>

      <div className="seg">
        <button className="active">Text</button>
        <button title="Video questions are not supported in this clone" onClick={() => notify("Video questions are coming soon")}>
          Video
        </button>
      </div>

      <h4 style={{ marginTop: 10 }}>Answer</h4>
      <select
        className="select"
        value={q.type}
        onChange={(e) => {
          const t = e.target.value as Question["type"];
          const settings = { ...q.settings };
          if ((t === "multiple_choice" || t === "dropdown") && !settings.options) {
            settings.options = [
              { id: uid(), label: "Option 1" },
              { id: uid(), label: "Option 2" },
            ];
          }
          if (t === "rating" && !settings.max_rating) settings.max_rating = 5;
          onPatch({ type: t, settings });
        }}
      >
        {QUESTION_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      {needsOptions && (
        <div style={{ marginTop: 12 }}>
          <span className="label">Options</span>
          {opts.map((o, i) => (
            <div key={o.id} className="opt-row">
              <span className="key-badge">{letter(i)}</span>
              <input
                className="input"
                value={o.label}
                placeholder={`Option ${i + 1}`}
                onChange={(e) =>
                  setOptions(opts.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)))
                }
              />
              <button
                className="icon-btn"
                title="Remove option"
                onClick={() => setOptions(opts.filter((x) => x.id !== o.id))}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="btn btn-light btn-sm"
            style={{ width: "100%" }}
            onClick={() => setOptions([...opts, { id: uid(), label: `Option ${opts.length + 1}` }])}
          >
            + Add option
          </button>
        </div>
      )}

      {q.type === "rating" && (
        <div style={{ marginTop: 12 }}>
          <span className="label">Number of steps: {Number(q.settings.max_rating ?? 5)}</span>
          <input
            type="range"
            min={3}
            max={10}
            value={Number(q.settings.max_rating ?? 5)}
            onChange={(e) => onPatch({ settings: { ...q.settings, max_rating: Number(e.target.value) } })}
            style={{ width: "100%" }}
          />
        </div>
      )}

      <div className="set-row" style={{ marginTop: 8 }}>
        <span>
          Map to contacts{" "}
          <span className="help" title="Coming soon" style={{ display: "inline" }}>
            ⓘ
          </span>
        </span>
        <label className="switch" title="Coming soon">
          <input type="checkbox" disabled />
          <span className="track" />
        </label>
      </div>

      <div className="set-row">
        <span>Required</span>
        <label className="switch">
          <input type="checkbox" checked={q.required} onChange={(e) => onPatch({ required: e.target.checked })} />
          <span className="track" />
        </label>
      </div>

      <div className="set-row">
        <span>Image or video</span>
        <button className="icon-btn bordered" title="Coming soon" onClick={() => notify("Image / video uploads are coming soon")}>
          +
        </button>
      </div>

      <div className="set-row">
        <span>Logic</span>
        <button className="icon-btn bordered" title="Conditional branching is coming soon" onClick={() => notify("Logic jumps are coming soon")}>
          +
        </button>
      </div>

      <div className="set-row">
        <span>Comments ◇</span>
        <span className="help">Coming soon</span>
      </div>
    </div>
  );
}
