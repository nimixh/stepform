"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { FormDetail, Question } from "@/lib/types";
import { IconDownload } from "./icons";

interface RespRow {
  id: string;
  submitted_at: string;
  answers: { question_id: string; value: string }[];
}

interface Props {
  form: FormDetail;
  notify: (m: string, k?: "ok" | "error") => void;
}

export default function ResultsView({ form, notify }: Props) {
  const [questions, setQuestions] = useState<Question[]>(form.questions);
  const [rows, setRows] = useState<RespRow[]>([]);
  const [stats, setStats] = useState<
    { question_id: string; type: string; answered: number; total: number; counts?: Record<string, number>; average?: number | null; samples?: string[] }[]
  >([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{ id: string; submitted_at: string; answers: { question: Question; value: string }[] } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [r, s] = await Promise.all([api.listResponses(form.id), api.stats(form.id)]);
        setQuestions(r.questions);
        setRows(r.responses);
        setStats(s.stats);
        setTotal(s.total_responses);
      } catch {
        notify("Failed to load responses", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [form.id]);

  const openDetail = async (id: string) => {
    try {
      setDetail(await api.getResponse(form.id, id));
    } catch {
      notify("Failed to load response", "error");
    }
  };

  if (loading) {
    return (
      <div className="results-wrap">
        <div className="skel" style={{ height: 120 }} />
        <div className="skel" style={{ height: 300, marginTop: 16 }} />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="empty">
        <div style={{ fontSize: 44 }}>📭</div>
        <h2>No responses yet</h2>
        <p>Share your form to start collecting answers.</p>
      </div>
    );
  }

  const valFor = (row: RespRow, qid: string) => row.answers.find((a) => a.question_id === qid)?.value ?? "";

  return (
    <div className="results-wrap">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Results</h2>
        <span className="pill pill-published">
          <span className="dot" />
          {total} response{total === 1 ? "" : "s"}
        </span>
        <span style={{ marginLeft: "auto" }} />
        <a className="btn btn-light btn-sm" href={api.exportUrl(form.id)} download>
          <IconDownload /> Export CSV
        </a>
      </div>

      <div className="stat-grid">
        {questions.map((q) => {
          const s = stats.find((x) => x.question_id === q.id);
          if (!s) return null;
          const pct = s.total ? Math.round((s.answered / s.total) * 100) : 0;
          const top = s.counts
            ? Object.entries(s.counts).sort((a, b) => b[1] - a[1]).slice(0, 4)
            : [];
          return (
            <div key={q.id} className="stat-card">
              <div className="help" style={{ marginBottom: 4 }}>
                {q.title.length > 48 ? q.title.slice(0, 48) + "…" : q.title}
              </div>
              {s.average != null ? (
                <div className="big">★ {s.average} <span className="help">avg</span></div>
              ) : top.length > 0 ? (
                <div className="big">{top[0][0] === "" ? "—" : top[0][0].slice(0, 18)}</div>
              ) : (
                <div className="big">{s.answered}<span className="help"> answered</span></div>
              )}
              {s.counts ? (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {top.map(([label, c]) => (
                    <div key={label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span>{label || "—"}</span>
                        <strong>{c}</strong>
                      </div>
                      <div className="bar">
                        <div style={{ width: `${(c / Math.max(1, s.answered)) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bar">
                  <div style={{ width: `${pct}%` }} />
                </div>
              )}
              <div className="help" style={{ marginTop: 6 }}>
                {s.answered}/{s.total} answered
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Submitted</th>
              {questions.map((q) => (
                <th key={q.id} title={q.title}>{q.title.length > 26 ? q.title.slice(0, 26) + "…" : q.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => openDetail(r.id)} title="Click to view full response">
                <td>{new Date(r.submitted_at).toLocaleString()}</td>
                {questions.map((q) => {
                  const v = valFor(r, q.id);
                  return (
                    <td key={q.id} title={v || "No answer"}>{v || <span style={{ color: "var(--faint)" }}>—</span>}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="help" style={{ marginTop: 8 }}>Scroll sideways for more columns · click a row for the full response</p>

      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3>Response</h3>
            <p className="help">{new Date(detail.submitted_at).toLocaleString()}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12, maxHeight: "50vh", overflowY: "auto" }}>
              {detail.answers.map(({ question, value }) => (
                <div key={question.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <div className="label">{question.title}</div>
                  <div>{value || <span style={{ color: "var(--faint)" }}>No answer</span>}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-dark btn-sm" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
