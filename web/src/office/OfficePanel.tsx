import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  officeRuntime,
  dispatchOffice,
  focusOfficeSession,
  dismissedOfficeNotices,
} from "./state";
import { OfficeRoster } from "./OfficeRoster";
import { FloorSelector } from "./FloorSelector";
import { OfficeDetails } from "./OfficeDetails";
import { openSession, dark } from "../store";
import { deriveOfficeNotices, sessionTitle } from "./model";
import { SceneBoundary } from "./scene/SceneBoundary";
import { OFFICE_LAYOUT } from "./layout";
import type { OfficeCameraHandle, OfficeSelection } from "./types";
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
  const cameraRef = useRef<OfficeCameraHandle | null>(null);
  const region = useRef<HTMLDivElement>(null);
  const Canvas = useMemo(
    () => lazy(() => import("./scene/OfficeCanvas")),
    [retry],
  );
  if (!runtime) return <p>Waiting for the Bridge snapshot…</p>;
  const floor = runtime.model.floors.find(
    (f) => f.rootId === runtime.selectedFloorId,
  );
  const select = (selection: OfficeSelection) =>
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
  const notices = deriveOfficeNotices(runtime.model);
  const dismissed = dismissedOfficeNotices.value;
  return (
    <div className="officePanel">
      <FloorSelector
        model={runtime.model}
        selectedFloorId={runtime.selectedFloorId}
        onSelect={(floorId) => dispatchOffice({ type: "selectFloor", floorId })}
      />
      {runtime.notice && <p role="status">{runtime.notice}</p>}
      <span className="officeSrOnly" aria-live="polite">
        {notices.filter((n) => n.kind === "human").length} requests for human
        input; {notices.filter((n) => n.kind === "health").length} session
        health issues.
      </span>
      <div className="officeNotices" aria-label="Floor attention">
        {notices
          .filter((n) => !dismissed.has(n.id))
          .map((n) => (
            <div className={`officeNotice notice-${n.kind}`} key={n.id}>
              <button
                onClick={() => focusOfficeSession(n.floorId, n.sessionId)}
              >
                {n.label}
              </button>
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
      {floor ? (
        <>
          <div className="officeSummary">
            <span>{floor.counts.working} working</span>
            <span>{floor.counts.needsHuman} need you</span>
            <span>{floor.counts.healthIssues} health</span>
            <span>{floor.counts.failedHandoffs} failed / limited handoffs</span>
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
              className="officeSceneRegion"
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
                    <button
                      aria-label="Home view"
                      onClick={() => {
                        cameraRef.current?.home();
                        if (region.current)
                          region.current.dataset.camera = "home";
                      }}
                    >
                      ⌂ Home
                    </button>
                    {OFFICE_LAYOUT.rooms.map((r) => (
                      <button
                        key={r.id}
                        aria-label={`Focus ${r.name}`}
                        onClick={() => {
                          cameraRef.current?.focusRoom(r.id);
                          if (region.current)
                            region.current.dataset.camera = r.id;
                        }}
                      >
                        {r.id === "management"
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
                    onRetry={() => setRetry((v) => v + 1)}
                  >
                    <Suspense
                      fallback={
                        <p className="officeLoading">
                          Preparing Botanical Studio…
                        </p>
                      }
                    >
                      <Canvas
                        floor={floor}
                        floorRuntime={runtime.floors.get(floor.rootId)!}
                        model={runtime.model}
                        theme={theme}
                        reducedMotion={reducedMotion}
                        selection={runtime.selection}
                        cameraRef={cameraRef}
                        onSelect={select}
                        onCameraChange={(pose) => {
                          dispatchOffice({
                            type: "camera",
                            floorId: floor.rootId,
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
                    Drag to pan · Scroll to zoom · Click to inspect
                  </span>
                </>
              )}
            </div>
            {details}
          </div>
          <OfficeRoster
            runtime={runtime}
            onSelect={select}
            onReveal={(floorId, sessionId) =>
              dispatchOffice({ type: "revealWorker", floorId, sessionId })
            }
          />
        </>
      ) : (
        <div className="officeEmpty">
          <h3>No conversation floor yet</h3>
          <p>
            A registered main coordinator session creates a floor. Delegations
            connect its team.
          </p>
        </div>
      )}
      {runtime.model.ungrouped.length > 0 && (
        <details className="officeUngrouped">
          <summary>
            Ungrouped sessions · {runtime.model.ungrouped.length}
          </summary>
          {runtime.model.ungrouped.map((u) => (
            <div key={u.sessionId}>
              <button
                onClick={() =>
                  select({
                    kind: "session",
                    floorId: runtime.selectedFloorId ?? "",
                    sessionId: u.sessionId,
                  })
                }
              >
                {sessionTitle(runtime.model.sessionsById.get(u.sessionId)!)}
              </button>
              <small>{u.reason}</small>
            </div>
          ))}
        </details>
      )}
      {!floor && details}
    </div>
  );
}
