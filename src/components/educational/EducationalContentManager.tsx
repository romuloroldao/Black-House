import { useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useApiSafeList } from "@/hooks/useApiSafe";
import { useToast } from "@/hooks/use-toast";
import { confirmDelete, useConfirm } from "@/contexts/ConfirmContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Plus,
  Search,
  Trash2,
  Video,
} from "lucide-react";
import {
  EDUCATIONAL_CONTENT_CATEGORIES,
  contentTypeLabel,
  type EducationalContent,
} from "@/lib/educational-content";
import EducationalContentForm from "./EducationalContentForm";

function typeIcon(type: string) {
  if (type === "pdf") return FileText;
  if (type === "video") return Video;
  return BookOpen;
}

const EducationalContentManager = () => {
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EducationalContent | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim().length >= 2) params.set("q", search.trim());
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    const qs = params.toString();
    return `/api/educational-contents${qs ? `?${qs}` : ""}`;
  }, [search, categoryFilter]);

  const { data: itemsRaw, loading, refetch } = useApiSafeList<EducationalContent>(
    () => apiClient.requestSafe<EducationalContent[]>(query),
    { autoFetch: true, endpointKey: query },
  );

  const items = Array.isArray(itemsRaw) ? itemsRaw : [];

  const handleDelete = async (item: EducationalContent) => {
    const ok = await confirm(confirmDelete(`o conteúdo "${item.title}"`));
    if (!ok) return;

    const result = await apiClient.requestSafe(`/api/educational-contents/${item.id}`, {
      method: "DELETE",
    });
    if (!result.success) {
      toast({ variant: "destructive", title: "Erro ao excluir", description: result.error });
      return;
    }
    toast({ title: "Conteúdo excluído" });
    refetch();
  };

  const handleToggleActive = async (item: EducationalContent) => {
    const result = await apiClient.requestSafe<EducationalContent>(
      `/api/educational-contents/${item.id}`,
      {
        method: "PUT",
        body: JSON.stringify({ ...item, active: !item.active }),
      },
    );
    if (!result.success) {
      toast({ variant: "destructive", title: "Erro", description: result.error });
      return;
    }
    refetch();
  };

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (item: EducationalContent) => {
    setEditing(item);
    setShowForm(true);
  };

  if (showForm) {
    return (
      <EducationalContentForm
        initial={editing}
        onCancel={() => setShowForm(false)}
        onSaved={() => {
          setShowForm(false);
          refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Conteúdos Educativos</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Biblioteca reutilizável para Refeição Livre e futuras secções educativas.
          </p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Novo conteúdo
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por título, descrição ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={categoryFilter === "all" ? "default" : "outline"}
          onClick={() => setCategoryFilter("all")}
        >
          Todos ({items.length})
        </Button>
        {EDUCATIONAL_CONTENT_CATEGORIES.map((cat) => {
          const count = items.filter((i) => i.category === cat).length;
          return (
            <Button
              key={cat}
              size="sm"
              variant={categoryFilter === cat ? "default" : "outline"}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat} ({count})
            </Button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum conteúdo encontrado. Crie o primeiro material educativo.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const Icon = typeIcon(item.content_type);
            return (
              <Card key={item.id} className={!item.active ? "opacity-60" : undefined}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="line-clamp-2 text-base">{item.title}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">
                        {item.description || "Sem descrição"}
                      </CardDescription>
                    </div>
                    <Icon className="h-5 w-5 shrink-0 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {item.category ? <Badge variant="secondary">{item.category}</Badge> : null}
                    <Badge variant="outline">{contentTypeLabel(item.content_type)}</Badge>
                    {!item.active ? <Badge variant="destructive">Inativo</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                      <Edit3 className="mr-1 h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleActive(item)}>
                      {item.active ? (
                        <>
                          <EyeOff className="mr-1 h-3.5 w-3.5" />
                          Inativar
                        </>
                      ) : (
                        <>
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Ativar
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(item)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EducationalContentManager;
