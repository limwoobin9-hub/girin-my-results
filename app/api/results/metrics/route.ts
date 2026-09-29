import { NextRequest, NextResponse } from "next/server";
import { parseAssessments } from "@/lib/assessments";
import { GIRIN_ORIGIN, PRIVATE_HEADERS, girinError, readSession } from "@/lib/girin-session";
import { getOwnResults } from "@/lib/own-results";
import { gradeCutoffs, rankAmongParticipants } from "@/lib/ranking";

export const runtime = "nodejs";
export const maxDuration = 60;

type ScoreMap = Record<string, number>;
let cohortCache: { expires: number; promise: Promise<Map<number, ScoreMap>> } | null = null;

async function collectCohort(): Promise<Map<number, ScoreMap>> {
  const result = new Map<number, ScoreMap>();
  let cursor = 0;
  let failure = false;
  const ids = Array.from({ length: 3322 - 3034 + 1 }, (_, index) => 3034 + index);
  await Promise.all(Array.from({ length: Math.min(12, ids.length) }, async () => {
    while (cursor < ids.length && !failure) {
      const id = ids[cursor++];
      try {
        const response = await fetch(`${GIRIN_ORIGIN}/api/my/${id}/homeworks`, {
          headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(7000),
        });
        if (response.status === 404) continue;
        if (!response.ok) throw new Error(`Cohort HTTP ${response.status}`);
        const parsed = parseAssessments(await response.json(), 500);
        if (!parsed) throw new Error("Unexpected cohort response");
        const map: ScoreMap = Object.create(null);
        for (const item of parsed) map[item.key] = item.score;
        result.set(id, map);
      } catch { failure = true; }
    }
  }));
  if (failure) throw new Error("Cohort incomplete");
  return result;
}

function cachedCohort() {
  if (!cohortCache || cohortCache.expires < Date.now()) {
    const promise = collectCohort();
    cohortCache = { expires: Date.now() + 120_000, promise };
    void promise.catch(() => { if (cohortCache?.promise === promise) cohortCache = null; });
  }
  return cohortCache.promise;
}

export async function GET(request: NextRequest) {
  const session = await readSession(request);
  if (!session) return girinError("로그인이 필요합니다.", 401);
  try {
    // Neither student ID nor assessment keys are accepted from query parameters.
    const own = await getOwnResults(session);
    if (!own.length) return NextResponse.json({ metrics: {} }, { headers: PRIVATE_HEADERS });
    const cohort = await cachedCohort();
    const metrics: Record<string, unknown> = Object.create(null);
    for (const item of own) {
      const scores: number[] = [];
      for (const [id, map] of cohort) {
        if (id !== session.id && Object.hasOwn(map, item.key)) scores.push(map[item.key]);
      }
      scores.push(item.score);
      const rank = rankAmongParticipants(item.score, scores);
      if (!rank) continue;
      metrics[item.key] = {
        average: Math.round(rank.average * 10) / 10,
        rank: rank.rank, tied: rank.tied, count: rank.count,
        grade5: rank.grade5, grade9: rank.grade9,
        cutoffs5: gradeCutoffs(scores, 5), cutoffs9: gradeCutoffs(scores, 9),
      };
    }
    return NextResponse.json({ metrics }, { headers: PRIVATE_HEADERS });
  } catch {
    return girinError("집계를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
  }
}
