import type { Vec3, OfficeRole } from "../types";
export function idleAnimationWindow(elapsedMs:number,seed:number) {
  const quiet=20000+(seed>>>0)%20001,period=quiet+4000,phase=Math.max(0,elapsedMs)%period;
  return {active:phase>=quiet,wakeInMs:phase<quiet?quiet-phase:period-phase};
}
export function samplePath(
  points: readonly Vec3[],
  elapsedMs: number,
  unitsPerSecond: number,
  reducedMotion = false,
): { position: Vec3; heading: number; done: boolean } {
  const fallback: Vec3 = [0, 0, 0];
  if (points.length < 2 || reducedMotion)
    return { position: points.at(-1) ?? fallback, heading: 0, done: true };
  let remaining = (Math.max(0, elapsedMs) / 1000) * Math.max(0, unitsPerSecond),
    heading = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (length < 0.0001) continue;
    heading = Math.atan2(b[0] - a[0], b[2] - a[2]);
    if (remaining < length) {
      const t = remaining / length;
      return {
        position: [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
          a[2] + (b[2] - a[2]) * t,
        ],
        heading,
        done: false,
      };
    }
    remaining -= length;
  }
  return { position: points.at(-1)!, heading, done: true };
}
export function sampleWorkPose(role: OfficeRole, elapsedMs: number) {
  const t = elapsedMs / 1000;
  const frequency = role === "coder" ? 12 : role === "researcher" ? 7 : 9;
  return {
    head: Math.sin(t * 0.7) * 0.07,
    leftArm: -0.12 + Math.sin(t * frequency) * 0.19,
    rightArm: -0.12 + Math.cos(t * frequency) * 0.19,
  };
}
type CharacterMotion = {
  activity: string;
  seed?: number;
  rest?: boolean;
  walking?: boolean;
  human?: boolean;
  reducedMotion?: boolean;
};
type CharacterPose = {
  action: "still" | "walk" | "typing" | "look-around" | "sip" | "stretch";
  head: number;
  leftArm: number;
  rightArm: number;
  leftLeg: number;
  rightLeg: number;
  breath: number;
};
// A smooth lift and release, with quiet time between gestures.
const gesture = (phase: number, start: number, duration: number) =>
  phase <= start || phase >= start + duration
    ? 0
    : Math.sin(((phase - start) / duration) * Math.PI) ** 2;
export function sampleCharacterPose(
  role: OfficeRole,
  elapsedMs: number,
  options: CharacterMotion,
): CharacterPose {
  const p: CharacterPose = {
    action: "still", head: 0, leftArm: 0, rightArm: 0,
    leftLeg: 0, rightLeg: 0, breath: 0,
  };
  if (options.human || options.reducedMotion) return p;
  const seed = options.seed ?? 0;
  const t = Math.max(0, elapsedMs) / 1000 + (seed % 13000) / 1000;
  p.breath = Math.sin(t * 1.8) * 0.025;
  if (options.walking) {
    const step = Math.sin(t * 7);
    return {
      ...p, action: "walk", breath: Math.abs(step) * 0.045,
      leftArm: step * 0.4, rightArm: -step * 0.4,
      leftLeg: -step * 0.38, rightLeg: step * 0.38,
    };
  }
  if (options.activity === "working") {
    const phase = t % 6;
    const typing = Math.min(1, phase / 0.3, Math.max(0, (4.8 - phase) / 0.3));
    const work = sampleWorkPose(role, t * 1000);
    return {
      ...p, action: typing > 0 ? "typing" : "look-around",
      head: work.head + (1 - typing) * Math.sin(t * 0.8) * 0.18,
      leftArm: work.leftArm * typing, rightArm: work.rightArm * typing,
    };
  }
  const phase = t % (16 + (seed % 5));
  const sip = options.rest ? gesture(phase, 1.5, 4) : 0;
  // Attention states keep the small look-around gesture, without a relaxed stretch.
  const stretch = ["idle", "waiting", "done"].includes(options.activity)
    ? gesture(phase, 10, 3.5)
    : 0;
  return {
    ...p,
    action: sip > 0 ? "sip" : stretch > 0 ? "stretch" : "look-around",
    head: Math.sin(t * 0.6) * 0.22 * (1 - sip),
    leftArm: -stretch * 1.05,
    rightArm: (options.rest ? -0.12 : 0) - sip * 1.25 - stretch * 0.8,
  };
}
