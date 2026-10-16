export interface Competitor {
  githubUrl: string;
  description: string;
}

export const competitors: Competitor[] = [
  {
    githubUrl: "https://github.com/BloopAI/vibe-kanban",
    description: "Kanban for 10+ agents (Claude Code, Codex, Gemini CLI, Amp, Cursor, OpenCode, Qwen) in isolated git worktrees, with review-first diffs. Local and open-source, with planning and persistence.",
  },
  {
    githubUrl: "https://github.com/cline/kanban",
    description: "One worktree per card, dependency chains that auto-start linked tasks, and inline diff comments fed back to agents. CLI-agnostic, available in the terminal or browser.",
  },
  {
    githubUrl: "https://github.com/smtg-ai/claude-squad",
    description: "Terminal TUI managing many agents via tmux and worktrees. Background sessions, review, commit, and push.",
  },
  {
    githubUrl: "https://github.com/agent-of-empires/agent-of-empires",
    description: "TUI and web UI with mobile access. Supports Claude Code, OpenCode, Codex, Gemini CLI, and Copilot. Related: Talador12/agent-of-agent-of-empires provides an autonomous supervisor.",
  },
  {
    githubUrl: "https://github.com/stravu/crystal",
    description: "Desktop app with parallel worktree sessions and approach comparison (now Nimbalyst). Session management and diffs.",
  },
  {
    githubUrl: "https://github.com/saltbo/agent-kanban",
    description: "Agent-first board with the human out of the loop.",
  },
  {
    githubUrl: "https://github.com/sno-ai/sno-station",
    description: "Agents share encrypted memory, hand off work, and review each other. Supports Codex, Claude Code, Cursor, Hermes, and OpenClaw.",
  },
  {
    githubUrl: "https://github.com/mtarcure/claude-vibe-squad",
    description: "Coordinator routes task packets to 71 role specialists across 5 model families, with behaviour defined in Markdown.",
  },
  {
    githubUrl: "https://github.com/automagik-dev/forge",
    description: "Multi-agent kanban with MCP and isolated attempts.",
  },
  {
    githubUrl: "https://github.com/DanWahlin/ai-agent-board",
    description: "Drag-and-drop kanban delegating to Copilot, Claude, Codex, and OpenCode with streaming progress.",
  },
  {
    githubUrl: "https://github.com/Justmalhar/AgentsBoard",
    description: "Jira/Trello-style board for the agent task lifecycle.",
  },
  {
    githubUrl: "https://github.com/ShreyPaharia/octomux",
    description: "Local dashboard with parallel agents, fleet view, permission inbox, and diff review.",
  },
  {
    githubUrl: "https://github.com/appsoftwareltd/vscode-agent-kanban",
    description: "VS Code kanban for agentic workflows.",
  },
  {
    githubUrl: "https://github.com/abuiles/agents-kanban",
    description: "Cloudflare Workers multi-repo orchestration with React kanban and background runs.",
  },
  {
    githubUrl: "https://github.com/augmentedmike/helloam-agentic-kanban",
    description: "Autonomous agent that ships PRs.",
  },
  {
    githubUrl: "https://github.com/jvogan/a-fable-of-codexes",
    description: "Claude conducts parallel Codex worker fleets in waves.",
  },
];
