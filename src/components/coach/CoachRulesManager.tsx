import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { CoachRule, CoachRuleDomain, CoachRuleInput, CoachRuleTrigger } from "@/types/coach-rule";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { confirmDelete, useConfirm } from "@/contexts/ConfirmContext";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

const DOMAIN_OPTIONS: Array<{ id: CoachRuleDomain; label: string }> = [
  { id: "general", label: "Geral" },
  { id: "nutrition", label: "Nutrição" },
  { id: "training", label: "Treino" },
  { id: "checkin", label: "Check-in" },
  { id: "communication", label: "Comunicação" },
  { id: "free_meal", label: "Refeição livre" },
];

const TRIGGER_OPTIONS: Array<{ id: CoachRuleTrigger; label: string }> = [
  { id: "always", label: "Sempre" },
  { id: "restaurant", label: "Restaurante" },
  { id: "substitution", label: "Substituição" },
  { id: "workout", label: "Treino" },
  { id: "late", label: "Atraso" },
  { id: "complete", label: "Conclusão" },
  { id: "checkin", label: "Check-in" },
];

const EMPTY: CoachRuleInput = {
  domain: "general",
  trigger: "always",
  title: "",
  body: "",
  priority: 100,
};

function domainLabel(id: string) {
  return DOMAIN_OPTIONS.find((d) => d.id === id)?.label ?? id;
}

function triggerLabel(id: string) {
  return TRIGGER_OPTIONS.find((t) => t.id === id)?.label ?? id;
}

export default function CoachRulesManager() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState<CoachRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CoachRuleInput>(EMPTY);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getCoachRulesSafe(true);
    if (res.success === false) {
      toast({
        title: "Regras do método",
        description: res.error || "Não foi possível carregar as regras.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    setItems(Array.isArray(res.data.items) ? res.data.items : []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setForm(EMPTY);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (rule: CoachRule) => {
    setEditingId(rule.id);
    setForm({
      domain: rule.domain,
      trigger: rule.trigger,
      title: rule.title,
      body: rule.body,
      priority: rule.priority,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const title = form.title.trim();
    const body = form.body.trim();
    if (!title || !body) {
      toast({
        title: "Campos obrigatórios",
        description: "Título e texto da regra são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    if (body.length > 500) {
      toast({
        title: "Texto longo demais",
        description: "A regra deve ter no máximo 500 caracteres.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      title,
      body,
      priority: Number(form.priority) || 100,
    };
    const res = editingId
      ? await apiClient.updateCoachRuleSafe(editingId, payload)
      : await apiClient.createCoachRuleSafe(payload);
    setSaving(false);
    if (res.success === false) {
      toast({
        title: "Não foi possível guardar",
        description: res.error,
        variant: "destructive",
      });
      return;
    }
    toast({ title: editingId ? "Regra actualizada" : "Regra criada" });
    resetForm();
    await load();
  };

  const handleToggle = async (rule: CoachRule, active: boolean) => {
    const res = await apiClient.updateCoachRuleSafe(rule.id, { active });
    if (res.success === false) {
      toast({ title: "Falha ao actualizar", description: res.error, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active } : r)));
  };

  const handleDelete = async (rule: CoachRule) => {
    const ok = await confirmDelete(
      confirm,
      `Remover a regra «${rule.title}»? O Coleman deixa de a usar.`,
    );
    if (!ok) return;
    const res = await apiClient.deleteCoachRuleSafe(rule.id);
    if (res.success === false) {
      toast({ title: "Falha ao remover", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Regra removida" });
    if (editingId === rule.id) resetForm();
    await load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Método (regras do Coleman)</CardTitle>
            <CardDescription>
              Frases curtas que o agente do aluno já lê. O plano estruturado (dieta/treino) prevalece em conflito.
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY);
              setShowForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova regra
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">{editingId ? "Editar regra" : "Nova regra"}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="rule-title">Título</Label>
                  <Input
                    id="rule-title"
                    maxLength={120}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rule-priority">Prioridade (menor = primeiro)</Label>
                  <Input
                    id="rule-priority"
                    type="number"
                    min={0}
                    max={1000}
                    value={form.priority ?? 100}
                    onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rule-domain">Domínio</Label>
                  <select
                    id="rule-domain"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.domain}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, domain: e.target.value as CoachRuleDomain }))
                    }
                  >
                    {DOMAIN_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rule-trigger">Quando</Label>
                  <select
                    id="rule-trigger"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.trigger}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, trigger: e.target.value as CoachRuleTrigger }))
                    }
                  >
                    {TRIGGER_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-body">Texto (máx. 500)</Label>
                <Textarea
                  id="rule-body"
                  maxLength={500}
                  rows={3}
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">{form.body.length}/500</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
                  Guardar
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há regras. O Coleman usa só o plano estruturado até criares a primeira.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((rule) => (
                <li
                  key={rule.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{rule.title}</p>
                      <Badge variant="outline">{domainLabel(rule.domain)}</Badge>
                      <Badge variant="secondary">{triggerLabel(rule.trigger)}</Badge>
                      {rule.source === "seed_refeicao_livre" && (
                        <Badge variant="outline">Seed dieta</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{rule.body}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      checked={rule.active !== false}
                      onCheckedChange={(v) => void handleToggle(rule, v)}
                      aria-label={rule.active ? "Desactivar regra" : "Activar regra"}
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => startEdit(rule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => void handleDelete(rule)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
