import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, Video } from "lucide-react";
import { contentTypeLabel, type EducationalContent } from "@/lib/educational-content";
import { EducationalPdfViewer } from "@/components/student/education/EducationalPdfViewer";
import { cn } from "@/lib/utils";

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

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/portal-aluno?tab=education");
    }
  };

  const loadPdf = useCallback(async (fileUrl: string) => {
    const token = apiClient.getToken();
    const res = await fetch(fileUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Não foi possível carregar o PDF");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }, []);

  useEffect(() => {
    if (!contentId) {
      setError("Conteúdo inválido");
      setLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      setPdfBlobUrl(null);

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
          objectUrl = await loadPdf(result.data.file_url);
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          setPdfBlobUrl(objectUrl);
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Erro ao carregar PDF");
          }
        }
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
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

  const isPdf = content?.content_type === "pdf";
  const isArticle = content?.content_type === "article";
  const isVideo = content?.content_type === "video";

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background">
      <header
        className={cn(
          "flex shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur",
          "supports-[backdrop-filter]:bg-background/90",
          "pt-[max(0.65rem,env(safe-area-inset-top))]",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 shrink-0 gap-1 px-2"
          onClick={goBack}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">
            {content?.title ?? (loading ? "A carregar…" : "Guia educativo")}
          </p>
          {content ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px] font-normal">
                {contentTypeLabel(content.content_type)}
              </Badge>
              {content.category ? (
                <Badge variant="outline" className="text-[10px] font-normal">
                  {content.category}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:p-6">
          <Skeleton className="h-8 w-2/3 max-w-md" />
          <Skeleton className="min-h-0 flex-1 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" onClick={goBack}>
            Voltar à Educação
          </Button>
        </div>
      ) : content && isPdf && pdfBlobUrl ? (
        <EducationalPdfViewer fileUrl={pdfBlobUrl} title={content.title} />
      ) : content && isArticle ? (
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <article className="mx-auto w-full max-w-prose px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-12">
            {content.description ? (
              <p className="mb-8 text-base leading-relaxed text-muted-foreground">
                {content.description}
              </p>
            ) : null}
            <div className="whitespace-pre-wrap text-base leading-[1.75] text-foreground sm:text-[1.05rem]">
              {content.article_content}
            </div>
          </article>
        </main>
      ) : content && isVideo && content.video_url ? (
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-black/90">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10">
            {youtubeId ? (
              <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-elevated ring-1 ring-white/10">
                <iframe
                  title={content.title}
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <Button asChild className="h-12 w-full gap-2 sm:w-auto sm:self-center">
                <a href={content.video_url} target="_blank" rel="noopener noreferrer">
                  <Video className="h-4 w-4" />
                  Abrir vídeo
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            {content.description ? (
              <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
                {content.description}
              </p>
            ) : null}
          </div>
        </main>
      ) : content ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <p className="text-sm text-muted-foreground">Este conteúdo ainda não tem material para visualizar.</p>
        </div>
      ) : null}
    </div>
  );
};

export default StudentEducationalGuidePage;
