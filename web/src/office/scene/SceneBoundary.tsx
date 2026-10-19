import { Component, type ReactNode } from "react";
export class SceneBoundary extends Component<
  { children: ReactNode; onRetry: () => void; onFallback?: () => void; resetKey?: string },
  { failed: boolean; resetKey?: string }
> {
  state = { failed: false, resetKey:this.props.resetKey };
  static getDerivedStateFromProps(props:{resetKey?:string},state:{resetKey?:string}) {
    return props.resetKey!==state.resetKey?{failed:false,resetKey:props.resetKey}:null;
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="officeFallback" role="status">
        <strong>3D office unavailable</strong>
        <p>Session summaries and Graph remain available.</p>
        <button onClick={this.props.onRetry}>Retry 3D office</button>
        {this.props.onFallback && <button onClick={this.props.onFallback}>Use Botanical Studio</button>}
      </div>
    ) : (
      this.props.children
    );
  }
}
