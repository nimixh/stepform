"use client";
import React, { createContext, useCallback, useContext, useState } from "react";

interface Toast {
  id: number;
  msg: string;
  kind: "ok" | "error";
}

const Ctx = createContext<{ toast: (msg: string, kind?: "ok" | "error") => void }>({
  toast: () => {},
});

export const useToast = () => useContext(Ctx);

let seq = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((msg: string, kind: "ok" | "error" = "ok") => {
    const id = seq++;
    setItems((p) => [...p, { id, msg, kind }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 2600);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast${t.kind === "error" ? " error" : ""}`}>
            <span>{t.kind === "error" ? "⚠" : "✓"}</span>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
