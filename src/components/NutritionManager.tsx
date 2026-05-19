import { useState, useEffect } from 'react';
import {
  getAllFoodsSafe,
  Food,
  getSubstitutionCategoryLabel,
} from '@/lib/foodService';
import { listarSubstituicoesIsocaloricas } from '@/lib/foodEquivalence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calculator } from 'lucide-react';

interface Substituto {
  nome: string;
  quantidade: string;
  kcal: string;
}

const NutritionManager = () => {
  const [alimentos, setAlimentos] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    carregarAlimentos();
  }, []);

  async function carregarAlimentos() {
    try {
      const result = await getAllFoodsSafe();
      if (!result.success) {
        setError(result.error || 'Erro ao carregar alimentos');
        setAlimentos([]);
        return;
      }
      const data = Array.isArray(result.data) ? result.data : [];
      const ordenados = [...data].sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'),
      );
      setAlimentos(ordenados);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar alimentos');
    } finally {
      setLoading(false);
    }
  }

  function calcularSubstituicoes(alimentoSelecionado: Food): Substituto[] {
    return listarSubstituicoesIsocaloricas(
      alimentoSelecionado,
      100,
      'g',
      alimentos,
      { limit: 3 },
    ).map((s) => ({
      nome: s.alimento.name,
      quantidade: s.quantidadeEquivalente.toFixed(0),
      kcal: s.kcalEquivalente.toFixed(0),
    }));
  }

  function getNutrienteBadgeColor(alimento: Food) {
    const maxMacro = Math.max(
      alimento.protein,
      alimento.carbs,
      alimento.fat
    );
    
    if (maxMacro === alimento.protein) {
      return 'bg-primary/20 text-primary border-primary/30';
    } else if (maxMacro === alimento.carbs) {
      return 'bg-warning/20 text-warning border-warning/30';
    } else {
      return 'bg-destructive/20 text-destructive border-destructive/30';
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Erro ao carregar alimentos: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Lista de Alimentos e Substituições
        </h1>
        <p className="text-muted-foreground mt-2">
          Substituição isocalórica por grupo alimentar (planilha de equivalência)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {alimentos.map((alimento) => {
          const substituicoes = calcularSubstituicoes(alimento);
          
          return (
            <Card key={alimento.id} className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-card-foreground">
                    {alimento.name}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={getNutrienteBadgeColor(alimento)}
                  >
                    {getSubstitutionCategoryLabel('', alimento)}
                  </Badge>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{alimento.calories} kcal</span>
                  <span>{alimento.protein}g proteínas</span>
                  <span>{alimento.carbs}g carb</span>
                  <span>{alimento.fat}g lip</span>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {substituicoes.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                      <Calculator className="w-4 h-4" />
                      Substitutos equivalentes:
                    </div>
                    <div className="space-y-2">
                      {substituicoes.map((sub, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50"
                        >
                          <span className="font-medium text-card-foreground">
                            {sub.nome}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-primary font-semibold">
                              {sub.quantidade} g/ml
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({sub.kcal} kcal)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Nenhum substituto disponível no mesmo grupo
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {alimentos.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Nenhum alimento encontrado na base de dados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NutritionManager;