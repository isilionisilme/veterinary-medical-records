# UI field parity: owner_name (post-PR97 recheck)

## Scope
- Re-check `owner_name` parity after PR #97 (`run_id` filtering support in debug summary endpoint).
- Verify how run-pinned debug summary behaves against latest review runs.

## Sample set
- Source: `GET /documents?limit=5&offset=0` (latest 5 docs)
- Endpoints used per document:
  - `GET /documents/{document_id}/review`
  - `GET /debug/extraction-runs/{document_id}/summary?limit=20&run_id={run_id}`

## Findings

| document_id | run_id | review `owner_name` | summary status (run_id-pinned) | owner row in summary | Classification |
|---|---|---|---|---|---|
| `d60a5a71-d6da-41ea-997c-d5cc05b6aaf1` | `b05fcb99-896a-4aef-a3e9-95a2f886a31f` | `BEATRIZ ABARCA` | `404 NOT_FOUND` | `N/A` | snapshot-not-persisted-for-run |
| `fb322034-e8eb-4c5b-b235-056bbdc6b7f4` | `6039c07c-08f2-4ef8-ac63-8ee217366624` | `null` | `404 NOT_FOUND` | `N/A` | snapshot-not-persisted-for-run |
| `e05bef44-79d9-4c36-a8f4-490cf6d87473` | `f57ec96e-07d5-41f6-8dd9-afd8b9fd3a2b` | `BEATRIZ ABARCA` | `404 NOT_FOUND` | `N/A` | snapshot-not-persisted-for-run |
| `daeaa6fd-c367-48e5-863b-846c5451dda1` | `b0a3746c-b4d4-430a-a606-a6a927d4a86a` | `BEATRIZ ABARCA` | `404 NOT_FOUND` | `N/A` | snapshot-not-persisted-for-run |
| `043fa0d1-8d39-48fa-89c0-09a300e838cc` | `41a3a82e-2b3f-4b3b-abd2-07930bf1b5e7` | `null` | `404 NOT_FOUND` | `N/A` | snapshot-not-persisted-for-run |

## Conclusion
- PR #97 resolves the endpoint contract gap (`run_id` is now honored when snapshots exist).
- Current 404 outcomes are expected for these runs because no debug extraction snapshots were persisted for those specific `run_id` values.
- Next minimal iteration should persist extraction snapshots for completed runs (or expose a deterministic bridge) so run-pinned parity checks can compare review and debug on the same run.
