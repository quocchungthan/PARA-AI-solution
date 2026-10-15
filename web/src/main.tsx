import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { connect } from "./store";
import "./styles.css";

// A render error would otherwise unmount everything and leave a blank page.
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="offline">
        <h2>Something broke while rendering</h2>
        <pre>{String(this.state.error.stack ?? this.state.error)}</pre>
        <button className="more" onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}

connect();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </StrictMode>,
);
