import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  Background, BackgroundVariant, Controls, Handle, Position, ReactFlow, useNodesState,
  useNodesInitialized, useReactFlow, type Edge, type Node, type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { agentOf, agents, columnOf, openSession, selectedAgent, sessions, type Session } from "./store";
import { STATE_COLOR, colorOf, plural, roleOf, titleOf } from "./util";
import { AgentGlyph } from "./Glyph";

type HubData = { running: number };
type AgentData = { name: string; done: number; running: number; needs: number; open: number };
type SessData = { s: Session };
type HubNode = Node<HubData, "hub">;
type AgentNode = Node<AgentData, "agent">;
type SessNode = Node<SessData, "sess">;
type FlowNode = HubNode | AgentNode | SessNode;

// One centered handle per node gives clean radial spokes in every direction.
const Handles = () => (
  <>
    <Handle type="target" position={Position.Top} className="rfCenter" isConnectable={false} />
    <Handle type="source" position={Position.Top} className="rfCenter" isConnectable={false} />
  </>
);

function HubView({ data }: NodeProps<HubNode>) {
  return (
    <div className="hubNode">
      <Handles />
      <div className="ring" />
      <div><div className="ht">BRIDGE</div><div className="hs">{data.running ? `${data.running} RUNNING` : "IDLE"}</div></div>
    </div>
  );
}

function AgentView({ data }: NodeProps<AgentNode>) {
  return (
    <div className={`agentNode ${data.running ? "" : "idle"}`} style={{ ["--c" as string]: colorOf(data.name) }}>
      <Handles />
      <AgentGlyph name={data.name} />
      <div className="info">
        <div className="nm">{data.name}</div>
        <div className="role">{roleOf(data.name)}</div>
        <div className="mini">
          <span>done <b>{data.done}</b></span>
          <span className="run">run <b>{data.running}</b></span>
          <span className={data.needs ? "w" : ""}>needs <b>{data.needs}</b></span>
        </div>
      </div>
      <span className="sd" title={data.running ? "running" : "idle"} />
    </div>
  );
}

function SessView({ data }: NodeProps<SessNode>) {
  const { s } = data;
  return (
    <div className="sessNode" title={`${titleOf(s)} · ${s.state}`}>
      <Handles />
      <span className="sdot" style={{ background: STATE_COLOR[s.state] ?? "var(--muted)" }} />
      <span className="st">{titleOf(s)}</span>
      <span className="si">{s.sessionId.slice(0, 8)}</span>
    </div>
  );
}

const nodeTypes = { hub: HubView, agent: AgentView, sess: SessView };
const MAX_SESSIONS = 4;
const byNewest = (a: Session, b: Session) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");

function layout(list: [string, Session[]][], all: Session[]) {
  const running = all.filter((s) => s.state === "working").length;
  const nodes: FlowNode[] = [{ id: "hub", type: "hub", position: { x: -75, y: -75 }, data: { running } }];
  const edges: Edge[] = [];
  const n = Math.max(1, list.length);
  const R = Math.max(270, n * 62);
  list.forEach(([name, items], i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const ax = Math.cos(a) * R, ay = Math.sin(a) * R;
    const open = items.filter((s) => s.state !== "done").sort(byNewest);
    const busy = items.filter((s) => s.state === "working").length;
    const id = `agent:${name}`;
    nodes.push({
      id, type: "agent", position: { x: ax - 104, y: ay - 44 },
      data: {
        name, running: busy, open: open.length,
        done: items.filter((s) => s.state === "done").length,
        needs: items.filter((s) => columnOf(s) === "attention").length,
      },
    });
    edges.push({
      id: `e:${name}`, source: "hub", target: id, type: "straight", animated: busy > 0,
      className: busy ? "hot" : "",
    });
    const shown = open.slice(0, MAX_SESSIONS);
    shown.forEach((s, j) => {
      const sa = a + (j - (shown.length - 1) / 2) * (0.5 / Math.max(1, n / 5));
      const sr = R + 250;
      const sid = `sess:${s.sessionId}`;
      nodes.push({ id: sid, type: "sess", position: { x: Math.cos(sa) * sr - 85, y: Math.sin(sa) * sr - 22 }, data: { s } });
      const col = columnOf(s);
      edges.push({
        id: `e:${s.sessionId}`, source: id, target: sid, type: "straight", animated: s.state === "working",
        className: s.state === "working" ? "hot" : col === "attention" ? "warn" : "",
      });
    });
  });
  return { nodes, edges };
}

// Fits once nodes are measured, whenever the set of nodes changes, and when the panel resizes.
function AutoFit({ signature, host }: { signature: string; host: RefObject<HTMLDivElement | null> }) {
  const ready = useNodesInitialized();
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (ready) fitView({ padding: 0.12, duration: 250 });
  }, [ready, signature, fitView]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fitView({ padding: 0.12 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [host, fitView]);
  return null;
}

export function Network() {
  const list = agents.value;
  const all = sessions.value;
  const picked = selectedAgent.value;
  const { nodes: laid, edges } = useMemo(() => layout(list, all), [list, all]);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(laid);
  const dragged = useRef(new Set<string>());
  const shell = useRef<HTMLDivElement>(null);
  const signature = laid.map((n) => n.id).join("|");

  useEffect(() => {
    setNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]));
      return laid.map((n) => {
        const was = old.get(n.id);
        const kept = dragged.current.has(n.id) ? was?.position : undefined;
        const agentName = n.type === "agent" ? n.data.name : n.type === "sess" ? agentOf(n.data.s) : null;
        const dim = !!picked && agentName !== null && agentName !== picked;
        // Keep React Flow's measurements, otherwise nodes stay hidden and edges never render.
        return { ...n, measured: was?.measured, selected: was?.selected, position: kept ?? n.position, className: dim ? "dim" : "" } as FlowNode;
      });
    });
  }, [laid, picked, setNodes]);

  const running = all.filter((s) => s.state === "working").length;
  return (
    <section className="panel flowPanel" aria-labelledby="network-title">
      <div className="panelHead">
        <div>
          <h2 id="network-title">Orchestration network</h2>
          <p className="sub">{plural(list.length, "agent")} · {plural(all.length, "session")} · pan, zoom &amp; drag · click a session to open</p>
        </div>
        <span className={`chip ${running ? "live" : ""}`}><i className="dot" />{running} running</span>
      </div>
      <div className="flowMount" ref={shell}>
        <ReactFlow<FlowNode>
          nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
          fitView fitViewOptions={{ padding: 0.12 }}
          minZoom={0.2} maxZoom={1.6} nodesConnectable={false}
          onNodeDragStop={(_, n) => dragged.current.add(n.id)}
          onNodeClick={(_, n) => {
            if (n.type === "sess") openSession.value = n.data.s.sessionId;
            else if (n.type === "agent") selectedAgent.value = picked === n.data.name ? null : n.data.name;
            else selectedAgent.value = null;
          }}>
          <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="var(--grid-dot)" />
          <Controls showInteractive={false} />
          <AutoFit signature={signature} host={shell} />
        </ReactFlow>
      </div>
    </section>
  );
}
