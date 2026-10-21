---
name: database-migration-safety
description: Assess and validate database schema/data migrations before application; use when a change alters persisted structure or transforms stored data.
---

# Database migration safety

1. Inspect the current schema, migration history, model configuration, and supported database providers.
2. Define the intended schema/data transition and compatibility with old and new application versions.
3. Generate or review the migration; look for destructive operations, locks, table rewrites, data loss, defaults, and provider-specific behavior.
4. Test against an isolated representative database, including upgrade and rollback/recovery where supported.
5. Document prerequisites, expected impact, validation, backups, and recovery steps.
6. Obtain explicit environment-specific authorization before applying to shared or production databases.

Do not run migrations or destructive SQL against a live database merely because this profile or a runbook describes the command.
