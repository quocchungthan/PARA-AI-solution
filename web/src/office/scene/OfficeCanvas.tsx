import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { Group } from "three";
import type {
  OfficeFloor,
  FloorRuntime,
  OfficeModel,
  OfficeSelection,
  OfficeCameraHandle,
  CameraPose,
  Vec3,
} from "../types";
import { OFFICE_LAYOUT } from "../layout";
import { OfficeScene } from "./OfficeScene";
import { OfficeCamera } from "./OfficeCamera";
import { Actors, describeActors } from "./Actors";
import { Labels, type LabelAnchor } from "./Labels";
import { Handoffs } from "./Handoffs";
import { SceneMetrics } from "./resources";
export type OfficeCanvasProps = {
  floor: OfficeFloor;
  floorRuntime: FloorRuntime;
  model: OfficeModel;
  theme: "light" | "dark";
  reducedMotion: boolean;
  selection: OfficeSelection;
  cameraRef: RefObject<OfficeCameraHandle | null>;
  onSelect: (s: OfficeSelection) => void;
  onCameraChange: (pose: CameraPose) => void;
  onTick: (nowMs: number) => void;
};
const sameSelection = (a: OfficeSelection, b: OfficeSelection) =>
  JSON.stringify(a) === JSON.stringify(b);
export default function OfficeCanvas(props: OfficeCanvasProps) {
  const container = useRef<HTMLDivElement>(null),
    registry = useRef(new Map<string, Group>()),
    elements = useRef(new Map<string, HTMLButtonElement>()),
    down = useRef<[number, number]>([0, 0]);
  const [lost, setLost] = useState(false),
    [generation, setGeneration] = useState(0);
  const actors = describeActors(props);
  const anchors: LabelAnchor[] = [
    ...actors.map((a) => ({ id: a.id, actorId: a.id, position: a.position })),
    ...OFFICE_LAYOUT.rooms.map((r) => ({
      id: `room-${r.id}`,
      roomId: r.id,
      position: [
        r.x + r.width / 2,
        3.8,
        r.id === "team" ? -0.9 : r.id === "pantry" ? 2 : r.z + 0.6,
      ] as Vec3,
    })),
  ];
  useEffect(() => {
    const element = container.current;
    const lose = (e: Event) => {
      e.preventDefault();
      setLost(true);
    };
    element?.addEventListener("webglcontextlost", lose, true);
    return () => element?.removeEventListener("webglcontextlost", lose, true);
  }, []);
  useEffect(() => {
    const interval = setInterval(() => props.onTick(Date.now()), 200);
    return () => clearInterval(interval);
  }, [props.onTick]);
  return (
    <div ref={container} className="officeCanvas">
      {lost ? (
        <div className="officeFallback" role="status">
          <strong>3D office unavailable</strong>
          <p>
            The graphics context was lost. Your floor and session details are
            preserved.
          </p>
          <button
            onClick={() => {
              setLost(false);
              setGeneration((n) => n + 1);
            }}
          >
            Retry 3D office
          </button>
        </div>
      ) : (
        <>
          <Canvas
            key={`${props.floor.rootId}:${generation}`}
            orthographic
            camera={{ position: [-26, 28, 40], near: 0.1, far: 180, zoom: 15 }}
            // Supersample standard displays; cap high-density screens at 2x.
            dpr={[1.5, 2]}
            shadows
            gl={{ antialias: true, alpha: false }}
            fallback={
              <p>3D office unavailable. Use the session list or Graph.</p>
            }
            onCreated={({ gl }) =>
              gl.domElement.setAttribute(
                "aria-label",
                "Botanical Studio office scene",
              )
            }
          >
            <OfficeCamera
              layout={OFFICE_LAYOUT}
              pose={props.floorRuntime.camera}
              onChange={props.onCameraChange}
              controllerRef={props.cameraRef}
              reducedMotion={props.reducedMotion}
            />
            <OfficeScene layout={OFFICE_LAYOUT} theme={props.theme}>
              <Actors
                actors={actors}
                registry={registry}
                onSelect={props.onSelect}
                props={props}
              />
              <Handoffs
                events={props.floorRuntime.queue}
                anchors={registry}
                rootId={props.floor.rootId}
                reducedMotion={props.reducedMotion}
                budget={Math.max(
                  0,
                  2 -
                    props.floorRuntime.workers.filter(
                      (w) => w.phase === "entering" || w.phase === "leaving",
                    ).length,
                )}
              />
            </OfficeScene>
            <Labels anchors={anchors} registry={registry} elements={elements} />
            <SceneMetrics />
          </Canvas>
          <div className="officeSignals" aria-hidden="true">
            {props.floorRuntime.queue
              .filter((e) => e.startedAt !== undefined)
              .slice(0, 2)
              .map((e) => (
                <span key={e.id} data-event-kind={e.kind}>
                  {e.kind === "arrive"
                    ? "Arrival"
                    : e.kind === "report"
                      ? "Report"
                      : "Handoff"}{" "}
                  ·{" "}
                  {props.model.sessionsById.get(e.sessionId)?.title ||
                    props.model.sessionsById
                      .get(e.sessionId)
                      ?.task?.slice(0, 30) ||
                    e.sessionId.slice(0, 8)}
                </span>
              ))}
          </div>
          <div className="officeLabels">
            {actors.map((a) => (
              <button
                key={a.id}
                ref={(el) => {
                  if (el) elements.current.set(a.id, el);
                  else elements.current.delete(a.id);
                }}
                className={`officeActorLabel ${sameSelection(a.selection, props.selection) ? "selected" : ""} status-${a.status}`}
                data-kind={a.kind}
                data-identity={a.identitySeed}
                data-status={a.status}
                data-phase={a.worker?.phase ?? "persistent"}
                data-phase-start={a.worker?.phaseStartedAt}
                data-motion={props.reducedMotion ? "reduced" : "full"}
                data-rest={a.rest}
                aria-label={`Inspect ${a.label}`}
                title={`${a.label} · ${a.status}${a.health ? " · health issue" : ""}`}
                onPointerDown={(e) => {
                  down.current = [e.clientX, e.clientY];
                }}
                onClick={(e) => {
                  if (
                    e.detail === 0 ||
                    Math.hypot(
                      e.clientX - down.current[0],
                      e.clientY - down.current[1],
                    ) <= 4
                  )
                    props.onSelect(a.selection);
                }}
              >
                <i aria-hidden="true">
                  {a.status === "needs-human"
                    ? "!"
                    : a.health
                      ? "?"
                      : a.status === "blocked"
                        ? "×"
                        : a.status === "waiting"
                          ? "Ⅱ"
                          : a.status === "done"
                            ? "✓"
                            : "·"}
                </i>
                <span>
                  {a.label}
                  <small>
                    {a.status}
                    {a.health ? " · health issue" : ""}
                  </small>
                </span>
              </button>
            ))}
            {OFFICE_LAYOUT.rooms.map((r) => (
              <button
                key={r.id}
                className="officeRoomLabel"
                ref={(el) => {
                  if (el) elements.current.set(`room-${r.id}`, el);
                  else elements.current.delete(`room-${r.id}`);
                }}
                aria-label={`Room ${r.name}`}
                onClick={() => props.cameraRef.current?.focusRoom(r.id)}
              >
                {r.id === "management"
                  ? "MANAGER + ASSISTANT"
                  : r.id === "team"
                    ? "TEAM"
                    : r.id === "hr"
                      ? "HR"
                      : r.name.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
