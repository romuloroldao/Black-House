import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImageIcon, Loader2, Pencil, Plus, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStudentOverlayLock } from "@/hooks/useStudentOverlayLock";
import { prepareImageForUpload, isAcceptableImageFile } from "@/lib/prepare-image-upload";
import { apiClient } from "@/lib/api-client";
import {
  type MealPhotoAnalysis,
  type MealPhotoItem,
  type MealPhotoTotals,
  round1,
  sumMealItems,
} from "@/lib/meal-photo-types";
import { AuthMealImage } from "@/components/student/meal-photo/AuthMealImage";
import { cn } from "@/lib/utils";

type Step = "source" | "preview" | "analyzing" | "review" | "uncertain" | "manual";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  highlight?: boolean;
};

function emptyItem(): MealPhotoItem {
  return {
    nome: "",
    quantidade: 100,
    unidade: "g",
    kcal: 0,
    ptn: 0,
    cho: 0,
    lip: 0,
    fonte: "USER",
  };
}

function macrosEqual(a: MealPhotoTotals, b: MealPhotoTotals, eps = 1.5) {
  return (
    Math.abs(a.kcal - b.kcal) <= eps &&
    Math.abs(a.ptn - b.ptn) <= eps &&
    Math.abs(a.cho - b.cho) <= eps &&
    Math.abs(a.lip - b.lip) <= eps
  );
}

