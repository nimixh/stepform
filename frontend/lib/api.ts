export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      /* ignore */
    }
    const err = new Error(`API ${res.status}: ${res.statusText}`) as Error & {
      status: number;
      detail: unknown;
    };
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listForms: () => req<import("./types").FormSummary[]>("/api/forms"),
  createForm: (title = "New form") =>
    req<import("./types").FormDetail>("/api/forms", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  getForm: (id: string) => req<import("./types").FormDetail>(`/api/forms/${id}`),
  updateForm: (id: string, patch: Record<string, unknown>) =>
    req<import("./types").FormDetail>(`/api/forms/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteForm: (id: string) =>
    req<{ ok: boolean }>(`/api/forms/${id}`, { method: "DELETE" }),
  duplicateForm: (id: string) =>
    req<import("./types").FormDetail>(`/api/forms/${id}/duplicate`, { method: "POST" }),
  publish: (id: string) =>
    req<import("./types").FormDetail>(`/api/forms/${id}/publish`, { method: "POST" }),
  unpublish: (id: string) =>
    req<import("./types").FormDetail>(`/api/forms/${id}/unpublish`, { method: "POST" }),

  addQuestion: (formId: string, q: Record<string, unknown>) =>
    req<import("./types").Question>(`/api/forms/${formId}/questions`, {
      method: "POST",
      body: JSON.stringify(q),
    }),
  updateQuestion: (qid: string, patch: Record<string, unknown>) =>
    req<import("./types").Question>(`/api/questions/${qid}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteQuestion: (qid: string) =>
    req<{ ok: boolean }>(`/api/questions/${qid}`, { method: "DELETE" }),
  reorder: (formId: string, order: string[]) =>
    req<import("./types").Question[]>(`/api/forms/${formId}/reorder`, {
      method: "PUT",
      body: JSON.stringify({ order }),
    }),

  publicGet: (id: string) =>
    req<import("./types").FormDetail>(`/api/public/forms/${id}`),
  publicSubmit: (id: string, answers: { question_id: string; value: unknown }[]) =>
    req<{ id: string; ok: boolean }>(`/api/public/forms/${id}/responses`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),

  listResponses: (id: string) =>
    req<{
      questions: import("./types").Question[];
      responses: { id: string; submitted_at: string; answers: { question_id: string; value: string }[] }[];
    }>(`/api/forms/${id}/responses`),
  getResponse: (formId: string, rid: string) =>
    req<{
      id: string;
      submitted_at: string;
      answers: { question: import("./types").Question; value: string }[];
    }>(`/api/forms/${formId}/responses/${rid}`),
  stats: (id: string) =>
    req<{
      total_responses: number;
      stats: {
        question_id: string;
        type: string;
        answered: number;
        total: number;
        counts?: Record<string, number>;
        average?: number | null;
        samples?: string[];
      }[];
    }>(`/api/forms/${id}/stats`),

  exportUrl: (id: string) => `${API_BASE}/api/forms/${id}/export.csv`,
};
