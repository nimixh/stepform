"use client";
import { useState } from "react";
import type { FormDetail } from "@/lib/types";
import { PageBadge } from "./bits";

interface Props {
  form: FormDetail;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: () => void;
  onReorder: (order: string[]) => void;
  onNudge: (qid: string, dir: -1 | 1) => void;
  onDuplicate: (qid: string) => void;
  onDelete: (qid: string) => void;
  onToggleWelcome: (on: boolean) => void;
}

export default function LeftPanel({
  form, selectedId, onSelect, onAdd, onReorder, onNudge, onDuplicate, onDelete, onToggleWelcome,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const qs = [...form.questions].sort((a, b) => a.position - b.position);

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const order = qs.map((q) => q.id);
    const from = order.indexOf(dragId);
    const to = order.indexOf(targetId);
    order.splice(to, 0, order.splice(from, 1)[0]);
    onReorder(order);
    setDragId(null);
    setOverId(null);
  };

  const closeMenu = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuId(null);
    fn();
  };

  return (
    <div className="side side-left" onClick={() => setMenuId(null)}>
      <h4>Pages</h4>
      {qs.map((q, i) => (
        <div
          key={q.id}
          className={`page-item${selectedId === q.id ? " selected" : ""}${dragId === q.id ? " dragging" : ""}`}
          style={overId === q.id ? { borderColor: "var(--ink)" } : undefined}
          onClick={() => onSelect(q.id)}
          draggable
          onDragStart={(e) => {
            setDragId(q.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (q.id !== dragId) setOverId(q.id);
          }}
          onDragLeave={() => setOverId((o) => (o === q.id ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(q.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
          title="Drag to reorder"
        >
          <span className="drag-handle" aria-hidden="true">
            ⠿
          </span>
          <PageBadge index={i} type={q.type} />
          <span className="page-title">{q.title === "..." ? "…" : q.title || "…"}</span>
          <span style={{ position: "relative", marginLeft: "auto" }}>
            <button
              className="icon-btn row-menu-btn"
              aria-label={`Options for question ${i + 1}`}
              aria-haspopup="menu"
              title="Options"
              onClick={(e) => {
                e.stopPropagation();
                setMenuId(menuId === q.id ? null : q.id);
              }}
            >
              ⋯
            </button>
            {menuId === q.id && (
              <div className="pop" role="menu" style={{ right: 0, top: 30, minWidth: 170 }} onClick={(e) => e.stopPropagation()}>
                <button className="pop-item" disabled={i === 0} onClick={closeMenu(() => onNudge(q.id, -1))}>
                  Move up
                </button>
                <button className="pop-item" disabled={i === qs.length - 1} onClick={closeMenu(() => onNudge(q.id, 1))}>
                  Move down
                </button>
                <button className="pop-item" onClick={closeMenu(() => onDuplicate(q.id))}>
                  Duplicate
                </button>
                <button className="pop-item" style={{ color: "var(--red)" }} onClick={closeMenu(() => onDelete(q.id))}>
                  Delete
                </button>
              </div>
            )}
          </span>
        </div>
      ))}

      <button className="dashed-add" onClick={onAdd} style={{ justifyContent: "center" }}>
        <span style={{ fontSize: 16 }}>+</span> Add content
      </button>

      <div style={{ marginTop: 8 }}>
        <button
          className="dashed-add"
          style={{ width: "100%" }}
          onClick={() => onToggleWelcome(!form.welcome_enabled)}
          title="Toggle a welcome screen"
        >
          <span>✦</span> {form.welcome_enabled ? "Welcome Screen ✓" : "Add Welcome Screen"}
          <span style={{ marginLeft: "auto" }}>{form.welcome_enabled ? "✓" : "+"}</span>
        </button>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h4 style={{ margin: 0 }}>Endings</h4>
          <span className="help" title="Thank-you screen is edited in Form settings">
            ⓘ
          </span>
        </div>
        <div className="page-item" style={{ marginTop: 6, cursor: "default" }}>
          <span className="page-num">✓</span>
          <span className="page-title">Thank-you screen</span>
        </div>
      </div>
    </div>
  );
}
