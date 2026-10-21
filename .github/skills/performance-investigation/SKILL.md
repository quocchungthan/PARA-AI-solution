---
name: performance-investigation
description: Diagnose latency, throughput, memory, or query regressions with comparable measurements and traceable evidence; use before proposing performance changes.
---

# Performance investigation

1. Confirm the affected environment, user-visible symptom, scope, and safe diagnostic access.
2. Establish a repeatable baseline using representative inputs and record relevant workload and environment conditions.
3. Trace the critical path through browser/client, network, service, storage, and dependencies as relevant. Correlate evidence with request IDs or timestamps where available.
4. Test one hypothesis at a time with read-only diagnostics first. Use profiles, query plans, metrics, or logs rather than guessing.
5. Compare before/after under the same workload. Verify correctness and note environmental differences; local results do not prove production behavior.
6. Report measurements, evidence, likely cause, confidence, and limitations. Recommend state-changing configuration or production actions separately with approval and rollback needs.

Never expose connection strings, credentials, customer records, or sensitive query text. Do not run unapproved production load or modify infrastructure.
