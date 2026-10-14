---
description: Hand off part of the current task to a new or existing session via the bridge.
---

Write a `handoff` in your session file per the `para-session-protocol` skill for: ${input:what:What should be delegated, and to which agent/session?}

Make the prompt self-contained, set `wantResult: true`, set your state to `waiting_input`, then stop and wait for the bridge to feed the result back.
