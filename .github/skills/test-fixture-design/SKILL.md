---
name: test-fixture-design
description: Create representative, deterministic test data and mocks; use when tests need realistic edge cases without depending on production data or unstable services.
---

# Test fixture design

- Derive fixture shape from current contracts, schemas, and observed requirements; do not fabricate product behavior.
- Cover normal flows, boundaries, missing/invalid values, duplicates, and relevant lifecycle states.
- Prefer small named builders or fixtures over opaque giant payloads. Keep data deterministic and isolated between tests.
- Mock external boundaries at the narrowest appropriate seam; retain integration tests for behavior a mock cannot prove.
- Use synthetic or anonymized data. Never commit production identifiers, customer content, secrets, or copied database dumps.
- Verify setup and cleanup, and report which behavior the fixture represents.
