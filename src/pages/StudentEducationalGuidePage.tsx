import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, FileText, Video } from "lucide-react";
import { contentTypeLabel, type EducationalContent } from "@/lib/educational-content";

function extractYoutubeId(url: string): string | null {
  const trimmed = url.trim();
  const watch = trimmed.match(/[?&]v=([^&]+)/);
  if (watch) return watch[1];
  const short = trimmed.match(/youtu\.be\/([^?&/]+)/);
  if (short) return short[1];
  const embed = trimmed.match(/youtube\.com\/embed\/([^?&/]+)/);
  if (embed) return embed[1];
  return null;
}

const StudentEducationalGuidePage = () => {
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<EducationalContent | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  const loadPdf = useCallback(async (fileUrl: string) => {
    const token = apiClient.getToken();
    const res = await fetch(fileUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Não foi possível carregar o PDF");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    setPdfBlobUrl(url);
  }, []);

  useEffect(() => {
    if (!contentId) {
      setError("Conteúdo inválido");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const result = await apiClient.requestSafe<EducationalContent>(
        `/api/educational-contents/${contentId}`,
      );
      if (cancelled) return;

      if (!result.success || !result.data) {
        setError(result.error || "Conteúdo não encontrado");
        setLoading(false);
        return;
      }

      setContent(result.data);

      if (result.data.content_type === "pdf" && result.data.file_url) {
        try {
          await loadPdf(result.data.file_url);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Erro ao carregar PDF");
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [contentId, loadPdf]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const youtubeId = useMemo(
    () => (content?.video_url ? extractYoutubeId(content.video_url) : null),
    [content?.video_url],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 gap-1 px-2"
          onClick={() => navigate("/portal-aluno?tab=diet")}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {content?.title ?? "Guia educativo"}
          </p>
          {content ? (
            <p className="truncate text-xs text-muted-foreground">
              {contentTypeLabel(content.content_type)}
              {content.category ? ` · ${content.category}` : ""}
            </p>
          ) : null}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 pb-safe-bottom">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : content ? (
          <div className="mx-auto w-full max-w-2xl space-y-4">
            {content.description ? (
              <p className="text-sm text-muted-foreground">{content.description}</p>
            ) : null}

            {content.content_type === "article" && content.article_content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-lg border border-border/60 bg-card p-4 text-sm leading-relaxed">
                {content.article_content}
              </div>
            ) : null}

            {content.content_type === "pdf" && pdfBlobUrl ? (
              <div className="space-y-3">
                <a
                  href={pdfBlobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button type="button" variant="outline" className="h-11 gap-2">
                    <FileText className="h-4 w-4" />
                    Abrir PDF em tela cheia
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
                <div className="hidden min-h-[70dvh] overflow-hidden rounded-lg border border-border sm:block">
                  <iframe
                    title={content.title}
                    src={pdfBlobUrl}
                    className="h-[75dvh] w-full"
                  />
                </div>
                <p className="text-xs text-muted-foreground sm:hidden">
                  Toque em &quot;Abrir PDF em tela cheia&quot; para visualizar o documento no seu
                  dispositivo.
                </p>
              </div>
            ) : null}

            {content.content_type === "video" && content.video_url ? (
              <div className="space-y-3">
                {youtubeId ? (
                  <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
                    <iframe
                      title={content.title}
                      src={`https://www.youtube.com/embed/${youtubeId}`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <Button asChild className="h-11 w-full gap-2">
                    <a href={content.video_url} target="_blank" rel="noopener noreferrer">
                      <Video className="h-4 w-4" />
                      Abrir vídeo
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default StudentEducationalGuidePage;
