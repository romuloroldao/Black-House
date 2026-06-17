import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  Edit3,
  User,
  Zap,
  RefreshCw,
} from "lucide-react";

export interface WorkoutTemplateSummary {
  id: string;
  name: string;
  studentsAssigned?: number;
  studentsCustomized?: number;
}

interface AtribuicaoRow {
  id: string;
  aluno_id: string;
  template_versao: number | null;
  ativo: boolean;
  data_inicio: string | null;
  aluno_nome: string;
  personalizacoes: number;
}

interface AtribuicoesResponse {
  template_id: string;
  versao: number;
  total_alunos: number;
  atribuicoes: AtribuicaoRow[];
}

interface WorkoutTemplateAssignmentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: WorkoutTemplateSummary | null;
}

const WorkoutTemplateAssignmentsSheet = ({
  open,
  onOpenChange,
  template,
}: WorkoutTemplateAssignmentsSheetProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AtribuicoesResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "customized" | "outdated">("all");

  const carregarAtribuicoes = async () => {
    if (!template?.id) return;
    setLoading(true);
    setError(null);
    const result = await apiClient.requestSafe<AtribuicoesResponse>(
      `/api/treinos/${template.id}/atribuicoes`,
    );
    if (!result.success || !result.data) {
      setError(result.error || "Não foi possível carregar os alunos vinculados.");
      setData(null);
    } else {
      setData(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && template?.id) {
      setSearchTerm("");
      setFilter("all");
      void carregarAtribuicoes();
    }
  }, [open, template?.id]);

  const versaoAtual = data?.versao ?? 1;

  const filtradas = useMemo(() => {
    const rows = data?.atribuicoes ?? [];
    return rows.filter((row) => {
      const nome = (row.aluno_nome || "").toLowerCase();
      const matchSearch = nome.includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      if (filter === "customized") return (row.personalizacoes ?? 0) > 0;
      if (filter === "outdated") {
        const v = row.template_versao ?? versaoAtual;
        return v < versaoAtual;
      }
      return true;
    });
  }, [data?.atribuicoes, searchTerm, filter, versaoAtual]);

  const comPersonalizacao = (data?.atribuicoes ?? []).filter(
    (r) => (r.personalizacoes ?? 0) > 0,
  ).length;

  const desatualizados = (data?.atribuicoes ?? []).filter((r) => {
    const v = r.template_versao ?? versaoAtual;
    return v < versaoAtual;
  }).length;

  const handleEditarTreino = (row: AtribuicaoRow) => {
    if (!template) return;
    onOpenChange(false);
    navigate(
      `/treino/${template.id}?atribuicao=${row.id}&from=${encodeURIComponent("/?tab=treinos")}`,
    );
  };

  const handleVerAluno = (alunoId: string) => {
    onOpenChange(false);
    navigate(`/alunos/${alunoId}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-1 pb-4">
          <SheetTitle className="flex items-center gap-2 pr-8">
            <Users className="h-5 w-5 text-primary" />
            Alunos vinculados
          </SheetTitle>
          <SheetDescription className="text-left">
            {template?.name ?? "Template"} — versão actual v{versaoAtual}
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg border border-border p-3 text-center">
            <p className="text-2xl font-bold">{data?.total_alunos ?? template?.studentsAssigned ?? 0}</p>
            <p className="text-xs text-muted-foreground">Activos</p>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <p className="text-2xl font-bold text-warning">{comPersonalizacao}</p>
            <p className="text-xs text-muted-foreground">Com ajustes</p>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{desatualizados}</p>
            <p className="text-xs text-muted-foreground">Versão antiga</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="customized">Com personalizações</SelectItem>
              <SelectItem value="outdated">Versão desactualizada</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void carregarAtribuicoes()}
            disabled={loading}
            title="Actualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : filtradas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum aluno encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.total_alunos
                ? "Ajuste a busca ou o filtro."
                : "Atribua este treino a um aluno no perfil dele."}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead className="hidden sm:table-cell">Versão</TableHead>
                  <TableHead>Ajustes</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((row) => {
                  const v = row.template_versao ?? versaoAtual;
                  const outdated = v < versaoAtual;
                  const customized = (row.personalizacoes ?? 0) > 0;

                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium leading-tight">{row.aluno_nome || "—"}</p>
                          {row.data_inicio && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Desde{" "}
                              {new Date(row.data_inicio).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          variant="outline"
                          className={
                            outdated
                              ? "bg-warning/10 text-warning border-warning/20"
                              : ""
                          }
                        >
                          v{v}
                          {outdated && " · antiga"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {customized ? (
                          <Badge
                            variant="secondary"
                            className="bg-warning/10 text-warning border-warning/20"
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            {row.personalizacoes}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Ver perfil do aluno"
                            onClick={() => handleVerAluno(row.aluno_id)}
                          >
                            <User className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Editar treino deste aluno"
                            onClick={() => handleEditarTreino(row)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default WorkoutTemplateAssignmentsSheet;
