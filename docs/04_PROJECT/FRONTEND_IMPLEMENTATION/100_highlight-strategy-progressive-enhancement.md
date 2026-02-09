# Highlight Strategy (Progressive Enhancement)

Text highlighting inside the PDF is implemented as **progressive enhancement**, never as a dependency for usability.

Implementation approach:
- render the PDF using PDF.js,
- use the text layer to search for the provided snippet on the target page,
- highlight the closest or first matching occurrence.

If matching fails:
- no highlight is shown,
- page navigation and snippet evidence remain visible,
- the UI does not attempt to fake precision.

---
