import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { API_CONTRACT } from "@/contracts/api-contract";
import { FinancialPageLayout } from "./FinancialPageLayout";
import { IntegrationHealthBanner } from "./IntegrationHealthBanner";
import { useFinancialHealth } from "@/hooks/useFinancialData";
import { RefreshCw } from "lucide-react";

export default function AsaasIntegrationPage() {
  const { user } = useAuth();
  const { data: health, refetch: refetchHealth } = useFinancialHealth();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [asaasConfig, setAsaasConfig] = useState<any>(null);
  const [asaasApiKey, setAsaasApiKey] = useState("");
  const [asaasIsSandbox, setAsaasIsSandbox] = useState(true);

  const loadAsaasConfig = async () => {
    if (!user) return;
    const q = user.role === "admin" ? `?coach_id=${encodeURIComponent(user.id)}` : "";
    const result = await apiClient.requestSafe<any[]>(`/api/asaas-config${q}`);
    const data = result.success && Array.isArray(result.data) ? result.data : [];
    setAsaasConfig(data.length > 0 ? data[0] : null);
  };

  useEffect(() => {
    loadAsaasConfig();
  }, [user]);

  useEffect(() => {
    if (asaasConfig && typeof asaasConfig.is_sandbox === "boolean") {
      setAsaasIsSandbox(!!asaasConfig.is_sandbox);
    }
  }, [asaasConfig]);

  const handleVerify = async () => {
    setLoading(true);
    const trimmed = asaasApiKey.trim();
    const body: Record<string, unknown> = { is_sandbox: asaasIsSandbox };
    if (trimmed) body.asaas_api_key = trimmed;
    else if (!asaasConfig?.has_api_key) {
      toast.error("Informe a chave API para testar.");
      setLoading(false);
      return;
    }
    const result = await apiClient.requestSafe(API_CONTRACT.asaasConfig.verifyConnection(), {
      method: "POST",
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (result.success) {
      toast.success("Ligação OK com Asaas.");
    } else {
      toast.error(result.error || "Falha na ligação");
    }
  };

  const handleSave = async () => {
    const key = asaasApiKey.trim();
    if (!key) {
      toast.error("Cole a chave API do Asaas.");
      return;
    }
    setLoading(true);
    const result = await apiClient.requestSafe("/api/asaas-config", {
      method: "POST",
      body: JSON.stringify({ asaas_api_key: key, is_sandbox: asaasIsSandbox, coach_id: user?.id }),
    });
    setLoading(false);
    if (!result.success) {
      toast.error(result.error || "Erro ao guardar");
      return;
    }
    setAsaasApiKey("");
    setAsaasConfig(result.data);
    toast.success("Asaas configurado.");
    await loadAsaasConfig();
  };

  const handleSync = async () => {
    setSyncing(true);
    const result = await apiClient.requestSafe("/api/financial/sync", { method: "POST" });
    setSyncing(false);
    if (result.success) {
      toast.success("Sincronização iniciada.");
      refetchHealth();
    } else {
      toast.error(result.error || "Erro ao sincronizar");
    }
  };

  const persistSandbox = async (sandbox: boolean) => {
    if (!asaasConfig?.id) {
      setAsaasIsSandbox(sandbox);
      return;
    }
    const result = await apiClient.requestSafe(`/api/asaas-config/${asaasConfig.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_sandbox: sandbox }),
    });
    if (result.success) {
      setAsaasIsSandbox(sandbox);
      setAsaasConfig((prev: any) => (prev ? { ...prev, is_sandbox: sandbox } : prev));
    } else {
      toast.error(result.error || "Erro ao atualizar ambiente");
    }
  };

  return (
    <FinancialPageLayout
      title="Integração Asaas"
      description="Configure e monitore a sincronização com o Asaas"
      actions={
        <Button variant="outline" onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "motion-safe:animate-spin" : ""}`} />
          Sincronizar agora
        </Button>
      }
    >
      <IntegrationHealthBanner health={health ?? null} />

      <Card>
        <CardHeader>
          <CardTitle>Conexão Asaas</CardTitle>
          <CardDescription>
            Pagamentos e cobranças usam esta conta Asaas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label>Estado</Label>
                {asaasConfig && (
                  <Badge variant={asaasConfig.is_sandbox ? "secondary" : "default"}>
                    {asaasConfig.is_sandbox ? "Sandbox" : "Produção"}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {asaasConfig?.has_api_key
                  ? "Chave API guardada no servidor."
                  : "Configure sua chave API abaixo."}
              </p>
            </div>
            <Button variant="outline" onClick={handleVerify} disabled={loading}>
              Testar ligação
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="asaas-sandbox-fin">Sandbox</Label>
              <p className="text-sm text-muted-foreground">Ambiente de testes Asaas</p>
            </div>
            <Switch
              id="asaas-sandbox-fin"
              checked={asaasIsSandbox}
              onCheckedChange={(c) => void persistSandbox(c)}
              disabled={loading}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="asaas-key-fin">Chave API Asaas</Label>
            <Input
              id="asaas-key-fin"
              type="password"
              autoComplete="off"
              placeholder={asaasConfig?.has_api_key ? "Nova chave (opcional)" : "Cole sua chave API"}
              value={asaasApiKey}
              onChange={(e) => setAsaasApiKey(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={handleVerify} disabled={loading}>
                Testar
              </Button>
              <Button onClick={handleSave} disabled={loading || !asaasApiKey.trim()}>
                {asaasConfig ? "Atualizar chave" : "Configurar Asaas"}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            A chave é armazenada cifrada no servidor. Também disponível em Configurações gerais → Integrações.
          </p>
        </CardContent>
      </Card>
    </FinancialPageLayout>
  );
}
