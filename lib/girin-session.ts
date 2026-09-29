import { NextRequest, NextResponse } from "next/server";

export const GIRIN_ORIGIN = "https://hw.girinkorean.com";
export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };
const COOKIE = "girin_student_session";
const HOURS = 8;
const REMEMBER_DAYS = 30;

export type StudentSession = { id: number; name: string; expires: number; upstreamCookie?: string };

async function secretBytes() {
  const value = process.env.GIRIN_SESSION_SECRET;
  if (typeof value !== "string" || value.length < 32) {
    console.error("Student session secret invalid:", typeof value, typeof value === "string" ? value.length : null);
    throw new Error("Student session secret is not configured");
  }
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64(value: string) {
  const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

async function key() {
  return crypto.subtle.importKey("raw", await secretBytes(), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function issueSession(id: number, name: string, upstreamCookie?: string, remember = false) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const duration = remember ? REMEMBER_DAYS * 24 * 3600_000 : HOURS * 3600_000;
  const payload: StudentSession = { id, name, expires: Date.now() + duration, upstreamCookie };
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(JSON.stringify(payload)));
  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function readSession(request: NextRequest): Promise<StudentSession | null> {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token || token.length > 4000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const [nonce, encrypted] = token.split(".");
    const iv = fromBase64(nonce);
    if (iv.length !== 12) return null;
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await key(), fromBase64(encrypted));
    const value: unknown = JSON.parse(new TextDecoder().decode(plaintext));
    if (!value || typeof value !== "object") return null;
    const session = value as StudentSession;
    return Number.isInteger(session.id) && session.id > 0 && typeof session.name === "string" &&
      session.name.length <= 80 && Number.isFinite(session.expires) && session.expires > Date.now() &&
      (session.upstreamCookie === undefined || typeof session.upstreamCookie === "string") ? session : null;
  } catch { return null; }
}

export function setSession(response: NextResponse, token: string, remember = false) {
  response.cookies.set(COOKIE, token, {
    httpOnly: true, secure: true, sameSite: "strict", path: "/",
    ...(remember ? { maxAge: REMEMBER_DAYS * 24 * 3600 } : {}),
  });
  return response;
}

export function clearSession(response: NextResponse) {
  response.cookies.set(COOKIE, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}

export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const host = request.headers.get("host") ?? request.nextUrl.host;
    return parsed.host === host &&
      (parsed.protocol === "https:" ||
        (parsed.protocol === "http:" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)));
  } catch { return false; }
}

export function girinFetch(path: string, session?: StudentSession, options?: { method?: string; body?: unknown }) {
  return fetch(`${GIRIN_ORIGIN}${path}`, {
    method: options?.method ?? "GET", cache: "no-store", signal: AbortSignal.timeout(15000),
    headers: {
      Accept: "application/json",
      ...(options?.method && options.method !== "GET" ? { Origin: GIRIN_ORIGIN } : {}),
      ...(options?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(session?.upstreamCookie ? { Cookie: session.upstreamCookie } : {}),
    },
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export function girinError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: PRIVATE_HEADERS });
}

export function loginCookie(setCookie: string | null) {
  const pair = setCookie?.split(";", 1)[0]?.trim();
  return pair && /^[A-Za-z0-9!#$%&'*+.^_`|~-]+=[^\s;,]{1,2000}$/.test(pair) ? pair : undefined;
}
