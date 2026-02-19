import { IconButton } from "../app/IconButton";
import type { ActionFeedback, ConnectivityToast, UploadFeedback } from "./toast-types";

type ToastHostProps = {
  connectivityToast: ConnectivityToast | null;
  uploadFeedback: UploadFeedback | null;
  actionFeedback: ActionFeedback | null;
  onCloseConnectivityToast: () => void;
  onCloseUploadFeedback: () => void;
  onCloseActionFeedback: () => void;
  onOpenUploadedDocument: (documentId: string) => void;
};

const TOAST_CONTAINER_BASE_CLASS =
  "fixed left-1/2 z-[60] w-full max-w-lg -translate-x-1/2 px-4 sm:w-[32rem]";

function getUploadToastTopClass(hasConnectivityToast: boolean): string {
  return hasConnectivityToast ? "top-28" : "top-10";
}

function getActionToastTopClass(hasConnectivityToast: boolean): string {
  return hasConnectivityToast ? "top-44" : "top-28";
}

export function ToastHost({
  connectivityToast,
  uploadFeedback,
  actionFeedback,
  onCloseConnectivityToast,
  onCloseUploadFeedback,
  onCloseActionFeedback,
  onOpenUploadedDocument,
}: ToastHostProps) {
  return (
    <>
      {connectivityToast && (
        <div className="fixed left-1/2 top-10 z-[65] w-full max-w-lg -translate-x-1/2 px-4 sm:w-[32rem]">
          <div
            className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-red-700"
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm">No se pudo conectar con el servidor.</p>
              <IconButton
                label="Cerrar aviso de conexión"
                onClick={onCloseConnectivityToast}
                className="text-lg font-semibold leading-none"
              >
                &times;
              </IconButton>
            </div>
          </div>
        </div>
      )}
      {uploadFeedback && (
        <div
          className={`${TOAST_CONTAINER_BASE_CLASS} ${getUploadToastTopClass(Boolean(connectivityToast))}`}
        >
          <div
            className={`rounded-2xl border px-5 py-4 text-base ${
              uploadFeedback.kind === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-red-300 bg-red-50 text-red-700"
            }`}
            role="status"
          >
            <div className="flex items-center justify-between gap-3">
              <span>{uploadFeedback.message}</span>
              <IconButton
                label="Cerrar notificacion"
                onClick={onCloseUploadFeedback}
                className="text-lg font-semibold leading-none text-ink"
              >
                &times;
              </IconButton>
            </div>
            {uploadFeedback.kind === "success" &&
              uploadFeedback.documentId &&
              uploadFeedback.showOpenAction && (
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-ink underline"
                  onClick={() => onOpenUploadedDocument(uploadFeedback.documentId!)}
                >
                  Ver documento
                </button>
              )}
            {uploadFeedback.kind === "error" && (
              <div className="mt-2 flex items-center gap-3">
                {uploadFeedback.technicalDetails && (
                  <details className="text-xs text-muted">
                    <summary className="cursor-pointer">Ver detalles tecnicos</summary>
                    <p className="mt-1">{uploadFeedback.technicalDetails}</p>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {actionFeedback && (
        <div
          className={`${TOAST_CONTAINER_BASE_CLASS} ${getActionToastTopClass(Boolean(connectivityToast))}`}
        >
          <div
            className={`rounded-2xl border px-5 py-4 text-base ${
              actionFeedback.kind === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : actionFeedback.kind === "info"
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-red-300 bg-red-50 text-red-700"
            }`}
            role="status"
          >
            <div className="flex items-center justify-between gap-3">
              <span>{actionFeedback.message}</span>
              <IconButton
                label="Cerrar notificacion de accion"
                onClick={onCloseActionFeedback}
                className="text-lg font-semibold leading-none text-ink"
              >
                &times;
              </IconButton>
            </div>
            {actionFeedback.kind === "error" && actionFeedback.technicalDetails && (
              <div className="mt-2 flex items-center gap-3">
                <details className="text-xs text-muted">
                  <summary className="cursor-pointer">Ver detalles tecnicos</summary>
                  <p className="mt-1">{actionFeedback.technicalDetails}</p>
                </details>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
