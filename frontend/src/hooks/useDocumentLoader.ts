import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { fetchOriginalPdf } from "../api/documentApi";
import { type UploadFeedback } from "../components/toast/toast-types";

type UseDocumentLoaderParams = {
  onUploadFeedback: Dispatch<SetStateAction<UploadFeedback | null>>;
};

export function useDocumentLoader({ onUploadFeedback }: UseDocumentLoaderParams) {
  const [fileUrl, setFileUrl] = useState<string | ArrayBuffer | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const latestLoadRequestIdRef = useRef<string | null>(null);
  const pendingAutoOpenDocumentIdRef = useRef<string | null>(null);
  const autoOpenRetryCountRef = useRef<Record<string, number>>({});
  const autoOpenRetryTimerRef = useRef<number | null>(null);

  const loadPdf = useMutation({
    mutationFn: async (docId: string) => fetchOriginalPdf(docId),
    onSuccess: (result, docId) => {
      if (latestLoadRequestIdRef.current !== docId) {
        return;
      }
      if (pendingAutoOpenDocumentIdRef.current === docId) {
        pendingAutoOpenDocumentIdRef.current = null;
        delete autoOpenRetryCountRef.current[docId];
        if (autoOpenRetryTimerRef.current) {
          window.clearTimeout(autoOpenRetryTimerRef.current);
          autoOpenRetryTimerRef.current = null;
        }
        onUploadFeedback((current) => {
          if (current?.kind !== "success" || current.documentId !== docId) {
            return current;
          }
          return { ...current, showOpenAction: false };
        });
      }
      setFileUrl(result.data);
      setFilename(result.filename);
    },
    onError: (_, docId) => {
      if (latestLoadRequestIdRef.current !== docId) {
        return;
      }
      if (pendingAutoOpenDocumentIdRef.current === docId) {
        const retries = autoOpenRetryCountRef.current[docId] ?? 0;
        if (retries < 1) {
          autoOpenRetryCountRef.current[docId] = retries + 1;
          autoOpenRetryTimerRef.current = window.setTimeout(() => {
            latestLoadRequestIdRef.current = docId;
            requestPdfLoad(docId);
          }, 1000);
          return;
        }
        pendingAutoOpenDocumentIdRef.current = null;
        delete autoOpenRetryCountRef.current[docId];
        onUploadFeedback({
          kind: "success",
          message: "Documento subido correctamente.",
          documentId: docId,
          showOpenAction: true,
        });
      }
    },
  });

  const requestPdfLoad = (docId: string) => {
    latestLoadRequestIdRef.current = docId;
    loadPdf.mutate(docId);
  };

  useEffect(() => {
    return () => {
      if (autoOpenRetryTimerRef.current) {
        window.clearTimeout(autoOpenRetryTimerRef.current);
      }
    };
  }, []);

  return {
    fileUrl,
    filename,
    setFileUrl,
    setFilename,
    requestPdfLoad,
    loadPdf,
    pendingAutoOpenDocumentIdRef,
  };
}
