"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { FormDetail } from "@/lib/types";
import { ToastProvider, useToast } from "@/components/toast";
import { letter } from "@/components/builder/hooks";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientError(q: FormDetail["questions"][number], raw: string): string | null {
  const v = raw.trim();
  if (q.required && !v) return "Please fill this in";
  if (!v) return null;
  if (q.type === "email" && !EMAIL_RE.test(v)) return "Please enter a valid email address";
  // Same plain-decimal rule as the server (float()): no hex like "0x10".
  if (q.type === "number" && !/^-?\d+(\.\d+)?$/.test(v)) return "Please enter a valid number";
  if (q.type === "rating") {
    const n = Number(v);
    const mx = Number(q.settings.max_rating ?? 5);
    if (!Number.isInteger(n) || n < 1 || n > mx) return `Pick a rating between 1 and ${mx}`;
  }
  return null;
}

function Flow() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const isDraftPreview = search.get("draft") === "1";
  const { toast } = useToast();

  const [form, setForm] = useState<FormDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropIndex, setDropIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const f = isDraftPreview ? await api.getForm(id) : await api.publicGet(id);
        setForm(f);
        setStarted(!f.welcome_enabled);
      } catch {
        setFailed(true);
      }
    })();
  }, [id, isDraftPreview]);

  const questions = useMemo(
    () => (form ? [...form.questions].sort((a, b) => a.position - b.position) : []),
    [form]
  );
  const q = started && !done ? questions[step] : null;
  const totalSteps = questions.length;

  useEffect(() => {
    setErr(null);
    setDropdownOpen(false);
    setDropIndex(0);
    setAnimKey((k) => k + 1);
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [step, started]);

  const setVal = (qid: string, v: string) => {
    setAnswers((p) => ({ ...p, [qid]: v }));
    setErr(null);
  };

  // `justSet` carries a value set moments ago via setVal whose React state
  // may not have flushed yet — validate it directly instead of stale state.
  const go = useCallback(
    (dir: 1 | -1, justSet?: { qid: string; value: string }) => {
      if (!q) return;
      if (dir === 1) {
        const current = justSet && justSet.qid === q.id ? justSet.value : (answers[q.id] ?? "");
        const e = clientError(q, current);
        if (e) {
          setErr(e);
          return;
        }
        if (step < totalSteps - 1) {
          setStep(step + 1);
        } else {
          submit();
        }
      } else if (step > 0) {
        setStep(step - 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, answers, step, totalSteps]
  );

  const submit = async () => {
    if (!form || submitting) return;
    // full client check first
    for (let i = 0; i < questions.length; i++) {
      const e = clientError(questions[i], answers[questions[i].id] ?? "");
      if (e) {
        setStep(i);
        setErr(e);
        return;
      }
    }
    if (isDraftPreview) {
      setDone(true); // fake success in preview mode
      return;
    }
    setSubmitting(true);
    try {
      await api.publicSubmit(
        form.id,
        questions.map((qq) => ({ question_id: qq.id, value: answers[qq.id] ?? "" }))
      );
      setDone(true);
    } catch (e: unknown) {
      const detail = (e as { detail?: { detail?: { errors?: Record<string, string> } } })?.detail;
      const serverErrors =
        (detail as unknown as { errors?: Record<string, string> })?.errors ??
        (detail as unknown as { detail?: { errors?: Record<string, string> } })?.detail?.errors;
      if (serverErrors) {
        const firstIdx = questions.findIndex((qq) => serverErrors[qq.id]);
        if (firstIdx >= 0) {
          setStep(firstIdx);
          setErr(serverErrors[questions[firstIdx].id]);
        }
        toast("Please fix the highlighted answers", "error");
      } else {
        toast("Submission failed — try again", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!form || done) return;
      if (!started) {
        if (e.key === "Enter") setStarted(true);
        return;
      }
      if (!q) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "TEXTAREA";
      const commitDropdown = () => {
        const opt = q.settings.options?.[dropIndex];
        if (opt) {
          setVal(q.id, opt.label);
          setDropdownOpen(false);
          setTimeout(() => go(1, { qid: q.id, value: opt.label }), 220);
        }
      };
      if (q.type === "dropdown" && dropdownOpen) {
        const n = q.settings.options?.length ?? 0;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setDropIndex((i) => Math.min(n - 1, i + 1));
          return;
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setDropIndex((i) => Math.max(0, i - 1));
          return;
        } else if (e.key === "Enter" && !typing) {
          e.preventDefault();
          commitDropdown();
          return;
        } else if (e.key === "Escape") {
          setDropdownOpen(false);
          return;
        }
      }
      if (e.key === "Enter" && !typing && !dropdownOpen) {
        e.preventDefault();
        if (q.type === "dropdown") {
          // Open the list; preselect the current answer if any.
          const cur = (q.settings.options ?? []).findIndex((o) => o.label === (answers[q.id] ?? ""));
          setDropIndex(cur >= 0 ? cur : 0);
          setDropdownOpen(true);
        } else {
          go(1);
        }
      } else if (e.key === "ArrowDown" && !typing) {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowUp" && !typing) {
        e.preventDefault();
        go(-1);
      } else if (/^[0-9]$/.test(e.key) && (q.type === "multiple_choice" || q.type === "rating")) {
        // "1".."9" pick options 1-9, "0" picks the 10th (rating scale can go to 10).
        const idx = e.key === "0" ? 9 : Number(e.key) - 1;
        if (q.type === "multiple_choice") {
          const opt = q.settings.options?.[idx];
          if (opt) {
            setVal(q.id, opt.label);
            setTimeout(() => go(1, { qid: q.id, value: opt.label }), 180);
          }
        } else if (idx < Number(q.settings.max_rating ?? 5)) {
          const v = String(idx + 1);
          setVal(q.id, v);
          setTimeout(() => go(1, { qid: q.id, value: v }), 180);
        }
      } else if ((q.type === "yes_no") && (e.key.toLowerCase() === "y" || e.key.toLowerCase() === "n")) {
        const v = e.key.toLowerCase() === "y" ? "Yes" : "No";
        setVal(q.id, v);
        setTimeout(() => go(1, { qid: q.id, value: v }), 180);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [form, done, started, q, answers, dropdownOpen, dropIndex, go]);

  if (failed) {
    return (
      <div className="fill" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>🔍</div>
          <h2>This form isn&apos;t available</h2>
          <p style={{ opacity: 0.6 }}>It may be unpublished or the link is wrong.</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="fill">
        <div className="progress">
          <div className="seg-fill"><div style={{ width: "30%" }} /></div>
        </div>
        <div className="fill-body">
          <div className="fill-inner">
            <div className="skel" style={{ height: 34, width: "60%" }} />
            <div className="skel" style={{ height: 52, marginTop: 24 }} />
          </div>
        </div>
      </div>
    );
  }

  const theme = {
    "--fill-bg": form.theme_bg,
    "--fill-text": form.theme_text,
    "--fill-btn": form.theme_button,
    fontFamily: `${form.theme_font}, Inter, sans-serif`,
  } as React.CSSProperties;

  if (questions.length === 0) {
    return (
      <div className="fill" style={theme}>
        <div className="fill-body">
          <div className="fill-inner"><h2>This form has no questions yet.</h2></div>
        </div>
      </div>
    );
  }


  return (
    <div className="fill" style={theme}>
      {isDraftPreview && !done && (
        <div style={{ background: "var(--fill-text, #1a1a1a)", color: "var(--fill-bg, #fafafa)", textAlign: "center", fontSize: 12.5, padding: "7px", fontWeight: 600 }}>
          Draft preview — responses won&apos;t be saved · <a href={`/forms/${form.id}`} style={{ textDecoration: "underline" }}>Back to builder</a>
        </div>
      )}
      <div className="progress" aria-label="Form progress">
        {questions.map((qq) => {
          const filled = done || (answers[qq.id] ?? "").trim() !== "";
          return (
            <div key={qq.id} className="seg-fill">
              <div style={{ width: filled ? "100%" : "0%" }} />
            </div>
          );
        })}
      </div>

      <div className="fill-body">
        <div className="fill-inner" key={animKey}>
          {!started ? (
            <div className="welcome fill-anim">
              <h1>{form.welcome_title || form.title}</h1>
              {(form.welcome_description || form.description) && <p>{form.welcome_description || form.description}</p>}
              <button className="fill-ok" onClick={() => setStarted(true)} autoFocus>
                {form.welcome_button || "Start"} →
              </button>
              <div className="hint">press <kbd>Enter</kbd> ↵</div>
            </div>
          ) : done ? (
            <div className="thanks fill-anim">
              <div className="tick">✓</div>
              <h1>{form.thankyou_title || "Thanks for completing this form"}</h1>
              {form.thankyou_description && <p>{form.thankyou_description}</p>}
              {!isDraftPreview && (
                <button className="fill-ok" onClick={() => { setDone(false); setStep(0); setAnswers({}); setStarted(!form.welcome_enabled); }}>
                  Fill again
                </button>
              )}
            </div>
          ) : q ? (
            <div className="fill-anim">
              <div className="fill-q">
                <span className="fill-num">{step + 1}</span>
                <h2 className="fill-title">
                  {q.title === "..." ? "Untitled question" : q.title}
                  {q.required && <span className="req-star"> *</span>}
                </h2>
              </div>
              {q.description && <div className="fill-desc">{q.description}</div>}

              {(q.type === "short_text" || q.type === "email" || q.type === "number") && (
                <>
                  <input
                    ref={inputRef}
                    className="fill-input"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setVal(q.id, e.target.value)}
                    placeholder={q.type === "email" ? "name@example.com" : "Type your answer here…"}
                    // type="text" on purpose: type="number" makes the browser
                    // swallow letters, so our "valid number" error could never show.
                    type={q.type === "email" ? "email" : "text"}
                    inputMode={q.type === "number" ? "numeric" : q.type === "email" ? "email" : "text"}
                  />
                  <div>
                    <button className="fill-ok" onClick={() => go(1)} disabled={submitting}>
                      {step === totalSteps - 1 ? (submitting ? "Submitting…" : "Submit") : "OK"}
                    </button>
                  </div>
                </>
              )}

              {q.type === "long_text" && (
                <>
                  <textarea
                    className="fill-area"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setVal(q.id, e.target.value)}
                    placeholder="Type your answer here…"
                  />
                  <div>
                    <button className="fill-ok" onClick={() => go(1)} disabled={submitting}>
                      {step === totalSteps - 1 ? (submitting ? "Submitting…" : "Submit") : "OK"}
                    </button>
                  </div>
                </>
              )}

              {q.type === "multiple_choice" && (
                <div style={{ marginTop: 8 }}>
                  {(q.settings.options ?? []).map((o, i) => (
                    <button
                      key={o.id}
                      className={`choice${answers[q.id] === o.label ? " selected" : ""}`}
                      onClick={() => {
                        setVal(q.id, o.label);
                        setTimeout(() => go(1, { qid: q.id, value: o.label }), 220);
                      }}
                    >
                      <span className="key">{letter(i)}</span>
                      {o.label}
                      {answers[q.id] === o.label && <span className="check">✓</span>}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "dropdown" && (
                <div style={{ position: "relative", marginTop: 8 }}>
                  <button
                    className="choice"
                    onClick={() => setDropdownOpen((o) => !o)}
                    style={{ justifyContent: "space-between" }}
                  >
                    <span style={{ opacity: answers[q.id] ? 1 : 0.5 }}>
                      {answers[q.id] || "Choose…"}
                    </span>
                    <span>▾</span>
                  </button>
                  {dropdownOpen && (
                    <div className="pop" role="listbox" style={{ position: "absolute", top: 60, left: 0, right: 0 }}>
                      {(q.settings.options ?? []).map((o, i) => (
                        <button
                          key={o.id}
                          role="option"
                          aria-selected={answers[q.id] === o.label}
                          className="pop-item"
                          style={i === dropIndex ? { background: "color-mix(in srgb, var(--fill-text, #1a1a1a) 10%, transparent)", outline: "2px solid var(--fill-text, #1a1a1a)", outlineOffset: -2 } : undefined}
                          onMouseEnter={() => setDropIndex(i)}
                          onClick={() => {
                            setVal(q.id, o.label);
                            setDropdownOpen(false);
                            setTimeout(() => go(1, { qid: q.id, value: o.label }), 220);
                          }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {q.type === "yes_no" && (
                <div className="yn-row" style={{ marginTop: 8 }}>
                  {(["Yes", "No"] as const).map((v, i) => (
                    <button
                      key={v}
                      className={`choice${answers[q.id] === v ? " selected" : ""}`}
                      onClick={() => {
                        setVal(q.id, v);
                        setTimeout(() => go(1, { qid: q.id, value: v }), 220);
                      }}
                    >
                      <span className="key">{["Y", "N"][i]}</span>
                      {v}
                      {answers[q.id] === v && <span className="check">✓</span>}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "rating" && (
                <div className="stars">
                  {Array.from({ length: Number(q.settings.max_rating ?? 5) }, (_, i) => (
                    <button
                      key={i}
                      className={`star${answers[q.id] === String(i + 1) ? " selected" : ""}`}
                      onClick={() => {
                        const v = String(i + 1);
                        setVal(q.id, v);
                        setTimeout(() => go(1, { qid: q.id, value: v }), 220);
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}

              {err && (
                <div><span className="fill-err" key={err}>⚠ {err}</span></div>
              )}
              {(q.type === "multiple_choice" || q.type === "dropdown" || q.type === "yes_no" || q.type === "rating") && step === totalSteps - 1 && (
                <div>
                  <button className="fill-ok" onClick={() => go(1)} disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              )}
              <div className="hint">press <kbd>Enter</kbd> ↵ · <kbd>↑</kbd><kbd>↓</kbd> to navigate</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="fill-foot">
        <button className="nav-btn" disabled={!started || done || step === 0} onClick={() => go(-1)} title="Previous question">
          ↑
        </button>
        <button className="nav-btn" disabled={!started || done} onClick={() => go(1)} title="Next question">
          ↓
        </button>
        <span className="powered">Powered by <span className="mark" /> Stepform</span>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <Flow />
    </ToastProvider>
  );
}
