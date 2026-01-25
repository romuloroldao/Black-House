import { useState, useEffect } from 'react';
import { getAllFoodsSafe, Food, getMacroGroup } from '@/lib/foodService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calculator } from 'lucide-react';

interface Substituto {
  nome: string;
  quantidade: string;
  nutrienteDominante: string;
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
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      const ordenados = data.sort((a, b) => a.name.localeCompare(b.name));
      setAlimentos(ordenados);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar alimentos');
    } finally {
      setLoading(false);
    }
  }

  function calcularSubstituicoes(alimentoSelecionado: Food): Substituto[] {
    // Usar KCAL como base de substituição (igual à planilha)
    const kcalOriginalPor100g = (alimentoSelecionado.calories / alimentoSelecionado.portion) * 100;
    
    if (kcalOriginalPor100g === 0) return [];

    const grupoSelecionado = getMacroGroup(alimentoSelecionado);

    return alimentos
      .filter(a => 
        getMacroGroup(a) === grupoSelecionado && 
        a.name !== alimentoSelecionado.name &&
        a.calories > 0
      )
      .map(sub => {
        // Fórmula: Qtd_B = Qtd_A × (kcal_A / kcal_B)
        // Para 100g do alimento original, quanto do substituto é necessário?
        const kcalSubPor100g = (sub.calories / sub.portion) * 100;
        const qtdEquivalente = (kcalOriginalPor100g / kcalSubPor100g) * 100;
        
        return {
          nome: sub.name,
          quantidade: qtdEquivalente.toFixed(0),
          nutrienteDominante: 'Kcal'
        };
      })
      .sort((a, b) => Math.abs(parseFloat(a.quantidade) - 100) - Math.abs(parseFloat(b.quantidade) - 100))
      .slice(0, 3); // Limitar a 3 substitutos
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
          Alimentos com equivalências nutricionais automaticamente calculadas
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
                    {getMacroGroup(alimento)}
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
                              ({sub.nutrienteDominante})
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