import { NextRequest, NextResponse } from "next/server";
import { PRIVATE_HEADERS, girinError, readSession } from "@/lib/girin-session";
import { getOwnResults } from "@/lib/own-results";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await readSession(request);
  if (!session) return girinError("로그인이 필요합니다.", 401);
  try {
    const items = await getOwnResults(session);
    return NextResponse.json({ name: session.name, items }, { headers: PRIVATE_HEADERS });
  } catch {
    return girinError("성적을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
  }
}
