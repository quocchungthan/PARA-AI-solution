import { signal } from "@preact/signals-react";
import { Network } from "../Network";
import { OfficePanel } from "./OfficePanel";
import "./office.css";
const view = signal<"office" | "graph">("office");
export function OrchestrationPanel() {
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
            aria-pressed={view.value === "office"}
            onClick={() => (view.value = "office")}
          >
            Office
          </button>
          <button
            aria-pressed={view.value === "graph"}
            onClick={() => (view.value = "graph")}
          >
            Graph
          </button>
        </div>
      </div>
      {view.value === "office" ? (
        <OfficePanel />
      ) : (
        <div className="officeGraph">
          <Network />
        </div>
      )}
    </section>
  );
}
