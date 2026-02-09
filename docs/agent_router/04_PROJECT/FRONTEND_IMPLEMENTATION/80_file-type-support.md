# File-Type Support

End-to-end review is implemented for PDFs.

Frontend implications:
- Preview behavior is implemented for PDFs via PDF.js (continuous scroll).
- Download behavior must work for PDFs via `GET /documents/{id}/download`.
