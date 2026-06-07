import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { contentTypeLabel, type EducationalContent } from "@/lib/educational-content";

interface DietRefeicaoLivreFieldsProps {
  ativa: boolean;
  observacao: string;
  contentId: string | null;
  onAtivaChange: (value: boolean) => void;
  onObservacaoChange: (value: string) => void;
  onContentIdChange: (value: string | null) => void;
}

const DietRefeicaoLivreFields = ({
  ativa,
  observacao,
  contentId,
  onAtivaChange,
  onObservacaoChange,
  onContentIdChange,
}: DietRefeicaoLivreFieldsProps) => {
  const [contents, setContents] = useState<EducationalContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await apiClient.requestSafe<EducationalContent[]>(
        "/api/educational-contents?active=true&category=Refeição Livre",
      );
      if (!cancelled) {
        setContents(result.success && Array.isArray(result.data) ? result.data : []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    () =>
      contents.map((c) => ({
        value: c.id,
        label: c.title,
        description: [c.category, contentTypeLabel(c.content_type)].filter(Boolean).join(" · "),
      })),
    [contents],
  );

  const selected = contents.find((c) => c.id === contentId) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-primary" />
          Refeição Livre
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch id="refeicao-livre-ativa" checked={ativa} onCheckedChange={onAtivaChange} />
          <Label htmlFor="refeicao-livre-ativa">Ativar Refeição Livre</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="refeicao-livre-obs">Observações</Label>
          <Textarea
            id="refeicao-livre-obs"
            value={observacao}
            onChange={(e) => onObservacaoChange(e.target.value)}
            placeholder="Orientações do coach sobre refeições livres..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Conteúdo educativo</Label>
          <Combobox
            options={options}
            value={contentId ?? ""}
            onSelect={(v) => onContentIdChange(v || null)}
            placeholder={loading ? "Carregando biblioteca..." : "Selecionar da biblioteca..."}
            searchPlaceholder="Buscar conteúdo..."
            emptyText="Nenhum conteúdo ativo em Refeição Livre."
            disabled={!ativa || loading}
          />
          {selected ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="secondary">{selected.title}</Badge>
              {selected.category ? <Badge variant="outline">{selected.category}</Badge> : null}
              <Badge variant="outline">{contentTypeLabel(selected.content_type)}</Badge>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

export default DietRefeicaoLivreFields;
