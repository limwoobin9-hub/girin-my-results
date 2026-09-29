import { NextRequest, NextResponse } from "next/server";
import { PRIVATE_HEADERS, clearSession, girinError, readSession, sameOrigin } from "@/lib/girin-session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await readSession(request);
  if (!session) return girinError("로그인이 필요합니다.", 401);
  return NextResponse.json({ name: session.name }, { headers: PRIVATE_HEADERS });
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return girinError("요청 출처를 확인할 수 없습니다.", 403);
  return clearSession(NextResponse.json({ ok: true }, { headers: PRIVATE_HEADERS }));
}
