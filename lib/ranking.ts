export type GradedItem = {
  id?: number | null;
  kind: "hw" | "exam";
  title: string;
  due_at?: string | null;
  score: number | null;
};

export function compareHomeworkAge(
  a: { id?: number | null; open_at?: string | null; due_at?: string | null },
  b: { id?: number | null; open_at?: string | null; due_at?: string | null },
): number {
  const aDate = a.open_at || a.due_at || "";
  const bDate = b.open_at || b.due_at || "";
  if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate);
  if (aDate !== bDate) return aDate ? -1 : 1;
  return (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER);
}

export function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function assessmentKey(item: Pick<GradedItem, "id" | "kind" | "title" | "due_at">): string {
  return item.id !== null && item.id !== undefined
    ? JSON.stringify([item.kind, item.id])
    : JSON.stringify([item.kind, item.title.trim(), item.due_at ?? ""]);
}

const nineGradeLimits = [4, 11, 23, 40, 60, 77, 89, 96];
const fiveGradeLimits = [10, 34, 66, 90];

export function gradeCutoffs(scores: number[], system: 5 | 9) {
  const bands: Array<{ grade: number; minimum: number | null; students: number }> =
    Array.from({ length: system }, (_, index) => ({ grade: index + 1, minimum: null, students: 0 }));
  for (const score of new Set(scores.filter(Number.isFinite))) {
    const ranking = rankAmongParticipants(score, scores);
    if (!ranking) continue;
    const band = bands[(system === 5 ? ranking.grade5 : ranking.grade9) - 1];
    band.students += ranking.tied;
    band.minimum = band.minimum === null ? score : Math.min(band.minimum, score);
  }
  return bands;
}

export function rankAmongParticipants(score: number, scores: number[]) {
  if (!Number.isFinite(score) || !scores.length || !scores.includes(score)) return null;
  const higher = scores.filter((other) => other > score).length;
  const tied = scores.filter((other) => other === score).length;
  const topPercent = (higher + (tied - 1) / 2) / scores.length * 100;
  const grade = (limits: number[]) => 1 + limits.filter((limit) => topPercent >= limit).length;
  return {
    count: scores.length,
    average: scores.reduce((sum, value) => sum + value, 0) / scores.length,
    rank: higher + 1,
    tied,
    topPercent,
    grade9: grade(nineGradeLimits),
    grade5: grade(fiveGradeLimits),
  };
}
