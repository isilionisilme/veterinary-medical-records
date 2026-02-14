# Golden raw_text fixtures (2-doc mini dataset)

These fixtures are a regression mini dataset built from the only two real source documents currently available in this repository.

## Why minimal excerpts

- Keep fixtures stable and CI-friendly.
- Avoid carrying full raw text payloads in tests.
- Preserve only the patterns needed for extraction heuristics and regressions.

## Fixture coverage

- `docA.txt`
  - Covers chip-like numeric content (`00023035139`) and date-like strings.
  - Includes owner-context mentions (`PROPIETARIA`) and vet-responsible lines.

- `docB.txt`
  - Covers owner name + address adjacency (`BEATRIZ ABARCA` + `C/ ORTEGA...`) used by owner trimming tests.
  - Covers date-like and microchip-like numeric patterns.
  - Includes a `Vet` line for vet-context handling.