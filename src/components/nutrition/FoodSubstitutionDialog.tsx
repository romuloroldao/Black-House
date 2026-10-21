import { useState, useEffect, useRef, useCallback } from "react";
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
import { ArrowRight, Info, Loader2, Search } from "lucide-react";
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

const MIN_SEARCH_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 280;
const SEARCH_LIMIT = 20;
const SEARCH_TIMEOUT_MS = 12_000;
/** Default estável — `= []` no parâmetro recria a referência a cada render e aborta a busca em loop. */
const EMPTY_FOODS: Food[] = [];

type SearchStatus = "idle" | "searching" | "success" | "empty" | "error";

interface FoodSubstitutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alimentoAtual: Food | null;
  quantidadeAtual: number;
  unidadeQuantidade?: string;
  /** Fallback local se a API falhar; usado apenas em busca com termo válido. */
  alimentosDisponiveis?: Food[];
  onSubstituir: (novoAlimentoId: string, novaQuantidade: number, novoAlimento?: Food) => void;
}

export default function FoodSubstitutionDialog({
  open,
  onOpenChange,
  alimentoAtual,
  quantidadeAtual,
  unidadeQuantidade = "g",
  alimentosDisponiveis = EMPTY_FOODS,
  onSubstituir,
}: FoodSubstitutionDialogProps) {
  useStudentOverlayLock(open);

  const [substituicoes, setSubstituicoes] = useState<SubstituicaoIsocalorica[]>([]);
  const [selectedSubstituicao, setSelectedSubstituicao] = useState("");
  const [busca, setBusca] = useState("");
  const [debouncedBusca, setDebouncedBusca] = useState("");
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [confirming, setConfirming] = useState(false);

  const fetchSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, SubstituicaoIsocalorica[]>>(new Map());
  const alimentoAtualRef = useRef(alimentoAtual);
  alimentoAtualRef.current = alimentoAtual;
  const alimentosDisponiveisRef = useRef(alimentosDisponiveis);
  alimentosDisponiveisRef.current = alimentosDisponiveis;

  const alimentoId = alimentoAtual?.id;
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
    const t = window.setTimeout(() => setDebouncedBusca(busca), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }
    setBusca("");
    setDebouncedBusca("");
    setSubstituicoes([]);
    setSelectedSubstituicao("");
    setSearchStatus("idle");
    setConfirming(false);
    cacheRef.current.clear();
  }, [open, alimentoId, quantidadeAtual, unidadeQuantidade]);

  const cacheKey = useCallback(
    (term: string) =>
      `${alimentoId}|${quantidadeAtual}|${unidadeQuantidade}|${term.toLowerCase()}`,
    [alimentoId, quantidadeAtual, unidadeQuantidade],
  );

  const mapApiResponse = useCallback(
    (
      rows: Array<{
        alimento: Food;
        quantidadeEquivalente: number;
        kcalReferencia: number;
        kcalEquivalente: number;
        formula: string;
      }>,
    ): SubstituicaoIsocalorica[] =>
      rows.map((s) => ({
        alimento: normalizeFood(s.alimento),
        quantidadeEquivalente: s.quantidadeEquivalente,
        kcalReferencia: s.kcalReferencia,
        kcalEquivalente: s.kcalEquivalente,
        formula: s.formula,
      })),
    [],
  );

  const fallbackLocal = useCallback(
    (term: string, ref: Food): SubstituicaoIsocalorica[] => {
      const candidatos = alimentosDisponiveisRef.current;
      if (candidatos.length === 0) return [];
      return listarSubstituicoesIsocaloricas(
        ref,
        quantidadeAtual,
        unidadeQuantidade,
        candidatos,
        { limit: SEARCH_LIMIT, searchQuery: term.trim() },
      );
    },
    [quantidadeAtual, unidadeQuantidade],
  );

  const executarBusca = useCallback(
    async (term: string) => {
      const ref = alimentoAtualRef.current;
      if (!ref || !open) return;

      const trimmed = term.trim();
      if (trimmed.length < MIN_SEARCH_CHARS) {
        setSubstituicoes([]);
        setSelectedSubstituicao("");
        setSearchStatus("idle");
        return;
      }

      const key = cacheKey(trimmed);
      const cached = cacheRef.current.get(key);
      if (cached) {
        setSubstituicoes(cached);
        setSelectedSubstituicao("");
        setSearchStatus(cached.length > 0 ? "success" : "empty");
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++fetchSeqRef.current;
      const timeoutId = window.setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

      setSearchStatus("searching");
      setSubstituicoes([]);
      setSelectedSubstituicao("");

      try {
        const url = API_CONTRACT.alimentos.substituicoes(ref.id, {
          quantidade: quantidadeAtual,
          unidade: unidadeQuantidade,
          limit: SEARCH_LIMIT,
          q: trimmed,
        });

        const res = await apiClient.requestSafe<{
          substituicoes: Array<{
            alimento: Food;
            quantidadeEquivalente: number;
            kcalReferencia: number;
            kcalEquivalente: number;
            formula: string;
          }>;
        }>(url, { signal: controller.signal });

        if (seq !== fetchSeqRef.current) return;

        let result: SubstituicaoIsocalorica[] = [];
        let apiOk = false;

        if (res.success && Array.isArray(res.data?.substituicoes)) {
          result = mapApiResponse(res.data.substituicoes);
          apiOk = true;
        } else if (alimentosDisponiveisRef.current.length > 0) {
          result = fallbackLocal(trimmed, ref);
        }

        if (seq !== fetchSeqRef.current) return;

        cacheRef.current.set(key, result);
        setSubstituicoes(result);
        if (!apiOk && result.length === 0) {
          setSearchStatus("error");
        } else {
          setSearchStatus(result.length > 0 ? "success" : "empty");
        }
      } catch {
        if (seq !== fetchSeqRef.current) return;
        const local = fallbackLocal(trimmed, ref);
        if (local.length > 0) {
          cacheRef.current.set(key, local);
          setSubstituicoes(local);
          setSearchStatus("success");
        } else {
          setSubstituicoes([]);
          setSearchStatus("error");
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    [
      open,
      cacheKey,
      quantidadeAtual,
      unidadeQuantidade,
      mapApiResponse,
      fallbackLocal,
    ],
  );

  useEffect(() => {
    if (!open || !alimentoId) return;
    void executarBusca(debouncedBusca);
  }, [open, alimentoId, debouncedBusca, executarBusca]);

  const handleSubstituir = async () => {
    const substituicao = substituicoes.find((s) => s.alimento.id === selectedSubstituicao);
    if (!substituicao || confirming) return;

    setConfirming(true);
    try {
      await Promise.resolve(
        onSubstituir(
          substituicao.alimento.id,
          substituicao.quantidadeEquivalente,
          substituicao.alimento,
        ),
      );
      onOpenChange(false);
    } finally {
      setConfirming(false);
    }
  };

  if (!alimentoAtual) return null;

  const substituicaoIndisponivel = !canSubstitute(alimentoAtual);
  const trimmedBusca = busca.trim();
  const showMinCharsHint =
    searchStatus === "idle" &&
    trimmedBusca.length > 0 &&
    trimmedBusca.length < MIN_SEARCH_CHARS;

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
                  autoComplete="off"
                />
              </div>

              {showMinCharsHint ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Digite pelo menos {MIN_SEARCH_CHARS} caracteres para buscar.
                </p>
              ) : searchStatus === "idle" && trimmedBusca.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Digite o nome do alimento substituto no grupo {grupoLabel}.
                </p>
              ) : searchStatus === "searching" ? (
                <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                  Buscando alimentos...
                </div>
              ) : searchStatus === "error" ? (
                <div className="space-y-3 py-6 text-center">
                  <p className="text-sm text-destructive">
                    Não foi possível carregar os alimentos. Tente novamente.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void executarBusca(debouncedBusca)}
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : searchStatus === "empty" ? (
                <p className="py-8 text-center text-muted-foreground">
                  Nenhum alimento encontrado para essa busca.
                </p>
              ) : (
                <RadioGroup value={selectedSubstituicao} onValueChange={setSelectedSubstituicao}>
                  <div className="max-h-[min(40dvh,360px)] space-y-3 overflow-y-auto pr-1 md:max-h-[40vh]">
                    {substituicoes.map((sub, index) => (
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSubstituir()}
            disabled={!selectedSubstituicao || substituicaoIndisponivel || confirming}
          >
            {confirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Confirmar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
