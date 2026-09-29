"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, ChevronDown, CircleHelp, LoaderCircle, LogOut, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";

type Item = { id: number; key: string; title: string; kind: "hw" | "exam"; score: number; dueAt: string | null; submittedAt: string | null };
type Cutoff = { grade: number; minimum: number | null; students: number };
type Metric = { average: number; rank: number; tied: number; count: number; grade5: number; grade9: number; cutoffs5: Cutoff[]; cutoffs9: Cutoff[] };
type Session = { name: string };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error || "연결을 확인해 주세요.");
  return response.json() as Promise<T>;
}

function shortDate(date: string | null) {
  return date?.slice(0, 10).replaceAll("-", ". ") || "날짜 없음";
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [itemsBusy, setItemsBusy] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [metrics, setMetrics] = useState<Record<string, Metric>>({});
  const [metricsBusy, setMetricsBusy] = useState(false);
  const [metricsError, setMetricsError] = useState("");
  const [filter, setFilter] = useState<"all" | "hw" | "exam">("all");

  const loadMetrics = useCallback(async () => {
    setMetricsBusy(true);
    setMetricsError("");
    try {
      const result = await getJson<{ metrics: Record<string, Metric> }>("/api/results/metrics");
      setMetrics(result.metrics);
    } catch (error) {
      setMetricsError(error instanceof Error ? error.message : "집계를 완료하지 못했습니다.");
    } finally { setMetricsBusy(false); }
  }, []);

  const loadResults = useCallback(async () => {
    setItemsBusy(true);
    setItemsError("");
    setMetrics({});
    try {
      const result = await getJson<{ items: Item[] }>("/api/results");
      setItems(result.items);
      if (result.items.length) void loadMetrics();
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
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password }),
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

  const visible = items.filter((item) => filter === "all" || item.kind === filter);
  const latest = items[0];
  const measured = Object.keys(metrics).length;

  if (checking) return <main className="screen-center"><LoaderCircle className="spin" size={28} aria-label="로그인 확인 중" /></main>;

  if (!session) return <main className="login-page">
    <div className="orb orb-one" /><div className="orb orb-two" />
    <div className="login-layout">
      <section className="intro">
        <div className="brand"><span className="brand-mark">기</span><span>기린국어 <b>성적</b></span></div>
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR LEARNING, CLEARLY</div>
        <h1>내 성적을<br /><em>한눈에.</em></h1>
        <p>최근 숙제와 시험의 점수, 평균, 등수와 등급컷을 확인하세요.</p>
        <div className="intro-foot"><span className="tiny-star">✳</span> 본인 계정으로 로그인하면 본인 성적만 표시됩니다.</div>
      </section>
      <section className="login-card" aria-label="로그인">
        <div className="login-icon"><BookOpen size={24} strokeWidth={1.7} /></div>
        <div className="login-label">WELCOME BACK</div>
        <h2>로그인</h2>
        <p className="muted">기린국어 계정으로 시작하세요.</p>
        <form onSubmit={signIn}>
          <label htmlFor="student-name">이름</label>
          <input id="student-name" autoComplete="username" placeholder="이름을 입력하세요" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} />
          <label htmlFor="student-password">비밀번호</label>
          <input id="student-password" type="password" autoComplete="current-password" placeholder="비밀번호를 입력하세요" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={200} />
          {loginError && <div className="form-error" role="alert">{loginError}</div>}
          <button className="primary-button" type="submit" disabled={loginBusy}>{loginBusy ? <LoaderCircle className="spin" size={18} /> : <>성적 확인하기 <ArrowRight size={19} /></>}</button>
        </form>
        <div className="login-note"><ShieldCheck size={16} /> 비밀번호는 기린국어 로그인 확인에만 사용됩니다.</div>
      </section>
    </div>
  </main>;

  return <main className="dashboard">
    <header className="topbar"><div className="topbar-inner">
      <div className="brand brand-dark"><span className="brand-mark">기</span><span>기린국어 <b>성적</b></span></div>
      <div className="topbar-right"><span className="user-chip"><span className="user-dot">{session.name.slice(0, 1)}</span>{session.name} 님</span><button className="logout" onClick={signOut} aria-label="로그아웃"><LogOut size={17} /><span>로그아웃</span></button></div>
    </div></header>
    <div className="dashboard-inner">
      <div className="dash-heading"><div><div className="overline">MY RESULTS <span className="overline-rule" /></div><h1>{session.name}님의 <em>성적표</em></h1><p>최근 숙제와 시험 기록을 살펴보세요.</p></div><div className="heading-flower" aria-hidden="true">✳</div></div>
      <section className="summary" aria-label="최근 성적 요약">
        <div className="summary-card summary-highlight"><span className="card-label">최근 점수 <Sparkles size={15} /></span><strong>{latest ? <>{latest.score}<small>점</small></> : "—"}</strong><span className="card-hint">{latest?.title || "채점된 기록 없음"}</span></div>
        <div className="summary-card"><span className="card-label">최근 평균</span><strong>{latest && metrics[latest.key] ? <>{metrics[latest.key].average}<small>점</small></> : "—"}</strong><span className="card-hint">{metricsBusy ? "집계 중" : "같은 평가 참여자"}</span></div>
        <div className="summary-card"><span className="card-label">최근 등수</span><strong>{latest && metrics[latest.key] ? <>{metrics[latest.key].rank}<small>위</small></> : "—"}</strong><span className="card-hint">{latest && metrics[latest.key] ? `${metrics[latest.key].count}명 중${metrics[latest.key].tied > 1 ? ` · ${metrics[latest.key].tied}명 공동` : ""}` : "집계 완료 후 표시"}</span></div>
        <div className="summary-card"><span className="card-label">최근 9등급</span><strong>{latest && metrics[latest.key] ? <>{metrics[latest.key].grade9}<small>등급</small></> : "—"}</strong><span className="card-hint">집계 표본 기준</span></div>
      </section>
      <section className="records" aria-label="최근 성적">
        <div className="section-head"><div><div className="section-kicker">RECORDS</div><h2>최근 성적 <span>{items.length.toString().padStart(2, "0")}</span></h2></div><button className="refresh" onClick={() => void loadResults()} disabled={itemsBusy} aria-label="성적 새로고침"><RefreshCw className={itemsBusy ? "spin" : ""} size={17} /> 새로고침</button></div>
        <div className="list-controls"><div className="tabs" role="group" aria-label="평가 종류"><button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>전체</button><button className={filter === "hw" ? "selected" : ""} onClick={() => setFilter("hw")}>숙제</button><button className={filter === "exam" ? "selected" : ""} onClick={() => setFilter("exam")}>시험</button></div><span className="list-count">최근 채점된 {items.length}건</span></div>
        {itemsError && <div className="status error" role="alert">{itemsError} <button onClick={() => void loadResults()}>다시 시도</button></div>}
        {metricsError && <div className="status error" role="alert">{metricsError} <button onClick={() => void loadMetrics()}>집계 다시 시도</button></div>}
        {metricsBusy && items.length > 0 && <div className="status subtle"><LoaderCircle className="spin" size={17} /> 평균·등수·등급컷 집계 중…</div>}
        {itemsBusy && !items.length && <div className="empty"><LoaderCircle className="spin" size={26} /> 성적을 불러오는 중…</div>}
        {!itemsBusy && !itemsError && !visible.length && <div className="empty"><BookOpen size={27} strokeWidth={1.5} /> 표시할 채점 기록이 없습니다.</div>}
        <div className="record-list">{visible.map((item, index) => {
          const metric = metrics[item.key];
          return <article className="record-card" key={`${item.kind}-${item.id}`}>
            <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
            <div className="record-content"><div className="record-meta"><span className={`kind ${item.kind}`}>{item.kind === "hw" ? "숙제" : "시험"}</span><span>{shortDate(item.submittedAt || item.dueAt)}</span></div><h3>{item.title}</h3><div className="record-stats"><div className="my-score"><small>내 점수</small><b>{item.score}<span>점</span></b></div><div><small>평균</small><b>{metric ? `${metric.average}점` : "—"}</b></div><div><small>등수</small><b>{metric ? `${metric.rank} / ${metric.count}` : "—"}</b></div><div><small>9등급</small><b>{metric ? `${metric.grade9}등급` : "—"}</b></div></div>
              {metric && <details className="cutoffs"><summary>등급컷 보기 <ChevronDown size={16} /></summary><div className="cutoff-grid"><div><div className="cutoff-title">9등급 기준</div><div className="cutoff-bands">{metric.cutoffs9.map((band) => <div key={band.grade}><span>{band.grade}등급</span><strong>{band.minimum === null ? "—" : `${band.minimum}점`}</strong></div>)}</div></div><div><div className="cutoff-title">5등급 기준</div><div className="cutoff-bands">{metric.cutoffs5.map((band) => <div key={band.grade}><span>{band.grade}등급</span><strong>{band.minimum === null ? "—" : `${band.minimum}점`}</strong></div>)}</div></div></div><p>표본 {metric.count}명 · 동점자 중간 순위 기준 계산값</p></details>}
            </div>
          </article>;
        })}</div>
      </section>
      <footer className="footer"><CircleHelp size={16} /><span>평균·등수·등급컷은 확인 가능한 참여자의 점수로 계산한 값입니다. 공식 등급컷과 다를 수 있습니다.</span><span className="footer-count">{measured ? `${measured}건 집계` : ""}</span></footer>
    </div>
  </main>;
}
