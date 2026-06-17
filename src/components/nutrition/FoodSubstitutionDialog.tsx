import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowRight, Info, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Food,
  macroScaleFactor,
  quantityUnitLabel,
  getSubstitutionCategoryLabel,
  normalizeFood,
} from "@/lib/foodService";
import {
  canSubstitute,
  kcalPorPorcao,
  listarSubstituicoesIsocaloricas,
  type SubstituicaoIsocalorica,
} from "@/lib/foodEquivalence";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { useStudentOverlayLock } from "@/hooks/useStudentOverlayLock";
import { apiClient } from "@/lib/api-client";
import { API_CONTRACT } from "@/contracts/api-contract";

interface FoodSubstitutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alimentoAtual: Food | null;
  quantidadeAtual: number;
  unidadeQuantidade?: string;
  alimentosDisponiveis: Food[];
  onSubstituir: (novoAlimentoId: string, novaQuantidade: number) => void;
}

export default function FoodSubstitutionDialog({
  open,
  onOpenChange,
  alimentoAtual,
  quantidadeAtual,
  unidadeQuantidade = "g",
  alimentosDisponiveis,
  onSubstituir,
}: FoodSubstitutionDialogProps) {
  useStudentOverlayLock(open);

  const [substituicoes, setSubstituicoes] = useState<SubstituicaoIsocalorica[]>([]);
  const [selectedSubstituicao, setSelectedSubstituicao] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);

  const nomeAlimentoAtual = alimentoAtual?.name || "Alimento atual";
  const unLabel = quantityUnitLabel(unidadeQuantidade);
  const kcalAtual = alimentoAtual
    ? kcalPorPorcao(alimentoAtual, quantidadeAtual, unidadeQuantidade)
    : 0;
  const grupoLabel = alimentoAtual
    ? getSubstitutionCategoryLabel("", alimentoAtual)
    : "";

  const fatorAtual = alimentoAtual
    ? macroScaleFactor(quantidadeAtual, unidadeQuantidade, alimentoAtual.portion)
    : 0;
  const choAtual = alimentoAtual ? alimentoAtual.carbs * fatorAtual : 0;
  const ptnAtual = alimentoAtual ? alimentoAtual.protein * fatorAtual : 0;
  const gorduraAtual = alimentoAtual ? alimentoAtual.fat * fatorAtual : 0;

  useEffect(() => {
    if (!open || !alimentoAtual) return;
    setBusca("");
    setSelectedSubstituicao("");
    void carregarSubstituicoes();
  }, [open, alimentoAtual, quantidadeAtual, unidadeQuantidade, alimentosDisponiveis]);

  const carregarSubstituicoes = async () => {
    if (!alimentoAtual) return;
    setLoading(true);
    try {
      const url = API_CONTRACT.alimentos.substituicoes(alimentoAtual.id, {
        quantidade: quantidadeAtual,
        unidade: unidadeQuantidade,
        limit: 100,
      });
      const res = await apiClient.requestSafe<{
        substituicoes: Array<{
          alimento: Food;
          quantidadeEquivalente: number;
          kcalReferencia: number;
          kcalEquivalente: number;
          formula: string;
        }>;
      }>(url);

      if (res.success && Array.isArray(res.data?.substituicoes)) {
        setSubstituicoes(
          res.data.substituicoes.map((s) => ({
            alimento: normalizeFood(s.alimento),
            quantidadeEquivalente: s.quantidadeEquivalente,
            kcalReferencia: s.kcalReferencia,
            kcalEquivalente: s.kcalEquivalente,
            formula: s.formula,
          })),
        );
        setLoading(false);
        return;
      }
    } catch {
      /* fallback local */
    }

    setSubstituicoes(
      listarSubstituicoesIsocaloricas(
        alimentoAtual,
        quantidadeAtual,
        unidadeQuantidade,
        alimentosDisponiveis,
        { limit: 100 },
      ),
    );
    setLoading(false);
  };

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return substituicoes;
    return substituicoes.filter((s) =>
      (s.alimento.name || "").toLowerCase().includes(q),
    );
  }, [substituicoes, busca]);

  const handleSubstituir = () => {
    const substituicao = substituicoes.find((s) => s.alimento.id === selectedSubstituicao);
    if (substituicao) {
      onSubstituir(substituicao.alimento.id, substituicao.quantidadeEquivalente);
      onOpenChange(false);
    }
  };

  if (!alimentoAtual) return null;

  const substituicaoIndisponivel = !canSubstitute(alimentoAtual);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex w-full max-w-3xl flex-col gap-0 overflow-hidden p-0",
          "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:max-h-[min(92dvh,920px)] max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-t-2xl max-md:rounded-b-none",
          "md:max-h-[min(85dvh,920px)] md:gap-4 md:p-6",
        )}
      >
        <DialogHeader className="shrink-0 space-y-2 px-6 pb-4 pt-6 text-left md:px-0 md:pb-0 md:pt-0">
          <DialogTitle>Substituir alimento</DialogTitle>
          <DialogDescription>
            Equivalência <strong>isocalórica</strong> no grupo{" "}
            <strong>{grupoLabel}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-6 pb-4 [-webkit-overflow-scrolling:touch] md:px-0 md:pb-0">
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Referência</p>
            <p className="text-lg font-semibold text-foreground">{nomeAlimentoAtual}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary">
                {quantidadeAtual}
                {unLabel}
              </Badge>
              <Badge variant="outline">{kcalAtual.toFixed(0)} kcal</Badge>
              <Badge variant="outline">CHO {choAtual.toFixed(1)}g</Badge>
              <Badge variant="outline">PTN {ptnAtual.toFixed(1)}g</Badge>
              <Badge variant="outline">LIP {gorduraAtual.toFixed(1)}g</Badge>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Mesmo grupo alimentar; quantidade ajustada para manter as mesmas calorias da porção de referência.
            </AlertDescription>
          </Alert>

          {substituicaoIndisponivel ? (
            <p className="py-8 text-center text-muted-foreground">
              Grupo livre ou sem calorias — substituição isocalórica não se aplica.
            </p>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar substituto no grupo..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>

              {loading ? (
                <p className="py-6 text-center text-muted-foreground">A calcular equivalências...</p>
              ) : filtradas.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  Nenhum substituto neste grupo.
                </p>
              ) : (
                <RadioGroup value={selectedSubstituicao} onValueChange={setSelectedSubstituicao}>
                  <div className="max-h-[min(40dvh,360px)] space-y-3 overflow-y-auto pr-1 md:max-h-[40vh]">
                    {filtradas.map((sub, index) => (
                      <div
                        key={sub.alimento.id}
                        className={cn(
                          "rounded-xl border p-4 transition-all",
                          selectedSubstituicao === sub.alimento.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                            : "hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <RadioGroupItem value={sub.alimento.id} id={sub.alimento.id} className="mt-1" />
                          <Label htmlFor={sub.alimento.id} className="flex-1 cursor-pointer space-y-2 font-normal">
                            {index === 0 && <Badge className="text-xs">Melhor ajuste</Badge>}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold">{sub.alimento.name}</span>
                              <Badge variant="secondary">
                                {sub.quantidadeEquivalente.toFixed(1)}
                                {unLabel}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                              <span className="rounded-md border px-2 py-1">
                                {sub.kcalEquivalente.toFixed(0)} kcal
                              </span>
                              <span className="rounded-md border px-2 py-1">
                                ref. {sub.kcalReferencia.toFixed(0)} kcal
                              </span>
                              <span className="rounded-md border px-2 py-1 text-muted-foreground">
                                {sub.alimento.calories} kcal/100g
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{sub.formula}</p>
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border p-4 pb-overlay-safe md:border-0 md:p-0 md:pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubstituir} disabled={!selectedSubstituicao || substituicaoIndisponivel}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}