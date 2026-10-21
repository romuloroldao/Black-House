import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import type { FoodCatalogItem, FoodCatalogUpsertPayload, FoodTipo, FoodUsage } from '../types/food-catalog';
import {
  checkFoodDuplicateSafe,
  createFoodCatalogSafe,
  getFoodUsageSafe,
  kcalFromMacros,
  updateFoodCatalogSafe,
} from '../lib/food-catalog-api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  food: FoodCatalogItem | null;
  tipos: FoodTipo[];
  onSaved: () => void;
};

const emptyForm = (): FoodCatalogUpsertPayload => ({
  nome: '',
  tipo_id: '',
  unidade_referencia: 'g',
  quantidade_referencia_g: 100,
  ptn_por_referencia: 0,
  cho_por_referencia: 0,
  lip_por_referencia: 0,
  alcool_por_referencia: 0,
  fibra_por_referencia: 0,
  acucar_por_referencia: 0,
  sodio_por_referencia_mg: 0,
  origem_ptn: 'Mista',
  info_adicional: '',
  motivo_alteracao: '',
  propagar_dietas_activas: false,
});

export default function FoodEditSheet({ open, onOpenChange, food, tipos, onSaved }: Props) {
  const [form, setForm] = useState<FoodCatalogUpsertPayload>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState<FoodUsage | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const isEdit = Boolean(food?.id);
  const kcalCalc = kcalFromMacros(
    form.ptn_por_referencia || 0,
    form.cho_por_referencia || 0,
    form.lip_por_referencia || 0,
    form.alcool_por_referencia || 0,
  );

  useEffect(() => {
    if (!open) return;
    if (food) {
      setForm({
        nome: food.name,
        tipo_id: food.tipo_id || '',
        unidade_referencia: (food.unidade_referencia as 'g' | 'ml' | 'un') || 'g',
        quantidade_referencia_g: food.portion || 100,
        ptn_por_referencia: food.protein,
        cho_por_referencia: food.carbs,
        lip_por_referencia: food.fat,
        alcool_por_referencia: food.alcohol || 0,
        fibra_por_referencia: food.fibra_por_referencia || 0,
        acucar_por_referencia: food.acucar_por_referencia || 0,
        sodio_por_referencia_mg: food.sodio_por_referencia_mg || 0,
        origem_ptn: food.origem_ptn || 'Mista',
        info_adicional: '',
        motivo_alteracao: '',
        propagar_dietas_activas: false,
      });
      void getFoodUsageSafe(food.id).then((r) => {
        if (r.success && r.data) setUsage(r.data);
      });
    } else {
      setForm(emptyForm());
      setUsage(null);
    }
    setDuplicateWarning(null);
  }, [open, food]);

  const checkDuplicate = useCallback(async (nome: string) => {
    if (nome.trim().length < 3) {
      setDuplicateWarning(null);
      return;
    }
    const res = await checkFoodDuplicateSafe(nome, food?.id);
    if (!res.success || !res.data) return;
    if (res.data.exact && res.data.exactMatch) {
      setDuplicateWarning(`Já existe: "${res.data.exactMatch.name}"`);
    } else if (res.data.candidates.length > 0) {
      setDuplicateWarning(`Similar: "${res.data.candidates[0].name}"`);
    } else {
      setDuplicateWarning(null);
    }
  }, [food?.id]);

  const handleSave = async () => {
    if (!form.nome?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (!form.tipo_id) {
      toast.error('Selecione uma categoria');
      return;
    }
    if (isEdit && !form.motivo_alteracao?.trim()) {
      const nutrientChanged =
        food &&
        (food.protein !== form.ptn_por_referencia ||
          food.carbs !== form.cho_por_referencia ||
          food.fat !== form.lip_por_referencia ||
          food.portion !== form.quantidade_referencia_g);
      if (nutrientChanged) {
        toast.error('Informe o motivo da alteração nutricional');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = { ...form, nome: form.nome.trim() };
      const result = isEdit && food
        ? await updateFoodCatalogSafe(food.id, payload)
        : await createFoodCatalogSafe(payload);

      if (!result.success) throw new Error(result.error || 'Erro ao salvar');

      toast.success(isEdit ? 'Alimento actualizado' : 'Alimento criado');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar alimento' : 'Novo alimento'}</SheetTitle>
          <SheetDescription>
            {isEdit && usage
              ? `Usado em ${usage.dietas} dietas · ${usage.alunos} alunos`
              : 'Preencha os dados nutricionais por porção de referência'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={form.nome}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, nome: v }));
                void checkDuplicate(v);
              }}
              placeholder="Ex: Frango grelhado"
            />
            {duplicateWarning && (
              <p className="text-xs text-amber-600">{duplicateWarning}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={form.tipo_id} onValueChange={(v) => setForm((f) => ({ ...f, tipo_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome_tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Porção</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={form.quantidade_referencia_g}
                  onChange={(e) => setForm((f) => ({ ...f, quantidade_referencia_g: Number(e.target.value) }))}
                />
                <Select
                  value={form.unidade_referencia}
                  onValueChange={(v: 'g' | 'ml' | 'un') => setForm((f) => ({ ...f, unidade_referencia: v }))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="un">un</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Macros</span>
              <Badge variant="secondary">{kcalCalc.toFixed(1)} kcal calc.</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['PTN (g)', 'ptn_por_referencia'],
                ['CHO (g)', 'cho_por_referencia'],
                ['LIP (g)', 'lip_por_referencia'],
                ['Álcool (g)', 'alcool_por_referencia'],
                ['Fibra (g)', 'fibra_por_referencia'],
                ['Açúcar (g)', 'acucar_por_referencia'],
                ['Sódio (mg)', 'sodio_por_referencia_mg'],
              ] as const).map(([label, key]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form[key] ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => toast.info(`Kcal calculada: ${kcalCalc.toFixed(1)}`)}
            >
              <Calculator className="h-4 w-4" />
              Ver cálculo energético
            </Button>
          </div>

          {isEdit && (
            <>
              <div className="space-y-2">
                <Label>Motivo da alteração</Label>
                <Input
                  value={form.motivo_alteracao || ''}
                  onChange={(e) => setForm((f) => ({ ...f, motivo_alteracao: e.target.value }))}
                  placeholder="Ex: Correcção conforme TACO"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Propagar para dietas activas</p>
                  <p className="text-xs text-muted-foreground">Actualiza snapshots nas dietas activas</p>
                </div>
                <Switch
                  checked={Boolean(form.propagar_dietas_activas)}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, propagar_dietas_activas: v }))}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.info_adicional || ''}
              onChange={(e) => setForm((f) => ({ ...f, info_adicional: e.target.value }))}
              rows={2}
            />
          </div>

          {isEdit && usage && usage.dietas > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Por defeito, alterações só afectam <strong>novas</strong> dietas. Dietas existentes mantêm o snapshot nutricional.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'A guardar...' : isEdit ? 'Salvar alterações' : 'Criar alimento'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
