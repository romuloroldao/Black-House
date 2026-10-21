import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Maximize2,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_PAGE_WIDTH = 960;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.15;

type EducationalPdfViewerProps = {
  fileUrl: string;
  title: string;
  className?: string;
};

export function EducationalPdfViewer({ fileUrl, title, className }: EducationalPdfViewerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [fitWidth, setFitWidth] = useState(720);
  const [scale, setScale] = useState(1);
  const [fitMode, setFitMode] = useState(true);
  const [docError, setDocError] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(true);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      const pad = window.matchMedia("(min-width: 640px)").matches ? 48 : 24;
      setFitWidth(Math.max(280, Math.min(MAX_PAGE_WIDTH, w - pad)));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageWidth = fitMode ? fitWidth : Math.round(fitWidth * scale);

  const onDocumentLoad = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPage(1);
    setDocLoading(false);
    setDocError(null);
  }, []);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(numPages || 1, p + 1));

  const zoomOut = () => {
    setFitMode(false);
    setScale((s) => Math.max(MIN_SCALE, Math.round((s - SCALE_STEP) * 100) / 100));
  };

  const zoomIn = () => {
    setFitMode(false);
    setScale((s) => Math.min(MAX_SCALE, Math.round((s + SCALE_STEP) * 100) / 100));
  };

  const resetFit = () => {
    setFitMode(true);
    setScale(1);
  };

  const toolbar = (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1 border-border bg-background/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/90",
        "max-md:border-t max-md:pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        "md:border-b",
      )}
    >
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 md:h-9 md:w-9"
          disabled={page <= 1}
          onClick={goPrev}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-muted-foreground sm:text-sm">
          {numPages > 0 ? `${page} / ${numPages}` : "—"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 md:h-9 md:w-9"
          disabled={!numPages || page >= numPages}
          onClick={goNext}
          aria-label="Página seguinte"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />

      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 md:h-9 md:w-9"
          onClick={zoomOut}
          aria-label="Diminuir zoom"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="hidden min-w-[3rem] text-center text-xs tabular-nums text-muted-foreground sm:inline">
          {fitMode ? "Fit" : `${Math.round(scale * 100)}%`}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 md:h-9 md:w-9"
          onClick={zoomIn}
          aria-label="Aumentar zoom"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={fitMode ? "secondary" : "ghost"}
          size="icon"
          className="h-11 w-11 md:h-9 md:w-9"
          onClick={resetFit}
          aria-label="Ajustar à largura"
          title="Ajustar à largura"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button type="button" variant="outline" size="sm" className="h-11 gap-1.5 px-3 md:h-9" asChild>
          <a href={fileUrl} download={`${title || "documento"}.pdf`}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Descarregar</span>
          </a>
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11 md:h-9 md:w-9" asChild>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir noutro separador">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="hidden md:block">{toolbar}</div>

      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-muted/40"
      >
        <div className="flex min-h-full justify-center px-3 py-4 sm:px-6 sm:py-6">
          {docError ? (
            <div className="flex max-w-md flex-col items-center gap-3 self-center text-center">
              <p className="text-sm text-destructive">{docError}</p>
              <Button type="button" variant="outline" asChild>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  Abrir PDF noutro app
                </a>
              </Button>
            </div>
          ) : (
            <Document
              file={fileUrl}
              loading={
                <div className="flex items-center gap-2 self-center py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 motion-safe:animate-spin" />
                  <span className="text-sm">A carregar documento…</span>
                </div>
              }
              onLoadSuccess={onDocumentLoad}
              onLoadError={() => {
                setDocLoading(false);
                setDocError("Não foi possível renderizar o PDF neste dispositivo.");
              }}
              className="flex justify-center"
            >
              {!docLoading && numPages > 0 ? (
                <div className="overflow-hidden rounded-lg bg-white shadow-elevated ring-1 ring-border/60">
                  <Page
                    pageNumber={page}
                    width={pageWidth}
                    renderTextLayer
                    renderAnnotationLayer
                    loading={
                      <div
                        className="flex items-center justify-center bg-muted"
                        style={{ width: pageWidth, height: pageWidth * 1.3 }}
                      >
                        <Loader2 className="h-6 w-6 motion-safe:animate-spin text-muted-foreground" />
                      </div>
                    }
                  />
                </div>
              ) : null}
            </Document>
          )}
        </div>
      </div>

      <div className="md:hidden">{toolbar}</div>
    </div>
  );
}

export default EducationalPdfViewer;
