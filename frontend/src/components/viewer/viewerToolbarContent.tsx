import { AlignLeft, Download, FileText, Info } from "lucide-react";

import { IconButton } from "../app/IconButton";

type ViewerTab = "document" | "raw_text" | "technical";

type BuildViewerToolbarContentParams = {
  activeViewerTab: ViewerTab;
  onChangeTab: (tab: ViewerTab) => void;
  downloadUrl: string | null;
};

export function buildViewerToolbarContent({
  activeViewerTab,
  onChangeTab,
  downloadUrl,
}: BuildViewerToolbarContentParams) {
  const toolbarLeftContent = (
    <>
      <IconButton
        label="Documento"
        tooltip="Documento"
        pressed={activeViewerTab === "document"}
        className={
          activeViewerTab === "document"
            ? "border-accent bg-accentSoft/35 text-accent ring-2 ring-accent/25"
            : undefined
        }
        aria-current={activeViewerTab === "document" ? "page" : undefined}
        onClick={() => onChangeTab("document")}
      >
        <FileText size={16} aria-hidden="true" />
      </IconButton>
      <IconButton
        label="Texto extraído"
        tooltip="Texto extraído"
        pressed={activeViewerTab === "raw_text"}
        className={
          activeViewerTab === "raw_text"
            ? "border-accent bg-accentSoft/35 text-accent ring-2 ring-accent/25"
            : undefined
        }
        aria-current={activeViewerTab === "raw_text" ? "page" : undefined}
        onClick={() => onChangeTab("raw_text")}
      >
        <AlignLeft size={16} aria-hidden="true" />
      </IconButton>
      <IconButton
        label="Detalles técnicos"
        tooltip="Detalles técnicos"
        pressed={activeViewerTab === "technical"}
        className={
          activeViewerTab === "technical"
            ? "border-accent bg-accentSoft/35 text-accent ring-2 ring-accent/25"
            : undefined
        }
        aria-current={activeViewerTab === "technical" ? "page" : undefined}
        onClick={() => onChangeTab("technical")}
      >
        <Info size={16} aria-hidden="true" />
      </IconButton>
    </>
  );

  const toolbarRightExtra = downloadUrl ? (
    <IconButton
      label="Descargar"
      tooltip="Descargar"
      onClick={() => window.open(downloadUrl, "_blank", "noopener,noreferrer")}
    >
      <Download size={16} aria-hidden="true" />
    </IconButton>
  ) : null;

  return { toolbarLeftContent, toolbarRightExtra };
}
