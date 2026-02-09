# E1. PDF Text Extraction

Decision (Authoritative):
- Use **PyMuPDF** (`pymupdf`, imported as `fitz`) as the sole PDF text extraction library.

Rationale:
- Good text extraction quality for “digital text” PDFs.
- Fast and simple to integrate in an in-process worker.
- Keeps the dependency surface small (single primary extractor).

Notes:
- If a PDF yields empty/near-empty extracted text, the run may fail as `EXTRACTION_FAILED`.
