import type { Vec3, OfficeRole } from "../types";
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
  const frequency = role === "coder" ? 5 : role === "researcher" ? 1.6 : 2.3;
  return {
    head: Math.sin(t * 0.7) * 0.045,
    leftArm: Math.sin(t * frequency) * 0.07,
    rightArm: Math.cos(t * frequency) * 0.08,
  };
}
