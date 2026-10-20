import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  officeRuntime,
  dispatchOffice,
  focusOfficeSession,
  dismissedOfficeNotices,
} from "./state";
import { OfficeRoster } from "./OfficeRoster";
import { OfficeDetails } from "./OfficeDetails";
import { openSession, dark } from "../store";
import { deriveSharedOfficeNotices } from "./model";
import { SceneBoundary } from "./scene/SceneBoundary";
import {getOfficeStyle} from "./styles/registry";
import type {OfficeStyleId} from "./styles/types";
import type { OfficeCameraHandle, SharedOfficeSelection } from "./types";
export function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const change = () => setMatch(mq.matches);
    mq.addEventListener("change", change);
    change();
    return () => mq.removeEventListener("change", change);
  }, [query]);
  return match;
}
export function OfficePanel() {
  const runtime = officeRuntime.value;
  const theme = dark.value ? "dark" : "light";
  const compact = useMedia("(max-width: 899px)"),
    reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const [showScene, setShowScene] = useState(false),
    [retry, setRetry] = useState(0);
  const [cutaway,setCutaway]=useState(true);
  const [cameraReady,setCameraReady]=useState<string|null>(null);
  const [focusedRoom,setFocusedRoom]=useState<string|null>(null);
  const cameraRef = useRef<OfficeCameraHandle | null>(null);
  const region = useRef<HTMLDivElement>(null);
  const Canvas = useMemo(
    () => lazy(() => import("./scene/OfficeCanvas")),
    [retry],
  );
  if (!runtime) return <p>Waiting for the Bridge snapshot…</p>;
  const style=getOfficeStyle(runtime.styleId);
  const switchStyle=(styleId:OfficeStyleId)=>{if(styleId===runtime.styleId)return;setCameraReady(null);dispatchOffice({type:"style",styleId,nowMs:Date.now()});};
  const select = (selection: SharedOfficeSelection) =>
    dispatchOffice({ type: "select", selection });
  const details = (
    <OfficeDetails
      runtime={runtime}
      onSelect={select}
      onClose={() => select(null)}
      onOpenSession={(id) => {
        select(null);
        openSession.value = id;
      }}
    />
  );
  const notices = deriveSharedOfficeNotices(runtime.model);
  const dismissed = dismissedOfficeNotices.value;
  return (
    <div className="officePanel">
      <span className="officeSrOnly" aria-live="polite">
        {notices.filter((n) => n.kind === "human").length} requests for human
        input; {notices.filter((n) => n.kind === "health").length} session
        health issues.
      </span>
      <div className="officeNotices" aria-label="Office attention">
        {notices
          .filter((n) => !dismissed.has(n.id))
          .map((n) => (
            <div className={`officeNotice notice-${n.kind}`} key={n.id}>
              {n.sessionId ? <button onClick={() => focusOfficeSession(n.sessionId!)}>{n.label}</button> : <span>{n.label}</span>}
              <button
                aria-label={`Dismiss notice: ${n.label}`}
                onClick={() =>
                  (dismissedOfficeNotices.value = new Set([...dismissed, n.id]))
                }
              >
                ×
              </button>
            </div>
          ))}
      </div>
      <>
        <div className="officeSummary">
          <span>{runtime.model.counts.working} working</span>
          <span>{runtime.model.counts.needsHuman} need you</span>
          <span>{runtime.model.counts.healthIssues} health</span>
          <span>{runtime.model.counts.failedHandoffs} failed / limited handoffs</span>
        </div>
        {compact && (
          <button
            className="officePreview"
            onClick={() => setShowScene((v) => !v)}
          >
            {showScene ? "Hide 3D office" : "Show 3D office"}
          </button>
        )}
        <div className="officeBody">
          <div
            className={`officeSceneRegion${compact && showScene ? " officeCompactScene" : ""}`}
            aria-label="3D office"
            ref={region}
            data-camera="home"
          >
            {(!compact || showScene) && (
              <>
                <div
                  className="officeCameraControls"
                  aria-label="Camera controls"
                >
                  <label className="officeStyleControl">Office style <select aria-label="Office style" value={style.id} onChange={e=>switchStyle(e.target.value as OfficeStyleId)}>
                    <option value="botanical">Botanical Studio</option><option value="precinct">Nine-Nine Precinct</option>
                  </select></label>
                  <label className="officeCutaway"><input type="checkbox" checked={cutaway} onChange={e=>setCutaway(e.target.checked)}/>Cutaway walls</label>
                  {style.id==='precinct'&&['reverse','plan'].map(id=><button key={id} disabled={cameraReady!==style.id} aria-label={id==='reverse'?'Reverse view':'Plan view'} onClick={()=>{cameraRef.current?.focusView(id);setFocusedRoom(null);}}>{id==='reverse'?'Reverse':'Plan'}</button>)}
                  <button
                    aria-label="Home view"
                    disabled={cameraReady!==style.id}
                    onClick={() => {
                      setFocusedRoom(null);
                      cameraRef.current?.home();
                      if (region.current)
                        region.current.dataset.camera = "home";
                    }}
                  >
                    ⌂ Home
                  </button>
                  {[...style.layout.rooms,...(style.id==="precinct"?[{id:"kitchenette",name:"Kitchenette"}]:[])].map((r) => (
                    <button
                      key={r.id}
                      aria-label={`Focus ${r.name}`}
                      disabled={cameraReady!==style.id}
                      onClick={() => {
                        setFocusedRoom(r.id);
                        cameraRef.current?.focusRoom(r.id);
                        if (region.current)
                          region.current.dataset.camera = r.id;
                      }}
                    >
                      {style.id === "precinct" ? r.name : r.id === "management"
                        ? "Manager"
                        : r.id === "hr"
                          ? "HR"
                          : r.id === "creative"
                            ? "Creative"
                            : r.id === "pantry"
                              ? "Pantry"
                              : r.name.replace(" workspace", "")}
                    </button>
                  ))}
                </div>
                <SceneBoundary
                  key={retry}
                  resetKey={style.id}
                  onRetry={() => setRetry((v) => v + 1)}
                  onFallback={style.id==="precinct"?()=>switchStyle("botanical"):undefined}
                >
                  <Suspense
                    fallback={
                      <p className="officeLoading">
                        Preparing {style.label}…
                      </p>
                    }
                  >
                    <Canvas
                      style={style}
                      cutaway={cutaway}
                      sceneRetry={retry}
                      focusRoom={focusedRoom}
                      onFocusRoom={setFocusedRoom}
                      runtime={runtime}
                      model={runtime.model}
                      theme={theme}
                      reducedMotion={reducedMotion}
                      selection={runtime.selection}
                      cameraRef={cameraRef}
                      onSelect={select}
                      onCameraChange={(pose) => {
                        setCameraReady(runtime.styleId);
                        dispatchOffice({
                          type: "camera",
                          styleId: runtime.styleId,
                          pose,
                        });
                        if (region.current)
                          region.current.dataset.pose = JSON.stringify(pose);
                      }}
                      onTick={(nowMs) =>
                        dispatchOffice({ type: "tick", nowMs })
                      }
                    />
                  </Suspense>
                </SceneBoundary>
                <span className="officeSceneHint">
                  {compact
                    ? "Drag to orbit · Two fingers to pan/pinch · Tap to inspect"
                    : "Drag to orbit · Shift/right-drag to pan · Scroll to zoom · Click to inspect"}
                </span>
              </>
            )}
          </div>
          {details}
        </div>
        <OfficeRoster
          runtime={runtime}
          onSelect={select}
          onReveal={(sessionId) => dispatchOffice({ type: "revealWorker", sessionId, nowMs: Date.now() })}
        />
      </>
    </div>
  );
}
