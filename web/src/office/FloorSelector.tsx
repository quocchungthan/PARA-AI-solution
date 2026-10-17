import { useState } from "react";
import type { OfficeModel } from "./types";
export function FloorSelector({
  model,
  selectedFloorId,
  onSelect,
}: {
  model: OfficeModel;
  selectedFloorId: string | null;
  onSelect: (id: string) => void;
}) {
  const [completed, setCompleted] = useState(false);
  const floors = model.floors.filter(
    (f) => completed || f.active || f.rootId === selectedFloorId,
  );
  return (
    <div className="officeFloors">
      <label>
        Conversation floor
        <select
          aria-label="Conversation floor"
          value={selectedFloorId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
        >
          {floors.map((f) => (
            <option key={f.rootId} value={f.rootId}>
              {f.title} · {f.counts.working} working
              {f.counts.needsHuman ? ` · ${f.counts.needsHuman} need you` : ""}
              {f.counts.healthIssues
                ? ` · ${f.counts.healthIssues} health`
                : ""}
              {f.counts.failedHandoffs?` · ${f.counts.failedHandoffs} handoff issues`:''}
              {!f.active ? " · completed" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="officeCheck">
        <input
          type="checkbox"
          checked={completed}
          onChange={(e) => setCompleted(e.target.checked)}
        />{" "}
        Completed
      </label>
    </div>
  );
}
