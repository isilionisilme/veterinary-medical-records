import { IconButton } from "../app/IconButton";
import { Button } from "../ui/button";
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
const TOAST_CARD_BASE_CLASS = "rounded-card border px-5 py-4";

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
            className={`${TOAST_CARD_BASE_CLASS} border-statusError bg-surface text-text`}
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-flex rounded-control bg-statusError px-2 py-0.5 text-[11px] font-semibold text-white">
                  Error
                </span>
                <p className="text-sm">No se pudo conectar con el servidor.</p>
              </div>
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
            className={`${TOAST_CARD_BASE_CLASS} text-sm ${
              uploadFeedback.kind === "success"
                ? "border-statusSuccess bg-surface text-text"
                : "border-statusError bg-surface text-text"
            }`}
            role="status"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span
                  className={`inline-flex rounded-control px-2 py-0.5 text-[11px] font-semibold text-white ${
                    uploadFeedback.kind === "success" ? "bg-statusSuccess" : "bg-statusError"
                  }`}
                >
                  {uploadFeedback.kind === "success" ? "Éxito" : "Error"}
                </span>
                <span>{uploadFeedback.message}</span>
              </div>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => onOpenUploadedDocument(uploadFeedback.documentId!)}
                >
                  Ver documento
                </Button>
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
            className={`${TOAST_CARD_BASE_CLASS} text-sm ${
              actionFeedback.kind === "success"
                ? "border-statusSuccess bg-surface text-text"
                : actionFeedback.kind === "info"
                  ? "border-borderSubtle bg-surfaceMuted text-text"
                  : "border-statusError bg-surface text-text"
            }`}
            role="status"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span
                  className={`inline-flex rounded-control px-2 py-0.5 text-[11px] font-semibold text-white ${
                    actionFeedback.kind === "success"
                      ? "bg-statusSuccess"
                      : actionFeedback.kind === "info"
                        ? "bg-textSecondary"
                        : "bg-statusError"
                  }`}
                >
                  {actionFeedback.kind === "success"
                    ? "Éxito"
                    : actionFeedback.kind === "info"
                      ? "Info"
                      : "Error"}
                </span>
                <span>{actionFeedback.message}</span>
              </div>
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
