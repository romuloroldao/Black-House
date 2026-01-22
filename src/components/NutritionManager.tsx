import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calculator } from 'lucide-react';

interface Alimento {
  id: string;
  nome: string;
  quantidade_referencia_g: number;
  kcal_por_referencia: number;
  cho_por_referencia: number;
  ptn_por_referencia: number;
  lip_por_referencia: number;
  origem_ptn: string;
  tipo_id: string;
  autor?: string;
  info_adicional?: string;
}

interface Substituto {
  nome: string;
  quantidade: string;
  nutrienteDominante: string;
}

const NutritionManager = () => {
  const [alimentos, setAlimentos] = useState<Alimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    carregarAlimentos();
  }, []);

  async function carregarAlimentos() {
    try {
      const data = await apiClient
        .from('alimentos')
        .select('*')
        .order('nome');

      setAlimentos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar alimentos');
    } finally {
      setLoading(false);
    }
  }

  function calcularSubstituicoes(alimentoSelecionado: Alimento): Substituto[] {
    // Usar KCAL como base de substituição (igual à planilha)
    const kcalOriginalPor100g = (alimentoSelecionado.kcal_por_referencia / alimentoSelecionado.quantidade_referencia_g) * 100;
    
    if (kcalOriginalPor100g === 0) return [];

    return alimentos
      .filter(a => 
        a.tipo_id === alimentoSelecionado.tipo_id && 
        a.nome !== alimentoSelecionado.nome &&
        a.kcal_por_referencia > 0
      )
      .map(sub => {
        // Fórmula: Qtd_B = Qtd_A × (kcal_A / kcal_B)
        // Para 100g do alimento original, quanto do substituto é necessário?
        const kcalSubPor100g = (sub.kcal_por_referencia / sub.quantidade_referencia_g) * 100;
        const qtdEquivalente = (kcalOriginalPor100g / kcalSubPor100g) * 100;
        
        return {
          nome: sub.nome,
          quantidade: qtdEquivalente.toFixed(0),
          nutrienteDominante: 'Kcal'
        };
      })
      .sort((a, b) => Math.abs(parseFloat(a.quantidade) - 100) - Math.abs(parseFloat(b.quantidade) - 100))
      .slice(0, 3); // Limitar a 3 substitutos
  }

  function getNutrienteBadgeColor(alimento: Alimento) {
    const maxMacro = Math.max(
      alimento.ptn_por_referencia,
      alimento.cho_por_referencia,
      alimento.lip_por_referencia
    );
    
    if (maxMacro === alimento.ptn_por_referencia) {
      return 'bg-primary/20 text-primary border-primary/30';
    } else if (maxMacro === alimento.cho_por_referencia) {
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
                    {alimento.nome}
                  </CardTitle>
                  <Badge 
                    variant="outline" 
                    className={getNutrienteBadgeColor(alimento)}
                  >
                    {alimento.origem_ptn}
                  </Badge>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{alimento.kcal_por_referencia} kcal</span>
                  <span>{alimento.ptn_por_referencia}g proteínas</span>
                  <span>{alimento.cho_por_referencia}g carb</span>
                  <span>{alimento.lip_por_referencia}g lip</span>
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