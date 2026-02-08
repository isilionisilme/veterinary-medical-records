import { useEffect, useMemo, useState } from "react";
import { Download, FileSearch } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PdfViewer } from "./components/PdfViewer";
import { Button } from "./components/ui/button";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type LoadResult = {
  url: string;
  filename: string | null;
};

type DocumentListItem = {
  document_id: string;
  original_filename: string;
  created_at: string;
  status: string;
  status_label: string;
  failure_type: string | null;
};

type DocumentListResponse = {
  items: DocumentListItem[];
  limit: number;
  offset: number;
  total: number;
};

function parseFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null;
  }
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return match ? match[1] : null;
}

async function fetchOriginalPdf(documentId: string): Promise<LoadResult> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/download`);
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

async function fetchDocuments(): Promise<DocumentListResponse> {
  const response = await fetch(`${API_BASE_URL}/documents?limit=50&offset=0`);
  if (!response.ok) {
    let errorMessage = "No pudimos cargar la lista de documentos.";
    try {
      const payload = await response.json();
      errorMessage = payload.message ?? errorMessage;
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function App() {
  const [documentId, setDocumentId] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const queryClient = useQueryClient();

  const downloadUrl = useMemo(() => {
    if (!activeId) {
      return null;
    }
    return `${API_BASE_URL}/documents/${activeId}/download?download=true`;
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

  const handleSelectDocument = (docId: string) => {
    setDocumentId(docId);
    loadPdf.mutate(docId);
    setIsSidebarOpen(false);
  };

  const documentList = useQuery({
    queryKey: ["documents", "list"],
    queryFn: fetchDocuments,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
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

      <main className="relative mx-auto mt-10 w-full max-w-6xl">
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="ghost"
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-label={isSidebarOpen ? "Cerrar lista de documentos" : "Abrir lista de documentos"}
          >
            <span className="text-lg font-semibold">{isSidebarOpen ? "←" : "≡"}</span>
          </Button>
          <span className="text-sm text-muted">
            {isSidebarOpen ? "Ocultar lista" : "Mostrar lista"}
          </span>
        </div>

        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-10 bg-transparent"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <div className="relative z-20 flex gap-6">
          <aside
            className={`flex-shrink-0 transition-all duration-300 ${
              isSidebarOpen ? "w-80" : "w-0"
            }`}
          >
            <div
              className={`overflow-hidden rounded-3xl border border-black/10 bg-white/80 shadow-xl transition-all ${
                isSidebarOpen ? "opacity-100" : "opacity-0"
              }`}
            >
              <section className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Documentos cargados</h2>
                    <p className="mt-2 text-xs text-muted">
                      Lista informativa con el estado actual de procesamiento.
                    </p>
                  </div>
                  <Button variant="ghost" onClick={handleRefresh} type="button">
                    Actualizar
                  </Button>
                </div>

                {documentList.isLoading && (
                  <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-muted">
                    Cargando documentos...
                  </div>
                )}

                {documentList.isError && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {(documentList.error as Error).message}
                  </div>
                )}

                {documentList.data && (
                  <div className="mt-4 space-y-3">
                    {documentList.data.items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-4 text-sm text-muted">
                        Aun no hay documentos cargados.
                      </div>
                    ) : (
                      documentList.data.items.map((item) => {
                        const isActive = activeId === item.document_id;
                        return (
                          <button
                            key={item.document_id}
                            type="button"
                            onClick={() => handleSelectDocument(item.document_id)}
                            className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                              isActive
                                ? "border-accent bg-accentSoft font-semibold text-ink"
                                : "border-black/10 bg-white/80 text-ink hover:bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm">{item.original_filename}</p>
                                <p className="mt-1 text-xs text-muted">
                                  Subido: {formatTimestamp(item.created_at)}
                                </p>
                              </div>
                              <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-ink">
                                {item.status_label}
                              </span>
                            </div>
                            {item.failure_type && (
                              <p className="mt-2 text-xs text-red-600">
                                Error: {item.failure_type}
                              </p>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </section>
            </div>
          </aside>

          <section className="flex-1 rounded-3xl border border-black/10 bg-white/70 p-6 shadow-xl">
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
                type="button"
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
        </div>
      </main>
    </div>
  );
}
