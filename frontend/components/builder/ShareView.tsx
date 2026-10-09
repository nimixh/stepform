"use client";
import { useState } from "react";
import type { FormDetail } from "@/lib/types";

interface Props {
  form: FormDetail;
  onPublish: () => void;
  onUnpublish: () => void;
  notify: (m: string, k?: "ok" | "error") => void;
}

export default function ShareView({ form, onPublish, onUnpublish, notify }: Props) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/s/${form.id}`;
  const published = form.status === "published";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const el = document.createElement("textarea");
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    notify("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="share-wrap">
      <h2 style={{ margin: "12px 0 6px" }}>
        {published ? "Your form is live" : "Share your form"}
      </h2>
      <p className="help" style={{ fontSize: 14 }}>
        {published
          ? "Anyone with this link can fill in your form — no login required."
          : "Publish your form to get a shareable public link."}
      </p>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18 }}>
        {published ? (
          <button className="btn btn-light" onClick={onUnpublish}>
            Unpublish
          </button>
        ) : (
          <button className="btn btn-dark" onClick={onPublish}>
            Publish form
          </button>
        )}
      </div>

      {published && (
        <div className="link-box">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="btn btn-dark btn-sm" onClick={copy}>
            {copied ? "✓ Copied" : "Copy link"}
          </button>
        </div>
      )}

      <div className="card" style={{ marginTop: 28, padding: 18, textAlign: "left" }}>
        <strong>Embed & integrations</strong>
        <p className="help" style={{ margin: "6px 0 0" }}>
          Embeds, webhooks and team sharing are coming soon.
        </p>
      </div>
    </div>
  );
}
