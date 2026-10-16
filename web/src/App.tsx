import { useEffect, useRef, useState } from "react";
import { Bell, Check, Copy, Kanban, Moon, SquaresFour, Sun, UsersThree, X, type Icon } from "@phosphor-icons/react";
import {
  API, clock, counts, dark, goToSession, markAllRead, notFound, notices, openPage, page, serviceOnline, snapshot,
  toast, toggleTheme, unread, type Page,
} from "./store";
import { AgentCards, Health, Kanban as WorkQueue, Logs, Throughput } from "./Panels";
import { Network } from "./Network";
import { Drawer } from "./Fx";
import { AgentGlyph } from "./Glyph";
import { BrandName, Loader, Logo, NotFoundTitle, OfflineBackdrop, OfflineTitle, PageSpark, Splash, StatusOrb } from "./Effects";
import { ago } from "./util";

const TABS: { key: Page; label: string; icon: Icon }[] = [
  { key: "overview", label: "Overview", icon: SquaresFour },
  { key: "sessions", label: "Sessions", icon: Kanban },
  { key: "agents", label: "Agents", icon: UsersThree },
];

const START_BRIDGE = [
  "git clone https://github.com/quocchungthan/PARA-AI-solution",
  "cd PARA-AI-solution",
  "dotnet run --project src/Bridge",
].join("\n");

function Offline() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(START_BRIDGE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <div className="offlineStage">
      <OfflineBackdrop />
      <section className="offline">
        <OfflineTitle />
        <p className="offlineLead">Start it on your machine. This page reconnects on its own.</p>
        <div className="offlineTerm">
          <div className="offlineTermBar">
            <span>Terminal</span>
            <button onClick={copy} aria-label="Copy commands">
              {copied ? <Check weight="bold" /> : <Copy />}{copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre>{START_BRIDGE}</pre>
        </div>
        <footer className="offlineFoot">
          <Loader label={`Retrying ${API.replace(/^https?:\/\//, "")}`} pattern="ripple" fontSize={12} cellSize={4} />
          <span>Still offline? Allow local network access for this site.</span>
        </footer>
      </section>
    </div>
  );
}
function NotFound() {
  const where = decodeURIComponent(location.pathname + location.hash);
  return (
    <section className="notFound">
      <NotFoundTitle />
      <h2>Page not found</h2>
      <p>Nothing lives at <code>{where}</code>.</p>
    </section>
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

function Connecting() {
  return <div className="loadingScreen"><Loader label="Connecting to the Bridge" grid={4} pattern="sweep" cellSize={8} gap={3} fontSize={14} /></div>;
}

export function App() {
  const online = serviceOnline.value;
  const c = counts.value;
  const isDark = dark.value;
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  const time = clock.value.toLocaleTimeString("en-GB");
  const current = notFound.value ? null : page.value;

  return (
    <PageSpark>
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
                onClick={() => openPage(t.key)}>
                <TabIcon weight="duotone" />{t.label}
                {t.key === "sessions" && c.attention > 0 && <span className="tabBadge" title="Sessions that need you">{c.attention}</span>}
              </button>
            );
          })}
        </nav>
        <StatusOrb online={online} />
        <div className="spacer" />
        <span className="clock">{time}</span>
        <Notifications />
        <button className="icon" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
          {isDark ? <Moon weight="duotone" /> : <Sun weight="duotone" />}
        </button>
      </header>
      <main>
        {notFound.value && <NotFound />}
        {!notFound.value && online === null && <Connecting />}
        {!notFound.value && online === false && <Offline />}
        {!notFound.value && online && snapshot.value && (
          <div key={current} className="page">
            {current === "overview" && (
              <div className="overview">
                <Network />
                <Logs />
              </div>
            )}
            {current === "sessions" && (
              <>
                <WorkQueue />
                <div className="charts"><Throughput /><Health /></div>
              </>
            )}
            {current === "agents" && <AgentCards />}
          </div>
        )}
      </main>
      <Toast />
      <Drawer />
      <Splash />
    </PageSpark>
  );
}
