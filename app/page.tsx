"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";

type Item = { id: number; key: string; title: string; kind: "hw" | "exam"; score: number; dueAt: string | null; submittedAt: string | null };
type Cutoff = { grade: number; minimum: number | null; students: number };
type Metric = { average: number; rank: number; tied: number; count: number; grade5: number; grade9: number; cutoffs5: Cutoff[]; cutoffs9: Cutoff[] };
type Session = { name: string };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error || "연결을 확인해 주세요.");
  return response.json() as Promise<T>;
}

async function getMetrics() {
  try {
    return await getJson<{ metrics: Record<string, Metric> }>("/api/results/metrics");
  } catch {
    // A cold cohort request can fail while one upstream request is temporarily unavailable.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return getJson<{ metrics: Record<string, Metric> }>("/api/results/metrics");
  }
}

function shortDate(date: string | null) {
  return date?.slice(0, 10).replaceAll("-", ". ") || "날짜 없음";
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [itemsBusy, setItemsBusy] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [metrics, setMetrics] = useState<Record<string, Metric>>({});
  const [metricsBusy, setMetricsBusy] = useState(false);
  const [metricsError, setMetricsError] = useState("");

  const loadMetrics = useCallback(async () => {
    setMetricsBusy(true);
    setMetricsError("");
    try {
      const result = await getMetrics();
      setMetrics(result.metrics);
    } catch (error) {
      setMetrics({});
      setMetricsError(error instanceof Error ? error.message : "집계를 완료하지 못했습니다.");
    } finally { setMetricsBusy(false); }
  }, []);

  const loadResults = useCallback(async () => {
    setItemsBusy(true);
    setItemsError("");
    try {
      const result = await getJson<{ items: Item[] }>("/api/results");
      // Present a complete card on first login instead of rendering dashes while metrics load.
      if (result.items.length) await loadMetrics();
      else { setMetrics({}); setMetricsError(""); }
      setItems(result.items);
    } catch (error) {
      setItemsError(error instanceof Error ? error.message : "성적을 불러오지 못했습니다.");
    } finally { setItemsBusy(false); }
  }, [loadMetrics]);

  useEffect(() => {
    let active = true;
    void getJson<Session>("/api/auth/session").then((current) => {
      if (active) { setSession(current); void loadResults(); }
    }).catch(() => {}).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [loadResults]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password, remember }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "로그인하지 못했습니다.");
      setPassword("");
      setSession({ name: data.name });
      void loadResults();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "로그인하지 못했습니다.");
    } finally { setLoginBusy(false); }
  }

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
    // A navigation ends any in-flight result fetch before it can redraw private data.
    window.location.assign("/");
  }

  if (checking) return <main className="screen-center"><LoaderCircle className="spin" size={28} aria-label="로그인 확인 중" /></main>;

  if (!session) return <main className="dashboard">
    <header className="site-header"><div className="container"><h1>나의 성적</h1></div></header>
    <div className="container main-content">
      <section className="search-panel submit-login" aria-labelledby="girin-login-heading">
        <h2 id="girin-login-heading">기린국어 로그인</h2>
        <form onSubmit={signIn} className="submit-login-form">
          <label htmlFor="student-name">이름</label>
          <input id="student-name" autoComplete="username" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} />
          <label htmlFor="student-password">비밀번호</label>
          <input id="student-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={200} />
          <label className="remember-option" htmlFor="remember-login">
            <input id="remember-login" type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            로그인 유지
          </label>
          <button className="solid-button" type="submit" disabled={loginBusy}>{loginBusy ? "로그인 중…" : "로그인"}</button>
        </form>
        {loginError && <p className="error-message" role="alert">{loginError}</p>}
      </section>
    </div>
  </main>;

  return <main className="dashboard">
    <header className="site-header"><div className="container"><h1>나의 성적</h1></div></header>
    <div className="container main-content">
      <div className="account-row"><strong>{session.name}</strong><div>
        <button type="button" className="outline-button" onClick={() => void loadResults()} disabled={itemsBusy}>새로고침</button>
        <button type="button" className="outline-button" onClick={signOut}>로그아웃</button>
      </div></div>
      {itemsError && <p className="error-message" role="alert">{itemsError} <button onClick={() => void loadResults()}>다시 시도</button></p>}
      {metricsError && <p className="error-message" role="alert">{metricsError} <button onClick={() => void loadMetrics()}>집계 다시 시도</button></p>}
      {itemsBusy && !items.length && <div className="empty-card" role="status">성적 불러오는 중…</div>}
      {!itemsBusy && !itemsError && !items.length && <div className="empty-card">채점된 숙제나 시험이 없습니다.</div>}
      {metricsBusy && items.length > 0 && <p className="loading-note" role="status">평균·등수 집계 중…</p>}
      <div className="cards">{items.map((item) => {
        const metric = metrics[item.key];
        return <article className="homework-card" key={`${item.kind}-${item.id}`}>
          <div className="card-heading"><h2>{item.title}</h2><span className="status-pill is-done">{item.kind === "hw" ? "숙제" : "시험"}</span></div>
          <div className="card-meta">{shortDate(item.submittedAt || item.dueAt)}</div>
          <div className="ranking-metrics">
            <div><span>내 점수</span><strong>{item.score}점</strong></div>
            <div><span>평균</span><strong>{metric ? `${metric.average}점` : "—"}</strong></div>
            <div><span>등수</span><strong>{metric ? `${metric.rank} / ${metric.count}` : "—"}</strong></div>
            <div><span>9등급</span><strong>{metric ? `${metric.grade9}등급` : "—"}</strong></div>
          </div>
          {metric && <details className="cutoffs"><summary>등급컷 보기</summary><div className="cutoff-grid">
            <div><h3>9등급 기준</h3><div className="cutoff-list">{metric.cutoffs9.map((band) => <div className="cutoff-row" key={band.grade}><span>{band.grade}등급</span><strong>{band.minimum === null ? "—" : `${band.minimum}점`}</strong><small>{band.students}명</small></div>)}</div></div>
            <div><h3>5등급 기준</h3><div className="cutoff-list">{metric.cutoffs5.map((band) => <div className="cutoff-row" key={band.grade}><span>{band.grade}등급</span><strong>{band.minimum === null ? "—" : `${band.minimum}점`}</strong><small>{band.students}명</small></div>)}</div></div>
          </div></details>}
        </article>;
      })}</div>
    </div>
  </main>;
}
