import { useEffect, useRef, useState } from "react";
import { Bell, Kanban, Lightning, MagnifyingGlass, Moon, SquaresFour, Sun, UsersThree, X, type Icon } from "@phosphor-icons/react";
import {
  API, clock, counts, dark, goToSession, markAllRead, notices, page, query, serviceOnline, snapshot,
  toast, toggleTheme, unread, type Page,
} from "./store";
import { AgentCards, Health, Kanban as WorkQueue, Logs, Throughput } from "./Panels";
import { Network } from "./Network";
import { Drawer } from "./Fx";
import { AgentGlyph } from "./Glyph";
import { BrandName, Logo, OfflineTitle, SessionSpark } from "./Effects";
import { ago } from "./util";

const TABS: { key: Page; label: string; icon: Icon }[] = [
  { key: "overview", label: "Overview", icon: SquaresFour },
  { key: "sessions", label: "Sessions", icon: Kanban },
  { key: "agents", label: "Agents", icon: UsersThree },
];

function Offline() {
  return (
    <div className="offline">
      <div className="offlineIcon"><Lightning weight="fill" /></div>
      <OfflineTitle />
      <p>
        This page only displays data. The Bridge runs on your machine (<code>{API}</code>) and reads
        your <code>data/</code> folder. Install and start it, then this page reconnects automatically:
      </p>
      <pre>{`git clone https://github.com/quocchungthan/PARA-AI-solution
cd PARA-AI-solution
dotnet run --project src/Bridge`}</pre>
      <p className="sub">
        Started it and still offline? Your browser may have asked to allow this site to reach devices on your
        local network: choose Allow (or enable it in the site settings for this page).
      </p>
      <div className="retry"><span className="spinner" /> retrying every few seconds…</div>
    </div>
  );
}

function Search() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) { e.preventDefault(); ref.current?.focus(); }
      if (e.key === "Escape" && document.activeElement === ref.current) { query.value = ""; ref.current?.blur(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <label className="search">
      <MagnifyingGlass />
      <input ref={ref} value={query.value} aria-label="Search sessions" placeholder="Search sessions…"
        onChange={(e) => {
          query.value = e.target.value;
          if (e.target.value && page.value === "overview") page.value = "sessions";
        }} />
      {query.value ? <button onClick={() => (query.value = "")} aria-label="Clear search"><X /></button> : <kbd>/</kbd>}
    </label>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const count = unread.value;
  const now = clock.value.getTime();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="notify" ref={box}>
      <button className={`icon bell ${count ? "has" : ""}`} onClick={() => { setOpen(!open); toast.value = null; }} aria-expanded={open}
        aria-label={count ? `${count} new tasks` : "Notifications"} title="New tasks in the work queue">
        <Bell key={count} weight={count ? "fill" : "regular"} className={count ? "ring" : ""} />
        {count > 0 && <span className="badgeCount">{count > 9 ? "9+" : count}</span>}
      </button>
      {open && (
        <div className="notifyMenu" role="menu">
          <div className="notifyHead">
            <strong>New tasks</strong>
            {count > 0 && <button className="more" onClick={markAllRead}>Mark all read</button>}
          </div>
          {notices.value.length === 0 && <div className="emptyCol">No new tasks yet. You'll be notified here.</div>}
          {notices.value.map((n) => (
            <button key={n.id} role="menuitem" className={`notice ${n.read ? "" : "unread"}`}
              onClick={() => { goToSession(n.sessionId); setOpen(false); }}>
              <AgentGlyph name={n.agent} size="sm" />
              <span className="noticeText"><b>{n.title}</b><small>{n.agent} · {n.sessionId.slice(0, 8)} · {ago(new Date(n.at).toISOString(), now)}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toast() {
  const t = toast.value;
  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(() => (toast.value = null), 8000);
    return () => clearTimeout(timer);
  }, [t]);
  if (!t) return null;
  return (
    <div className="toast" role="status">
      <button className="toastBody" onClick={() => goToSession(t.sessionId)}>
        <Bell weight="fill" className="toastIcon" />
        <span><b>New task in the work queue</b><small>{t.title} · {t.agent}</small></span>
        <span className="toastGo">View</span>
      </button>
      <button className="toastClose" onClick={() => (toast.value = null)} aria-label="Dismiss"><X /></button>
    </div>
  );
}

function Skeleton() {
  return <div className="overview"><div className="panel skel" /><div className="panel skel" /></div>;
}

export function App() {
  const online = serviceOnline.value;
  const c = counts.value;
  const isDark = dark.value;
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  const time = clock.value.toLocaleTimeString("en-GB");
  const log = snapshot.value?.log ?? [];
  const lastPass = [...log].reverse().find((l) => l.includes("pass #"))?.match(/pass #\d+/)?.[0];
  const current = page.value;

  return (
    <>
      <header>
        <div className="brand">
          <Logo light={!isDark} />
          <div><BrandName light={!isDark} /><small>Agent Mission Control</small></div>
        </div>
        <nav className="tabs" aria-label="Pages">
          {TABS.map((t) => {
            const TabIcon = t.icon;
            return (
              <button key={t.key} className={current === t.key ? "on" : ""} aria-current={current === t.key ? "page" : undefined}
                onClick={() => (page.value = t.key)}>
                <TabIcon weight="duotone" />{t.label}
                {t.key === "sessions" && c.attention > 0 && <span className="tabBadge" title="Sessions that need you">{c.attention}</span>}
              </button>
            );
          })}
        </nav>
        <span className={`pill ${online ? "up" : online === false ? "down" : ""}`}>
          <i className="dot" /> {online === null ? "Connecting…" : online ? "Online" : "Offline"}
        </span>
        {online && lastPass && <span className="pill scan">Scan {lastPass}</span>}
        <div className="spacer" />
        {online && <Search />}
        <span className="clock">{time}</span>
        <Notifications />
        <button className="icon" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
          {isDark ? <Moon weight="duotone" /> : <Sun weight="duotone" />}
        </button>
      </header>
      <main>
        {online === null && <Skeleton />}
        {online === false && <Offline />}
        {online && snapshot.value && (
          <div key={current} className="page">
            {current === "overview" && (
              <div className="overview">
                <Network />
                <Logs />
              </div>
            )}
            {current === "sessions" && (
              <SessionSpark>
                <WorkQueue />
                <div className="charts"><Throughput /><Health /></div>
              </SessionSpark>
            )}
            {current === "agents" && <AgentCards />}
          </div>
        )}
      </main>
      <Toast />
      <Drawer />
    </>
  );
}
