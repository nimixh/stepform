"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { FormDetail, Question, QuestionType } from "@/lib/types";
import { QUESTION_TYPES } from "@/lib/types";
import { ToastProvider, useToast } from "@/components/toast";
import { ThemeToggle } from "@/components/theme";
import { uid } from "@/components/builder/hooks";
import LeftPanel from "@/components/builder/LeftPanel";
import CanvasEditor from "@/components/builder/CanvasEditor";
import RightPanel from "@/components/builder/RightPanel";
import ShareView from "@/components/builder/ShareView";
import ResultsView from "@/components/builder/ResultsView";
import { IconGear, IconLink, IconMobile, IconPalette, IconPlay } from "@/components/builder/icons";

type Tab = "content" | "workflow" | "connect" | "share" | "results";

const FONTS = ["Inter", "Georgia", "Courier New", "Trebuchet MS", "Verdana"];

function Builder() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const notify = (m: string, k: "ok" | "error" = "ok") => toast(m, k);

  const [form, setForm] = useState<FormDetail | null>(null);
  const [tab, setTab] = useState<Tab>("content");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showWelcomeEdit, setShowWelcomeEdit] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileView, setMobileView] = useState(false);
  const [deleteQid, setDeleteQid] = useState<string | null>(null);
  // Separate debounce timers: a shared timer let a form edit and a question
  // edit cancel each other, silently dropping the first save.
  const formTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingForm = useRef<Record<string, unknown> | null>(null);
  const pendingQuestions = useRef(new Map<string, Partial<Question>>());

  // Flush any debounced saves when leaving the page.
  useEffect(() => {
    const timers = qTimers.current;
    const pendQ = pendingQuestions.current;
    const pendF = pendingForm;
    const ftRef = formTimer;
    return () => {
      if (ftRef.current) clearTimeout(ftRef.current);
      timers.forEach((t) => clearTimeout(t));
      if (pendF.current) void api.updateForm(id, pendF.current).catch(() => {});
      pendQ.forEach((patch, qid) => {
        void api.updateQuestion(qid, patch).catch(() => {});
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const f = await api.getForm(id);
        setForm(f);
        if (f.questions.length > 0) setSelectedId(f.questions[0].id);
      } catch {
        toast("Form not found", "error");
        router.push("/");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const persistForm = (patch: Record<string, unknown>) => {
    if (!form) return;
    setForm({ ...form, ...patch });
    pendingForm.current = { ...(pendingForm.current ?? {}), ...patch };
    if (formTimer.current) clearTimeout(formTimer.current);
    formTimer.current = setTimeout(async () => {
      const toSave = pendingForm.current ?? patch;
      pendingForm.current = null;
      try {
        const updated = await api.updateForm(id, toSave);
        setForm((prev) => (prev ? { ...prev, ...updated, questions: prev.questions } : prev));
      } catch {
        toast("Autosave failed", "error");
      }
    }, 600);
  };

  const persistQuestion = (qid: string, patch: Partial<Question>) => {
    if (!form) return;
    setForm({
      ...form,
      questions: form.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)),
    });
    pendingQuestions.current.set(qid, { ...(pendingQuestions.current.get(qid) ?? {}), ...patch });
    const prev = qTimers.current.get(qid);
    if (prev) clearTimeout(prev);
    qTimers.current.set(
      qid,
      setTimeout(async () => {
        const toSave = pendingQuestions.current.get(qid) ?? patch;
        pendingQuestions.current.delete(qid);
        try {
          await api.updateQuestion(qid, toSave);
        } catch {
          toast("Autosave failed", "error");
        }
      }, 600)
    );
  };

  const addQuestion = async (type: QuestionType) => {
    if (!form) return;
    setAddOpen(false);
    const label = QUESTION_TYPES.find((t) => t.value === type)?.label ?? type;
    try {
      const q = await api.addQuestion(form.id, {
        type,
        title: type === "yes_no" ? "Do you agree?" : type === "rating" ? "How would you rate this?" : "...",
        settings:
          type === "multiple_choice" || type === "dropdown"
            ? { options: [{ id: uid(), label: "Option 1" }, { id: uid(), label: "Option 2" }] }
            : type === "rating"
              ? { max_rating: 5 }
              : {},
      });
      setForm({ ...form, questions: [...form.questions, q] });
      setSelectedId(q.id);
      setShowWelcomeEdit(false);
      toast(`${label} question added`);
    } catch {
      toast("Failed to add question", "error");
    }
  };

  const deleteQuestion = async (qid: string) => {
    if (!form) return;
    // Cancel any pending autosave for the question being removed.
    const t = qTimers.current.get(qid);
    if (t) clearTimeout(t);
    qTimers.current.delete(qid);
    pendingQuestions.current.delete(qid);
    try {
      await api.deleteQuestion(qid);
    } catch {
      toast("Failed to delete question", "error");
      return;
    }
    const rest = form.questions.filter((q) => q.id !== qid);
    setForm({ ...form, questions: rest });
    setSelectedId(rest[0]?.id ?? null);
    setDeleteQid(null);
    toast("Question deleted");
  };

  const duplicateQuestion = async (qid: string) => {
    if (!form) return;
    const sorted = [...form.questions].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((q) => q.id === qid);
    const src = sorted[idx];
    if (!src) return;
    const q = await api.addQuestion(form.id, {
      type: src.type,
      title: src.title + " (copy)",
      description: src.description,
      required: src.required,
      settings: src.settings,
    });
    // Insert right after the source instead of appending at the end.
    const next = [...sorted];
    next.splice(idx + 1, 0, q);
    const renumbered = next.map((qq, i) => ({ ...qq, position: i }));
    const order = renumbered.map((qq) => qq.id);
    setForm({ ...form, questions: renumbered });
    setSelectedId(q.id);
    try {
      await api.reorder(form.id, order);
    } catch {
      toast("Reorder failed", "error");
    }
    toast("Question duplicated");
  };

  const reorder = async (order: string[]) => {
    if (!form) return;
    const map = new Map(form.questions.map((q) => [q.id, q]));
    const next = order.map((oid, i) => ({ ...map.get(oid)!, position: i }));
    setForm({ ...form, questions: next });
    try {
      await api.reorder(form.id, order);
    } catch {
      toast("Reorder failed", "error");
    }
  };

  /** Keyboard-accessible reorder fallback (mirrors drag-and-drop). */
  const nudge = async (qid: string, dir: -1 | 1) => {
    if (!form) return;
    const sorted = [...form.questions].sort((a, b) => a.position - b.position);
    const i = sorted.findIndex((q) => q.id === qid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    const order = sorted.map((q) => q.id);
    [order[i], order[j]] = [order[j], order[i]];
    await reorder(order);
  };

  if (!form) {
    return (
      <div className="builder">
        <div className="topbar">
          <div className="crumbs">
            <span style={{ fontWeight: 800 }}>▣ stepform</span>
          </div>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="skel" style={{ height: 48 }} />
          <div className="skel" style={{ height: 300 }} />
        </div>
      </div>
    );
  }

  const sorted = [...form.questions].sort((a, b) => a.position - b.position);
  const selected = sorted.find((q) => q.id === selectedId) ?? null;
  const selectedIndex = selected ? sorted.indexOf(selected) : 0;
  const published = form.status === "published";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="builder">
      {/* top bar */}
      <div className="topbar">
        <div className="crumbs">
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 800 }}>▣</span> Forms
          </a>
          <span className="sep">›</span>
          <input
            value={form.title}
            onChange={(e) => persistForm({ title: e.target.value })}
            style={{ border: "none", outline: "none", background: "transparent", fontWeight: 600, fontSize: 14, width: 200, maxWidth: "32vw" }}
          />
        </div>

        <div className="tabs">
          {(["content", "workflow", "connect", "share", "results"] as Tab[]).map((t) => (
            <button key={t} className={`tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ThemeToggle />
          <button
            className="icon-btn bordered"
            title="Copy respondent link"
            onClick={() => {
              navigator.clipboard?.writeText(`${origin}/s/${form.id}`).catch(() => {});
              toast("Respondent link copied");
            }}
          >
            <IconLink />
          </button>
          <button
            className={published ? "btn btn-light btn-sm" : "btn btn-dark btn-sm"}
            onClick={async () => {
              const updated = published ? await api.unpublish(form.id) : await api.publish(form.id);
              setForm({ ...form, status: updated.status });
              toast(published ? "Moved back to draft" : "Form published — link is live");
              if (!published) setTab("share");
            }}
          >
            {published ? "Unpublish" : "Publish"}
          </button>
          <span className="avatar">NB</span>
        </div>
      </div>

      {(tab === "workflow" || tab === "connect") && (
        <div className="empty">
          <div style={{ fontSize: 44 }}>{tab === "workflow" ? "🔀" : "🔌"}</div>
          <h2>{tab === "workflow" ? "Workflow" : "Connect"} — coming soon</h2>
          <p>Logic jumps, branching, webhooks and integrations live here in the full product.</p>
          <button className="btn btn-light" onClick={() => setTab("content")}>
            Back to Content
          </button>
        </div>
      )}

      {tab === "share" && (
        <div style={{ overflowY: "auto", flex: 1 }}>
          <ShareView
            form={form}
            notify={notify}
            onPublish={async () => {
              const u = await api.publish(form.id);
              setForm({ ...form, status: u.status });
              toast("Form published");
            }}
            onUnpublish={async () => {
              const u = await api.unpublish(form.id);
              setForm({ ...form, status: u.status });
              toast("Moved back to draft");
            }}
          />
        </div>
      )}

      {tab === "results" && (
        <div style={{ overflowY: "auto", flex: 1 }}>
          <ResultsView form={form} notify={notify} />
        </div>
      )}

      {tab === "content" && (
        <>
          <div className="builder-toolbar">
            <div style={{ position: "relative" }}>
              <button className="btn btn-dark btn-sm" onClick={() => setAddOpen((o) => !o)}>
                <span style={{ fontSize: 15 }}>+</span> Add content
              </button>
              {addOpen && (
                <div className="pop" style={{ top: 40, left: 0, width: 300 }}>
                  {QUESTION_TYPES.map((t) => (
                    <button key={t.value} className="pop-item" onClick={() => addQuestion(t.value)}>
                      <span className="key-badge">{t.icon}</span>
                      <span>
                        {t.label}
                        <span className="sub">{t.hint}</span>
                      </span>
                    </button>
                  ))}
                  <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4 }}>
                    <button className="pop-item" disabled style={{ opacity: 0.55, cursor: "default" }}>
                      <span className="key-badge">⇪</span>
                      <span>
                        File upload
                        <span className="sub">Coming soon</span>
                      </span>
                    </button>
                    <button className="pop-item" disabled style={{ opacity: 0.55, cursor: "default" }}>
                      <span className="key-badge">$</span>
                      <span>
                        Payment
                        <span className="sub">Coming soon</span>
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setDesignOpen((o) => !o)}>
                <IconPalette /> Design
              </button>
              {designOpen && (
                <div className="pop" style={{ top: 40, left: 0, width: 280, padding: 14 }}>
                  <span className="label">Background</span>
                  <input type="color" value={form.theme_bg} onChange={(e) => persistForm({ theme_bg: e.target.value })} style={{ width: "100%", height: 36, marginBottom: 10 }} />
                  <span className="label">Text</span>
                  <input type="color" value={form.theme_text} onChange={(e) => persistForm({ theme_text: e.target.value })} style={{ width: "100%", height: 36, marginBottom: 10 }} />
                  <span className="label">Button</span>
                  <input type="color" value={form.theme_button} onChange={(e) => persistForm({ theme_button: e.target.value })} style={{ width: "100%", height: 36, marginBottom: 10 }} />
                  <span className="label">Font</span>
                  <select className="select" value={form.theme_font} onChange={(e) => persistForm({ theme_font: e.target.value })}>
                    {FONTS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <button className="icon-btn" title="Toggle mobile preview" onClick={() => setMobileView((m) => !m)} style={mobileView ? { background: "color-mix(in srgb, var(--ink) 12%, transparent)" } : undefined}>
              <IconMobile />
            </button>
            <a
              className="icon-btn"
              title="Preview as respondent"
              href={published ? `/s/${form.id}` : `/s/${form.id}?draft=1`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none" }}
            >
              <IconPlay />
            </a>
            <button className="icon-btn" title="Form settings (welcome + thank-you screens)" onClick={() => setSettingsOpen(true)}>
              <IconGear />
            </button>
            <span className="help" style={{ marginLeft: "auto" }}>
              {published ? "● Published" : "○ Draft"} · {form.response_count} responses · autosaves
            </span>
          </div>

          <div className="builder-main">
            <LeftPanel
              form={form}
              selectedId={showWelcomeEdit ? null : selectedId}
              onSelect={(qid) => {
                setSelectedId(qid);
                setShowWelcomeEdit(false);
              }}
              onAdd={() => setAddOpen(true)}
              onReorder={reorder}
              onNudge={nudge}
              onDuplicate={(qid) => duplicateQuestion(qid)}
              onDelete={(qid) => setDeleteQid(qid)}
              onToggleWelcome={(on) => {
                persistForm({ welcome_enabled: on });
                setShowWelcomeEdit(on);
                toast(on ? "Welcome screen added" : "Welcome screen removed");
              }}
            />

            <div className="canvas">
              {showWelcomeEdit ? (
                <div className="q-edit">
                  <span className="q-badge">👋</span>
                  <input
                    className="q-title-input"
                    value={form.welcome_title}
                    placeholder="Welcome title…"
                    onChange={(e) => persistForm({ welcome_title: e.target.value })}
                  />
                  <input
                    className="q-desc-input"
                    value={form.welcome_description}
                    placeholder="Welcome description (optional)"
                    onChange={(e) => persistForm({ welcome_description: e.target.value })}
                  />
                  <div>
                    <span className="label">Button text</span>
                    <input
                      className="input"
                      style={{ maxWidth: 260 }}
                      value={form.welcome_button}
                      onChange={(e) => persistForm({ welcome_button: e.target.value })}
                    />
                  </div>
                </div>
              ) : selected ? (
                <div style={{ width: "100%", display: "flex", justifyContent: "center", maxWidth: mobileView ? 430 : undefined, margin: mobileView ? "0 auto" : undefined }}>
                  <CanvasEditor
                    q={selected}
                    index={selectedIndex}
                    onPatch={(p) => persistQuestion(selected.id, p)}
                  />
                </div>
              ) : (
                <div className="empty">
                  <div style={{ fontSize: 44 }}>✏️</div>
                  <h2>Add your first question</h2>
                  <p>Click “Add content” to start building.</p>
                  <button className="btn btn-dark" onClick={() => setAddOpen(true)}>
                    + Add content
                  </button>
                </div>
              )}
            </div>

            {selected && !showWelcomeEdit && (
              <RightPanel q={selected} onPatch={(p) => persistQuestion(selected.id, p)} notify={(m) => notify(m)} />
            )}
          </div>
        </>
      )}

      {deleteQid && (
        <div className="overlay" onClick={() => setDeleteQid(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete question?</h3>
            <p className="help">This question will be permanently removed from the form.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setDeleteQid(null)}>
                Cancel
              </button>
              <button
                className="btn btn-dark"
                style={{ background: "var(--red)" }}
                onClick={() => deleteQuestion(deleteQid)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3>Form settings</h3>
            <p className="help">Welcome screen, thank-you screen and basics.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14, maxHeight: "60vh", overflowY: "auto" }}>
              <div>
                <span className="label">Form title</span>
                <input className="input" value={form.title} onChange={(e) => persistForm({ title: e.target.value })} />
              </div>
              <div>
                <span className="label">Description</span>
                <textarea className="textarea" value={form.description} onChange={(e) => persistForm({ description: e.target.value })} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <strong>Welcome screen</strong>
                <label className="switch">
                  <input type="checkbox" checked={form.welcome_enabled} onChange={(e) => persistForm({ welcome_enabled: e.target.checked })} />
                  <span className="track" />
                </label>
              </div>
              <div>
                <span className="label">Thank-you title</span>
                <input className="input" value={form.thankyou_title} onChange={(e) => persistForm({ thankyou_title: e.target.value })} />
              </div>
              <div>
                <span className="label">Thank-you description</span>
                <textarea className="textarea" value={form.thankyou_description} onChange={(e) => persistForm({ thankyou_description: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-dark" onClick={() => setSettingsOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <Builder />
    </ToastProvider>
  );
}
