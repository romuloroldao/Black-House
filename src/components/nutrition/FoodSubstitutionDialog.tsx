import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowRight, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Food, getMacroGroup } from "@/lib/foodService";

interface Substituicao {
  alimento: Food;
  quantidadeEquivalente: number;
  criterio: "kcal" | "cho";
  formula: string;
}

interface FoodSubstitutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alimentoAtual: Food | null;
  quantidadeAtual: number;
  alimentosDisponiveis: Food[];
  onSubstituir: (novoAlimentoId: string, novaQuantidade: number) => void;
}

export default function FoodSubstitutionDialog({
  open,
  onOpenChange,
  alimentoAtual,
  quantidadeAtual,
  alimentosDisponiveis,
  onSubstituir,
}: FoodSubstitutionDialogProps) {
  const [criterio, setCriterio] = useState<"kcal" | "cho">("kcal");
  const [substituicoes, setSubstituicoes] = useState<Substituicao[]>([]);
  const [selectedSubstituicao, setSelectedSubstituicao] = useState<string>("");

  useEffect(() => {
    if (alimentoAtual) {
      calcularSubstituicoes();
    }
  }, [alimentoAtual, quantidadeAtual, criterio, alimentosDisponiveis]);

  const calcularSubstituicoes = () => {
    if (!alimentoAtual) return;

    // Calcular valores do alimento atual para a quantidade especificada
    const fatorAtual = quantidadeAtual / alimentoAtual.portion;
    const kcalAtual = alimentoAtual.calories * fatorAtual;
    const choAtual = alimentoAtual.carbs * fatorAtual;

    // Filtrar alimentos do mesmo tipo/grupo
    const grupoAtual = getMacroGroup(alimentoAtual);
    const alimentosDoMesmoGrupo = alimentosDisponiveis.filter(
      (alimento) =>
        getMacroGroup(alimento) === grupoAtual &&
        alimento.id !== alimentoAtual.id
    );

    // Calcular substituições
    const novasSubstituicoes: Substituicao[] = alimentosDoMesmoGrupo
      .filter((alimento) => {
        if (criterio === "kcal") return alimento.calories > 0;
        return alimento.carbs > 0;
      })
      .map((alimento) => {
        let quantidadeEquivalente: number;
        let formula: string;

        if (criterio === "kcal") {
          // Fórmula correta: Qtd_B = kcal_A / (kcal_B / qtd_ref_B)
          const kcalSubPorGrama = alimento.calories / alimento.portion;
          quantidadeEquivalente = kcalAtual / kcalSubPorGrama;
          formula = `${kcalAtual.toFixed(1)} kcal ÷ ${kcalSubPorGrama.toFixed(2)} kcal/g = ${quantidadeEquivalente.toFixed(0)}g`;
        } else {
          // Fórmula correta: Qtd_B = CHO_A / (CHO_B / qtd_ref_B)
          const choSubPorGrama = alimento.carbs / alimento.portion;
          quantidadeEquivalente = choAtual === 0 || choSubPorGrama === 0 
            ? 0 
            : choAtual / choSubPorGrama;
          formula = `${choAtual.toFixed(1)}g CHO ÷ ${choSubPorGrama.toFixed(2)}g CHO/g = ${quantidadeEquivalente.toFixed(0)}g`;
        }

        return {
          alimento,
          quantidadeEquivalente,
          criterio,
          formula,
        };
      });

    // Ordenar por proximidade de quantidade à original
    novasSubstituicoes.sort((a, b) => {
      const diffA = Math.abs(a.quantidadeEquivalente - quantidadeAtual);
      const diffB = Math.abs(b.quantidadeEquivalente - quantidadeAtual);
      return diffA - diffB;
    });

    setSubstituicoes(novasSubstituicoes.slice(0, 5)); // Top 5
  };

  const handleSubstituir = () => {
    const substituicao = substituicoes.find((s) => s.alimento.id === selectedSubstituicao);
    if (substituicao) {
      onSubstituir(substituicao.alimento.id, substituicao.quantidadeEquivalente);
      onOpenChange(false);
    }
  };

  if (!alimentoAtual) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Substituir Alimento</DialogTitle>
          <DialogDescription>
            Alimento atual: <strong>{alimentoAtual.nome}</strong> ({quantidadeAtual}g)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Critério de Equivalência</Label>
            <RadioGroup value={criterio} onValueChange={(value) => setCriterio(value as "kcal" | "cho")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="kcal" id="kcal" />
                <Label htmlFor="kcal" className="font-normal">
                  Por Calorias (kcal) - Melhor para controle energético total
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cho" id="cho" />
                <Label htmlFor="cho" className="font-normal">
                  Por Carboidratos (CHO) - Melhor para controle glicêmico
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {criterio === "kcal"
                ? "Fórmula: Quantidade B = Quantidade A × (kcal A / kcal B)"
                : "Fórmula: Quantidade B = Quantidade A × (CHO A / CHO B)"}
            </AlertDescription>
          </Alert>

          {substituicoes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma substituição disponível do mesmo grupo alimentar.
            </p>
          ) : (
            <RadioGroup value={selectedSubstituicao} onValueChange={setSelectedSubstituicao}>
              <div className="space-y-3">
                {substituicoes.map((sub) => (
                  <div
                    key={sub.alimento.id}
                    className="flex items-center space-x-3 border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  >
                    <RadioGroupItem value={sub.alimento.id} id={sub.alimento.id} />
                    <Label
                      htmlFor={sub.alimento.id}
                      className="flex-1 cursor-pointer font-normal space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{sub.alimento.nome}</span>
                        <Badge variant="secondary" className="text-xs">
                          {sub.quantidadeEquivalente.toFixed(0)}g
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {getMacroGroup(sub.alimento)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{sub.formula}</p>
                      <div className="flex gap-4 text-xs">
                        <span>
                          {((sub.alimento.calories / sub.alimento.portion) * sub.quantidadeEquivalente).toFixed(1)} kcal
                        </span>
                        <span>
                          CHO: {((sub.alimento.carbs / sub.alimento.portion) * sub.quantidadeEquivalente).toFixed(1)}g
                        </span>
                        <span>
                          PTN: {((sub.alimento.protein / sub.alimento.portion) * sub.quantidadeEquivalente).toFixed(1)}g
                        </span>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubstituir} disabled={!selectedSubstituicao}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Substituir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
