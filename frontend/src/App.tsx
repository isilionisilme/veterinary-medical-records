import { useEffect, useMemo, useState } from "react";
import { Download, FileSearch } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { PdfViewer } from "./components/PdfViewer";
import { Button } from "./components/ui/button";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type LoadResult = {
  url: string;
  filename: string | null;
};

function parseFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null;
  }
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return match ? match[1] : null;
}

async function fetchOriginalPdf(documentId: string): Promise<LoadResult> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/original`);
  if (!response.ok) {
    let errorMessage = "No pudimos cargar el documento.";
    try {
      const payload = await response.json();
      errorMessage = payload.message ?? errorMessage;
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new Error(errorMessage);
  }
  const blob = await response.blob();
  const filename = parseFilename(response.headers.get("content-disposition"));
  return { url: URL.createObjectURL(blob), filename };
}

export function App() {
  const [documentId, setDocumentId] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const downloadUrl = useMemo(() => {
    if (!activeId) {
      return null;
    }
    return `${API_BASE_URL}/documents/${activeId}/original?download=true`;
  }, [activeId]);

  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  const loadPdf = useMutation({
    mutationFn: async (docId: string) => fetchOriginalPdf(docId),
    onSuccess: (result, docId) => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      setActiveId(docId);
      setFileUrl(result.url);
      setFilename(result.filename);
    },
    onError: () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      setActiveId(null);
      setFileUrl(null);
      setFilename(null);
    },
  });

  const handleSubmit = () => {
    const trimmed = documentId.trim();
    if (!trimmed) {
      return;
    }
    loadPdf.mutate(trimmed);
  };

  return (
    <div className="min-h-screen px-6 py-10">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <p className="text-sm uppercase tracking-[0.3em] text-muted">
          Vista rapida de documentos
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-4xl font-semibold text-ink">
              Revision del documento original
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Accede al PDF cargado sin depender del procesamiento. La vista previa
              es inmediata y se mantiene disponible incluso si el analisis esta en curso.
            </p>
          </div>
          {downloadUrl && (
            <a href={downloadUrl} className="self-start" target="_blank" rel="noreferrer">
              <Button>
                <Download size={16} />
                Descargar
              </Button>
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto mt-10 grid w-full max-w-6xl gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-sm font-semibold text-ink">ID del documento</label>
              <input
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm outline-none focus:border-accent"
                placeholder="Ejemplo: 9efc8f7b-0a1f-4c6b-8e9b-1f1a3a"
                value={documentId}
                onChange={(event) => setDocumentId(event.target.value)}
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={loadPdf.isPending || !documentId.trim()}
            >
              <FileSearch size={16} />
              {loadPdf.isPending ? "Cargando" : "Abrir"}
            </Button>
          </div>
          {loadPdf.isError && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {(loadPdf.error as Error).message}
            </div>
          )}
          <div className="mt-6 h-[65vh]">
            <PdfViewer fileUrl={fileUrl} filename={filename} />
          </div>
        </section>

        <aside className="rounded-3xl border border-black/10 bg-white/60 p-6 shadow-xl">
          <h2 className="font-display text-xl font-semibold">Panel de contexto</h2>
          <p className="mt-3 text-sm text-muted">
            Este panel esta listo para mostrar los datos estructurados cuando la
            interpretacion automatica este disponible. La vista previa del PDF
            funciona de manera independiente del estado del procesamiento.
          </p>
          <div className="mt-6 rounded-2xl border border-dashed border-black/10 bg-white/70 p-4 text-sm text-muted">
            Proximamente: datos estructurados, evidencias por pagina y niveles de
            confianza.
          </div>
        </aside>
      </main>
    </div>
  );
}
