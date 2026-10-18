import { Network } from "../Network";
import { OfficePanel } from "./OfficePanel";
import "./office.css";
export type OrchestrationView = "office" | "graph";
export function OrchestrationPanel({ view, onViewChange }: {
  view: OrchestrationView;
  onViewChange: (view: OrchestrationView) => void;
}) {
  return (
    <section className="panel orchestrationPanel" aria-label="Orchestration">
      <div className="officeHeading">
        <div>
          <h2>Agent office</h2>
          <p>
            Botanical Studio <span>· Live observation</span>
          </p>
        </div>
        <div className="officeView" aria-label="Orchestration view">
          <button
            aria-pressed={view === "office"}
            onClick={() => onViewChange("office")}
          >
            Office
          </button>
          <button
            aria-pressed={view === "graph"}
            onClick={() => onViewChange("graph")}
          >
            Graph
          </button>
        </div>
      </div>
      {view === "office" ? (
        <OfficePanel />
      ) : (
        <div className="officeGraph">
          <Network />
        </div>
      )}
    </section>
  );
}
