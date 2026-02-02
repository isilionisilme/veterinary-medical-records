# veterinary-medical-records
This system allows vets to upload docs with a pet's medical record, extracts and analyzes its content and identifies and structure the most relevant info in a standardized way.

## Maintainability Approach (layered, minimal)

This take-home optimizes for maintainability by keeping responsibilities separated, enforcing a strict dependency direction, and enabling unit-first testing. FastAPI routes are intentionally thin (HTTP validation only): workflow logic lives in application services, and SQL/persistence details live only in the infrastructure layer.

### Layers
- `backend/app/domain/`: pure domain types and rules (stdlib-only)
- `backend/app/application/`: use-cases/workflows (depends on `domain` + `ports` only)
- `backend/app/ports/`: minimal interfaces (Protocols) required by the application (e.g., `DocumentRepository`)
- `backend/app/infra/`: concrete implementations (SQLite, filesystem, external libs)
- `backend/app/api/`: HTTP layer only (routes + Pydantic request/response schemas)

### Dependency / import rules
- `domain` → stdlib only
- `application` → `domain` + `ports` only
- `api` → `application` + `api.schemas` only
- `infra` → implements ports; may depend on DB/fs/third-party libs; no business rules

### Testing strategy (unit-first)
- Unit tests: `backend/tests/unit/` (no FastAPI, no sqlite; use fakes/in-memory ports)
- Integration tests: `backend/tests/integration/` (FastAPI TestClient + temporary SQLite)

Run tests with:
`pytest`

## Development workflow

### Install tooling
Install development dependencies before editing any code:
```
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
```

### Git hooks and checks
Install the Git hook once after cloning:
```
pre-commit install
```
You can run the full suite locally with:
```
pre-commit run --all-files
```

### Linting and tests
Run Ruff and the test suite with:
```
ruff check .
pytest
```

### Continuous integration
GitHub Actions runs the same checks (`ruff check .` and `pytest`) on every push and pull request to `main`. The workflow is defined in `.github/workflows/ci.yml` and installs `requirements-dev.txt` before execution.

## API endpoints (current slice)
- `GET /health`
- `POST /documents/upload` (validates file, stores it on disk, persists metadata)
- `GET /documents/{document_id}` (returns metadata + current lifecycle state)
- `GET /documents/{document_id}/download` (downloads the stored file bytes)

## Configuration
- `VET_RECORDS_DB_PATH`: override SQLite file path (defaults to `backend/app/data/documents.db`).
- `VET_RECORDS_STORAGE_DIR`: override uploads directory (defaults to `backend/app/data/uploads/`).
