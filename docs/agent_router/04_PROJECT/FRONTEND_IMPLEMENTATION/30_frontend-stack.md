# Frontend Stack

The frontend is implemented using:

- **React + TypeScript (Vite)**  
  Chosen to explicitly satisfy the React frontend requirement while keeping setup fast and standard.

- **Tailwind CSS**  
  Used for styling, layout, responsiveness, and dark mode support with minimal custom CSS.

- **Local UI primitives**  
  Prefer lightweight, local components under `/frontend/src/components/ui/*`.
  Do not add a UI component library unless required to satisfy accessibility or interaction requirements,
  and justify any new dependency.

- **TanStack Query**  
  Used for server state management (loading, error, invalidation) without introducing global client state complexity.

- **Lucide React**  
  Lightweight and consistent iconography.

- **Framer Motion (minimal usage)**  
  Used only for subtle transitions (e.g., skeleton → content), never for core logic.

- **PDF.js (`pdfjs-dist`)**  
  Used to render PDFs and support evidence-based review and highlighting.

---
