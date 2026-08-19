import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Pencil, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const DOMAINS = [
  { value: "general", label: "Geral" },
  { value: "nutrition", label: "Nutrição" },
  { value: "training", label: "Treino" },
  { value: "checkin", label: "Check-in" },
  { value: "communication", label: "Comunicação" },
  { value: "free_meal", label: "Refeição livre" },
] as const;

const TRIGGERS = [
  { value: "always", label: "Sempre" },
  { value: "restaurant", label: "Restaurante" },
  { value: "substitution", label: "Substituição" },
  { value: "workout", label: "Treino" },
  { value: "late", label: "Atraso" },
  { value: "complete", label: "Conclusão" },
  { value: "checkin", label: "Check-in" },
] as const;

const BODY_MAX = 500;

type CoachRule = {
  id: string;
  domain: string;
  trigger: string;
  priority: number;
  title: string;
  body: string;
  active: boolean;
};

type RuleForm = {
  domain: string;
  trigger: string;
  priority: string;
  title: string;
  body: string;
};

const EMPTY_FORM: RuleForm = {
  domain: "general",
  trigger: "always",
  priority: "100",
  title: "",
  body: "",
};

function labelOf(list: readonly { value: string; label: string }[], value: string) {
  return list.find((x) => x.value === value)?.label ?? value;
}

export default function CoachRulesManager() {
  const [items, setItems] = useState<CoachRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CoachRule | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    const res = await apiClient.listCoachRulesSafe(true);
    const list = res.success && Array.isArray(res.data?.items) ? res.data.items : [];
    setItems(list as CoachRule[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (rule: CoachRule) => {
    setEditing(rule);
    setForm({
      domain: rule.domain || "general",
      trigger: rule.trigger || "always",
      priority: String(rule.priority ?? 100),
      title: rule.title || "",
      body: rule.body || "",
    });
    setDialogOpen(true);
  };

  const bodyLen = form.body.length;
  const canSave = form.title.trim().length > 0 && form.body.trim().length > 0 && bodyLen <= BODY_MAX;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const payload = {
      domain: form.domain,
      trigger: form.trigger,
      priority: Number(form.priority) || 100,
      title: form.title.trim(),
      body: form.body.trim().slice(0, BODY_MAX),
    };
    const res = editing
      ? await apiClient.updateCoachRuleSafe(editing.id, payload)
      : await apiClient.createCoachRuleSafe(payload);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error || "Não foi possível guardar a regra");
      return;
    }
    toast.success(editing ? "Regra actualizada" : "Regra criada");
    setDialogOpen(false);
    await load();
  };

  const handleToggleActive = async (rule: CoachRule) => {
    const next = !rule.active;
    const res = await apiClient.updateCoachRuleSafe(rule.id, { active: next });
    if (!res.success) {
      toast.error(res.error || "Não foi possível alterar o estado");
      return;
    }
    toast.success(next ? "Regra reactivada" : "Regra desactivada");
    await load();
  };

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return (a.priority ?? 100) - (b.priority ?? 100);
      }),
    [items],
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Método do coach
          </CardTitle>
          <CardDescription>
            Regras curtas (sem embeddings) usadas no check-in HITL e no agente do aluno
          </CardDescription>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova regra
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
            A carregar regras…
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não há regras. Crie a primeira.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-col gap-3 rounded-lg border border-border/70 p-4 sm:flex-row sm:items-start"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{rule.title}</span>
                    <Badge variant={rule.active ? "secondary" : "outline"} className="text-xs">
                      {rule.active ? "Activa" : "Inactiva"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {labelOf(DOMAINS, rule.domain)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {labelOf(TRIGGERS, rule.trigger)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">prioridade {rule.priority}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{rule.body}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(rule)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleToggleActive(rule)}>
                    <Power className="mr-1 h-3.5 w-3.5" />
                    {rule.active ? "Desactivar" : "Reactivar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar regra" : "Nova regra"}</DialogTitle>
            <DialogDescription>Domínio, gatilho, título e corpo (máx. {BODY_MAX} caracteres).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rule-domain">Domínio</Label>
                <Select value={form.domain} onValueChange={(v) => setForm((f) => ({ ...f, domain: v }))}>
                  <SelectTrigger id="rule-domain">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOMAINS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-trigger">Gatilho</Label>
                <Select value={form.trigger} onValueChange={(v) => setForm((f) => ({ ...f, trigger: v }))}>
                  <SelectTrigger id="rule-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-priority">Prioridade</Label>
              <Input
                id="rule-priority"
                type="number"
                min={0}
                max={1000}
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-title">Título</Label>
              <Input
                id="rule-title"
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="rule-body">Corpo</Label>
                <span className={`text-xs ${bodyLen > BODY_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                  {bodyLen}/{BODY_MAX}
                </span>
              </div>
              <Textarea
                id="rule-body"
                rows={5}
                maxLength={BODY_MAX}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value.slice(0, BODY_MAX) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={!canSave || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
