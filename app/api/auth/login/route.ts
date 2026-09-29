import { NextRequest, NextResponse } from "next/server";
import { GIRIN_ORIGIN, PRIVATE_HEADERS, girinError, issueSession, loginCookie, sameOrigin, setSession } from "@/lib/girin-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return girinError("요청 출처를 확인할 수 없습니다.", 403);
  let data: unknown;
  try { data = await request.json(); } catch { return girinError("이름과 비밀번호를 입력해 주세요.", 400); }
  const body = data as { name?: unknown; password?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().normalize("NFC") : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!name || name.length > 80 || !password || password.length > 200) return girinError("이름과 비밀번호를 확인해 주세요.", 400);
  if (!process.env.GIRIN_SESSION_SECRET || process.env.GIRIN_SESSION_SECRET.length < 32) return girinError("로그인 기능을 준비 중입니다.", 503);
  try {
    const upstream = await fetch(`${GIRIN_ORIGIN}/api/login`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json", "Content-Type": "application/json", Origin: GIRIN_ORIGIN },
      body: JSON.stringify({ name, att_no: password }),
    });
    if (!upstream.ok) return girinError(upstream.status === 401 || upstream.status === 403 ? "이름 또는 비밀번호가 맞지 않습니다." : "로그인에 실패했습니다.", upstream.status === 401 || upstream.status === 403 ? 401 : 502);
    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object") return girinError("로그인 응답을 확인할 수 없습니다.", 502);
    const student = payload as { id?: unknown; name?: unknown; role?: unknown };
    const id = Number(student.id);
    if (!Number.isInteger(id) || id <= 0 || id > 999999999 || typeof student.name !== "string" || !student.name.trim() || student.role && student.role !== "student") {
      return girinError("학생 계정으로 로그인해 주세요.", 403);
    }
    const token = await issueSession(id, student.name.trim().slice(0, 80), loginCookie(upstream.headers.get("set-cookie")));
    return setSession(NextResponse.json({ name: student.name.trim() }, { headers: PRIVATE_HEADERS }), token);
  } catch {
    return girinError("기린국어에 연결하지 못했습니다.", 502);
  }
}