export default function MealPhotoLogSheet({
  open,
  onOpenChange,
  onSaved,
  highlight,
}: Props) {
  useStudentOverlayLock(open);

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("source");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [analysis, setAnalysis] = useState<MealPhotoAnalysis | null>(null);
  const [nome, setNome] = useState("");
  const [itens, setItens] = useState<MealPhotoItem[]>([]);
  const [imagemPath, setImagemPath] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [aiBaseline, setAiBaseline] = useState<{
    totais: MealPhotoTotals;
    itensCount: number;
  } | null>(null);

  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<MealPhotoItem | null>(null);

  const totals = useMemo(() => sumMealItems(itens), [itens]);

  const reset = () => {
    setStep("source");
    setFile(null);
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreparing(false);
    setSaving(false);
    setAnalysis(null);
    setNome("");
    setItens([]);
    setImagemPath(null);
    setNotas("");
    setAiBaseline(null);
    setEditIdx(null);
    setEditDraft(null);
  };

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (preparing || saving || step === "analyzing") return;
    onOpenChange(next);
  };

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;
    if (!isAcceptableImageFile(raw)) {
      toast.error("Formato não suportado. Escolha uma foto JPEG, PNG ou WebP.");
      return;
    }
    setPreparing(true);
    try {
      const prepared = await prepareImageForUpload(raw, {
        maxSide: 1600,
        maxBytes: 3 * 1024 * 1024,
        quality: 0.78,
      });
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(prepared);
      setFile(prepared);
      setPreviewUrl(url);
      setStep("preview");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível preparar a imagem.");
    } finally {
      setPreparing(false);
    }
  };

  const analyze = async () => {
    if (!file) return;
    setStep("analyzing");
    const result = await apiClient.analyzeMealPhoto(file);
    if (result.success === false) {
      toast.error(result.error || "Falha na análise. Tente novamente.");
      setStep("preview");
      return;
    }
    const data = result.data as MealPhotoAnalysis;
    setAnalysis(data);
    setImagemPath(data.imagem_path || null);
    setNome(data.nome_sugerido || "Refeição");
    const nextItens = (data.itens || []).map((it, i) => ({
      ...it,
      fonte: "AI" as const,
      ordem: i,
    }));
    setItens(nextItens);
    setAiBaseline({
      totais: data.totais || sumMealItems(nextItens),
      itensCount: nextItens.length,
    });

    if (!data.ok || data.status !== "OK" || nextItens.length === 0) {
      setStep("uncertain");
      return;
    }
    setStep("review");
  };

  const openEdit = (idx: number) => {
    setEditIdx(idx);
    setEditDraft({ ...itens[idx] });
  };

  const openAdd = () => {
    setEditIdx(-1);
    setEditDraft(emptyItem());
  };

  const applyEdit = () => {
    if (!editDraft) return;
    const nomeTrim = editDraft.nome.trim();
    if (!nomeTrim) {
      toast.error("Informe o nome do alimento.");
      return;
    }
    const cleaned: MealPhotoItem = {
      ...editDraft,
      nome: nomeTrim,
      quantidade: Number(editDraft.quantidade) || 0,
      unidade: editDraft.unidade || "g",
      kcal: round1(editDraft.kcal),
      ptn: round1(editDraft.ptn),
      cho: round1(editDraft.cho),
      lip: round1(editDraft.lip),
      fonte: editIdx === -1 ? "USER" : editDraft.fonte === "AI" ? "AI" : "USER",
    };
    if (editIdx === -1) {
      setItens((prev) => [...prev, { ...cleaned, fonte: "USER" }]);
    } else if (editIdx != null && editIdx >= 0) {
      setItens((prev) => {
        const copy = [...prev];
        const wasAi = copy[editIdx]?.fonte === "AI";
        copy[editIdx] = {
          ...cleaned,
          fonte:
            wasAi &&
            copy[editIdx].nome === cleaned.nome &&
            copy[editIdx].quantidade === cleaned.quantidade &&
            macrosEqual(copy[editIdx], cleaned)
              ? "AI"
              : wasAi
                ? "USER"
                : cleaned.fonte || "USER",
        };
        return copy;
      });
    }
    setEditIdx(null);
    setEditDraft(null);
  };

  const removeItem = (idx: number) => {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!itens.length && !notas.trim()) {
      toast.error("Adicione pelo menos um alimento ou uma descrição.");
      return;
    }
    setSaving(true);
    try {
      const userAdjusted =
        !aiBaseline ||
        !macrosEqual(totals, aiBaseline.totais) ||
        itens.length !== aiBaseline.itensCount ||
        itens.some((it) => it.fonte === "USER");

      const body = {
        nome_sugerido: nome.trim() || "Refeição",
        imagem_path: imagemPath,
        itens: itens.map((it, i) => ({ ...it, ordem: i })),
        kcal: round1(totals.kcal),
        ptn: round1(totals.ptn),
        cho: round1(totals.cho),
        lip: round1(totals.lip),
        ai_kcal: aiBaseline?.totais.kcal ?? null,
        ai_ptn: aiBaseline?.totais.ptn ?? null,
        ai_cho: aiBaseline?.totais.cho ?? null,
        ai_lip: aiBaseline?.totais.lip ?? null,
        ai_confidence: analysis?.confidence ?? null,
        ai_uncertainties: analysis?.uncertainties || [],
        ai_itens_count: aiBaseline?.itensCount ?? null,
        origem: userAdjusted ? "USER_ADJUSTED" : "AI_ESTIMATE",
        notas: notas.trim() || null,
      };

      const result = await apiClient.saveRefeicaoRegistradaSafe(body);
      if (result.success === false) {
        toast.error(result.error || "Não foi possível salvar.");
        return;
      }
      toast.success("Refeição salva no histórico.");
      onSaved?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const uncertainMessage =
    analysis?.error_message ||
    (analysis?.status === "LOW_QUALITY"
      ? "A imagem está escura, desfocada ou com baixa qualidade."
      : analysis?.status === "IMAGE_NOT_MEAL"
        ? "Não identifiquei uma refeição nesta imagem."
        : "Não consegui identificar todos os alimentos com segurança.");

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[min(92dvh,920px)] flex-col gap-0 overflow-hidden rounded-t-2xl p-0 pb-overlay-safe"
        >
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Utensils className="h-5 w-5 text-primary" />
              Registrar refeição livre
            </SheetTitle>
            <SheetDescription>
              Estimativa aproximada com base na imagem. Revise as porções antes de salvar.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [-webkit-overflow-scrolling:touch]">
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileSelect}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFileSelect}
            />

            {step === "source" && (
              <div className="space-y-3">
                <Button
                  type="button"
                  className={cn("h-12 w-full", highlight && "shadow-md")}
                  disabled={preparing}
                  onClick={() => cameraRef.current?.click()}
                >
                  {preparing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" />
                  )}
                  Fotografar minha refeição
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full"
                  disabled={preparing}
                  onClick={() => galleryRef.current?.click()}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Escolher da galeria
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setStep("manual");
                    setNome("Refeição livre");
                    setItens([]);
                    setAiBaseline(null);
                    setAnalysis(null);
                  }}
                >
                  Adicionar alimentos manualmente
                </Button>
              </div>
            )}

            {step === "preview" && (
              <div className="space-y-4">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Pré-visualização da refeição"
                    className="max-h-64 w-full rounded-xl object-cover"
                  />
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Confirme a foto antes de analisar. A análise não inicia automaticamente.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => cameraRef.current?.click()}
                  >
                    Tirar novamente
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => galleryRef.current?.click()}
                  >
                    Outra imagem
                  </Button>
                  <Button type="button" className="min-h-11" onClick={analyze}>
                    Analisar refeição
                  </Button>
                </div>
              </div>
            )}

            {step === "analyzing" && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-base font-medium">Analisando sua refeição…</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Valores estimados — a identificação visual não é clinicamente precisa.
                </p>
              </div>
            )}

            {step === "uncertain" && (
              <div className="space-y-4">
                {(previewUrl || imagemPath) && (
                  <div className="overflow-hidden rounded-xl">
                    {previewUrl ? (
                      <img src={previewUrl} alt="" className="max-h-48 w-full object-cover" />
                    ) : (
                      <AuthMealImage path={imagemPath} alt="" className="max-h-48 w-full object-cover" />
                    )}
                  </div>
                )}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <p className="font-medium">Não consegui identificar todos os alimentos com segurança.</p>
                  <p className="mt-1 text-muted-foreground">{uncertainMessage}</p>
                </div>
                <div className="grid gap-2">
                  <Button type="button" className="min-h-11" onClick={() => setStep("source")}>
                    Tentar outra foto
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => {
                      setStep("review");
                      if (!itens.length) setItens([]);
                    }}
                  >
                    Adicionar alimentos manualmente
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setStep("manual")}
                  >
                    Descrever a refeição
                  </Button>
                </div>
              </div>
            )}

            {(step === "review" || step === "manual") && (
              <div className="space-y-4">
                {(previewUrl || imagemPath) && step === "review" ? (
                  previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Refeição"
                      className="max-h-40 w-full rounded-xl object-cover"
                    />
                  ) : (
                    <AuthMealImage
                      path={imagemPath}
                      alt="Refeição"
                      className="max-h-40 w-full rounded-xl object-cover"
                    />
                  )
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="meal-name">Nome da refeição</Label>
                  <Input
                    id="meal-name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex.: Almoço livre"
                  />
                </div>

                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Valores estimados
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-center text-sm">
                    <div>
                      <div className="text-lg font-semibold">{Math.round(totals.kcal)}</div>
                      <div className="text-[11px] text-muted-foreground">kcal</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{round1(totals.ptn)}</div>
                      <div className="text-[11px] text-muted-foreground">ptn</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{round1(totals.cho)}</div>
                      <div className="text-[11px] text-muted-foreground">cho</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{round1(totals.lip)}</div>
                      <div className="text-[11px] text-muted-foreground">lip</div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Estimativa aproximada. Revise as porções antes de salvar.
                  </p>
                </div>

                {analysis?.uncertainties?.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {analysis.uncertainties.slice(0, 4).map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                ) : null}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Alimentos</h3>
                    <Button type="button" size="sm" variant="outline" onClick={openAdd}>
                      <Plus className="mr-1 h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>
                  {itens.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum alimento ainda.</p>
                  ) : (
                    <ul className="space-y-2">
                      {itens.map((it, idx) => (
                        <li
                          key={`${it.nome}-${idx}`}
                          className="flex items-start justify-between gap-2 rounded-xl border p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{it.nome}</p>
                            <p className="text-sm text-muted-foreground">
                              {it.quantidade}
                              {it.unidade || "g"} · {Math.round(it.kcal)} kcal
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9"
                              onClick={() => openEdit(idx)}
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 text-destructive"
                              onClick={() => removeItem(idx)}
                              aria-label="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {step === "manual" || !itens.length ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="meal-notes">Descrição (opcional)</Label>
                    <Textarea
                      id="meal-notes"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Descreva a refeição se a IA não identificou tudo…"
                      rows={3}
                    />
                  </div>
                ) : null}

                <Button
                  type="button"
                  className="h-12 w-full"
                  disabled={saving}
                  onClick={save}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirmar e salvar
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={editIdx !== null && !!editDraft}
        onOpenChange={(v) => {
          if (!v) {
            setEditIdx(null);
            setEditDraft(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editIdx === -1 ? "Adicionar alimento" : "Editar alimento"}</DialogTitle>
          </DialogHeader>
          {editDraft ? (
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input
                  value={editDraft.nome}
                  onChange={(e) => setEditDraft({ ...editDraft, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={editDraft.quantidade}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, quantidade: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Unidade</Label>
                  <Input
                    value={editDraft.unidade}
                    onChange={(e) => setEditDraft({ ...editDraft, unidade: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["kcal", "ptn", "cho", "lip"] as const).map((k) => (
                  <div key={k} className="space-y-1">
                    <Label className="uppercase">{k}</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={editDraft[k]}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, [k]: Number(e.target.value) })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditIdx(null);
                setEditDraft(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={applyEdit}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
