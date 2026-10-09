"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { FormSummary } from "@/lib/types";
import { ToastProvider, useToast } from "@/components/toast";

function thumbIndex(id: string, n: number): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 1000003;
  return h % n;
}

const THUMB_GRADIENTS = [
  "linear-gradient(135deg, #e8e4f7, #d3cbee)",
  "linear-gradient(135deg, #e3f0ec, #c4ddd2)",
  "linear-gradient(135deg, #fbe9e4, #f5cdc0)",
  "linear-gradient(135deg, #e4eefb, #c2d8f5)",
  "linear-gradient(135deg, #f6f0dc, #e8d9ae)",
  "linear-gradient(135deg, #f3e4ef, #e2bcd4)",
  "linear-gradient(135deg, #e9e9ee, #cfcfd8)",
  "linear-gradient(135deg, #e0f2f1, #b2d8d5)",
];

function timeAgo(iso: string | null): string {
  if (!iso) return "just now";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Dashboard() {
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<FormSummary | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FormSummary | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const load = async () => {
    try {
      setForms(await api.listForms());
    } catch {
      toast("Couldn't reach the API — is the backend running?", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const create = async () => {
    try {
      const f = await api.createForm("New form");
      toast("Form created");
      router.push(`/forms/${f.id}`);
    } catch {
      toast("Failed to create form", "error");
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteForm(id);
      setForms((p) => p.filter((f) => f.id !== id));
      setDeleteTarget(null);
      toast("Form deleted");
    } catch {
      toast("Failed to delete form", "error");
    }
  };

  const duplicate = async (id: string) => {
    const f = await api.duplicateForm(id);
    const summary: FormSummary = {
      id: f.id,
      title: f.title,
      description: f.description,
      status: f.status,
      response_count: 0,
      question_count: f.questions.length,
      created_at: f.created_at,
      updated_at: f.updated_at,
    };
    setForms((p) => [summary, ...p]);
    toast("Form duplicated");
  };

  const doRename = async () => {
    if (!renameTarget || !renameVal.trim()) return;
    try {
      const updated = await api.updateForm(renameTarget.id, { title: renameVal.trim() });
      setForms((p) => p.map((f) => (f.id === updated.id ? { ...f, title: updated.title } : f)));
      setRenameTarget(null);
      toast("Form renamed");
    } catch {
      toast("Failed to rename form", "error");
    }
  };

  return (
    <div>
      <div className="topbar">
        <div className="crumbs">
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.5 }}>▣ stepform</span>
          <span className="sep">›</span>
          <span className="here">Forms</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn btn-dark btn-sm" onClick={create}>
            <span style={{ fontSize: 16, lineHeight: 0.5 }}>+</span> New form
          </button>
          <span className="avatar">NB</span>
        </div>
      </div>

      <div className="dash-wrap">
        <div className="dash-head">
          <h1>My forms</h1>
          <span className="help">
            {forms.length} form{forms.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="form-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skel" style={{ height: 210 }} />
            ))}
          </div>
        ) : forms.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 44 }}>📝</div>
            <h2>No forms yet</h2>
            <p>Create your first conversational form.</p>
            <button className="btn btn-dark" onClick={create} style={{ marginTop: 8 }}>
              + New form
            </button>
          </div>
        ) : (
          <div className="form-grid">
            {forms.map((f) => (
              <div key={f.id} className="form-card" onClick={() => router.push(`/forms/${f.id}`)}>
                <div
                  className="form-thumb"
                  style={{
                    background: THUMB_GRADIENTS[thumbIndex(f.id, THUMB_GRADIENTS.length)],
                    fontSize: 40,
                    fontWeight: 800,
                    color: "rgba(26,26,26,0.55)",
                  }}
                >
                  {(f.title.trim()[0] ?? "F").toUpperCase()}
                </div>
                <div className="form-card-body">
                  <div className="form-card-title">{f.title}</div>
                  <div>
                    <span className={`pill ${f.status === "published" ? "pill-published" : "pill-draft"}`}>
                      <span className="dot" />
                      {f.status === "published" ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="form-card-meta">
                    <span>
                      {f.response_count} response{f.response_count === 1 ? "" : "s"}
                    </span>
                    <span>·</span>
                    <span>{f.question_count} questions</span>
                    <span>·</span>
                    <span>{timeAgo(f.updated_at)}</span>
                    <span
                      className="card-menu-btn icon-btn"
                      style={{ position: "relative" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenu(menu === f.id ? null : f.id);
                      }}
                    >
                      ⋯
                      {menu === f.id && (
                        <div className="pop" style={{ right: 0, top: 34 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="pop-item"
                            onClick={() => {
                              setRenameTarget(f);
                              setRenameVal(f.title);
                              setMenu(null);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            className="pop-item"
                            onClick={() => {
                              setMenu(null);
                              duplicate(f.id);
                            }}
                          >
                            Duplicate
                          </button>
                          <button
                            className="pop-item"
                            style={{ color: "var(--red)" }}
                            onClick={() => {
                              setMenu(null);
                              setDeleteTarget(f);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete form?</h3>
            <p className="help">
              “{deleteTarget.title}” and all of its questions and responses will be permanently
              deleted.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                className="btn btn-dark"
                style={{ background: "var(--red)" }}
                onClick={() => remove(deleteTarget.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {renameTarget && (
        <div className="overlay" onClick={() => setRenameTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Rename form</h3>
            <p className="help">Give your form a clear, memorable name.</p>
            <input
              className="input"
              autoFocus
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doRename()}
              style={{ margin: "12px 0 16px" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setRenameTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-dark" onClick={doRename}>
                Save
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
      <Dashboard />
    </ToastProvider>
  );
}
