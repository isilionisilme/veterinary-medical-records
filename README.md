# veterinary-medical-records
This system allows vets to upload docs with a pet's medical record, extracts and analyzes its content and identifies and structure the most relevant info in a standardized way.

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
