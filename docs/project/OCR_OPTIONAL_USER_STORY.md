# Optional User Story — OCR Support (Post-MVP)

## Title
Optional: OCR support for scanned medical records (PDF/Image)

## Objective
When an uploaded document has no usable text layer (scanned PDFs or images), the system can optionally run OCR to extract readable text (Spanish-first), so downstream extraction/review can continue.

## Scope
- Apply OCR only when:
- No text layer exists, or
- Text extraction output fails the usable-text quality gate (`EXTRACTION_LOW_QUALITY`).
- Default OCR language: `es`.
- Future extension: optional language auto-detection.
- Page-level strategy: OCR only pages that fail text extraction/quality checks, not necessarily all pages.
- Must respect configurable timeouts and fail fast on overrun.

## Acceptance Criteria
- Given a scanned PDF/image without usable text layer:
- OCR path can produce readable extracted text for the "Extracted text" tab and downstream processing.
- If OCR is disabled/missing/not configured:
- Processing fails explicitly (`EXTRACTION_FAILED` or `EXTRACTION_LOW_QUALITY`) and document is not marked Ready for review.
- Observability:
- Logs include extractor path and OCR usage (including per-page usage when available).
- Performance:
- OCR has a configurable timeout and returns a clear failure reason when exceeded.
- Tests (post-MVP):
- Fixture-based tests validate OCR path and quality gate behavior.

## Technical Approach (Post-MVP)
- Candidate engines:
- Local: Tesseract (`pytesseract`), EasyOCR.
- Managed/cloud: optional provider integrations behind a port.
- Pipeline integration:
- Keep current fitz-first extraction.
- Run OCR only as secondary path when text-layer extraction is absent/low-quality.
- Reuse the same final quality gate before marking Ready.
- Contract:
- OCR output is treated as Unicode text; PDF font decoding logic must not be applied to OCR output.

## Non-Goals
- Perfect layout reconstruction.
- Full multilingual OCR from day one.
- Handwriting recognition guarantees.
- Exact visual fidelity of tables/forms in initial rollout.
