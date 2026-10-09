"use client";

/** Short random id for client-created option rows. */
export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

/** 0-based option badge letter: 0 → "A", 1 → "B", … */
export function letter(i: number): string {
  return "ABCDEFGH"[i] ?? String(i + 1);
}
