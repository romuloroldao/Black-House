import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FileText, Search, Video, Newspaper, ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { API_CONTRACT } from "@/contracts/api-contract";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  mergeEducationalCategories,
  contentTypeLabel,
  type EducationalContent,
} from "@/lib/educational-content";
import { cn } from "@/lib/utils";

const TYPE_ICON = {
  pdf: FileText,
  article: Newspaper,
  video: Video,
} as const;

const StudentEducationalLibraryView = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<EducationalContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const url = API_CONTRACT.educationalContents.list({ active: true });
      const res = await apiClient.requestSafe<EducationalContent[]>(url);
      if (cancelled) return;
      const list = res.success && Array.isArray(res.data) ? res.data : [];
      setItems(list.filter((c) => c.active !== false));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoriesInUse = useMemo(() => {
    const present = items
      .map((i) => i.category?.trim())
      .filter((c): c is string => Boolean(c));
    const presentKeys = new Set(present.map((c) => c.toLowerCase()));
    // Só categorias com conteúdo (presets vazios não aparecem no portal do aluno).
    return mergeEducationalCategories(present).filter((c) => presentKeys.has(c.toLowerCase()));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (category && item.category !== category) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q)
      );
    });
  }, [items, search, category]);

  const openGuide = (id: string) => {
    navigate(`/portal-aluno/guia/${id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-xl font-bold sm:text-2xl">Educação</h1>
        <p className="text-muted-foreground">
          Materiais educativos do seu coach — artigos, PDFs e vídeos.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar conteúdos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          autoComplete="off"
        />
      </div>

      {categoriesInUse.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={category == null ? "default" : "outline"}
            className="h-8"
            onClick={() => setCategory(null)}
          >
            Todos
          </Button>
          {categoriesInUse.map((cat) => (
            <Button
              key={cat}
              type="button"
              size="sm"
              variant={category === cat ? "default" : "outline"}
              className="h-8"
              onClick={() => setCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[280px] items-center justify-center">
          <div className="max-w-sm text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium">
              {items.length === 0
                ? "O teu coach ainda não publicou materiais"
                : "Nenhum conteúdo para essa busca"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.length === 0
                ? "Quando houver conteúdos activos na biblioteca educativa, aparecem aqui."
                : "Tente outro termo ou limpe o filtro de categoria."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((item) => {
            const Icon = TYPE_ICON[item.content_type] || BookOpen;
            return (
              <Card
                key={item.id}
                className={cn(
                  "cursor-pointer border-border/80 shadow-sm transition-colors hover:bg-muted/30",
                )}
                onClick={() => openGuide(item.id)}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold leading-snug">{item.title}</p>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {contentTypeLabel(item.content_type)}
                      </Badge>
                      {item.category ? (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {item.category}
                        </Badge>
                      ) : null}
                    </div>
                    {item.description ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                    ) : null}
                  </div>
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentEducationalLibraryView;
