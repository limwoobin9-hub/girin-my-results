import { assessmentKey, numeric } from "@/lib/ranking";

export type Assessment = {
  id: number;
  key: string;
  kind: "hw" | "exam";
  title: string;
  score: number;
  dueAt: string | null;
  submittedAt: string | null;
};

export function parseAssessments(data: unknown, limit = 12): Assessment[] | null {
  if (!Array.isArray(data)) return null;
  return data.slice(0, 500).flatMap((raw): Assessment[] => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const id = numeric(row.id);
    const score = numeric(row.score);
    if (!Number.isSafeInteger(id) || !id || id < 1 || score === null ||
      (row.kind !== "hw" && row.kind !== "exam") || typeof row.title !== "string" || !row.title.trim()) return [];
    const dueAt = typeof row.due_at === "string" ? row.due_at : null;
    return [{
      id, key: assessmentKey({ id, kind: row.kind, title: row.title, due_at: dueAt }), kind: row.kind,
      title: row.title.trim().slice(0, 180), score,
      dueAt, submittedAt: typeof row.submitted_at === "string" ? row.submitted_at : null,
    }];
  }).sort((a, b) => (b.submittedAt || b.dueAt || "").localeCompare(a.submittedAt || a.dueAt || "") || b.id - a.id).slice(0, limit);
}
