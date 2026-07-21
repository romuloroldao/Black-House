import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, LogOut } from "lucide-react";
import {
  ACESSO_OPERACIONAL_LABELS,
  normalizeAcessoOperacional,
} from "@/lib/aluno-acesso-operacional";

/**
 * Bloqueio operacional (coach suspendeu/revogou/ainda não concedeu).
 * Separado do bloqueio financeiro em StudentBlocked.
 */
const StudentAccessBlocked = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const acesso = normalizeAcessoOperacional(user?.acesso_operacional);
  const reason = user?.access_block_reason as string | undefined;

  let title = "Acesso indisponível";
  let body =
    "Neste momento não tem acesso ao portal. Contacte o seu coach para mais informações.";

  if (reason === "not_linked") {
    title = "Perfil não vinculado";
    body =
      "A sua conta ainda não está vinculada a uma ficha de aluno. Peça ao coach para vincular o seu cadastro.";
  } else if (acesso === "pending") {
    title = "Acesso pendente";
    body =
      "O seu coach ainda não liberou o acesso à plataforma. Quando for concedido, poderá entrar normalmente.";
  } else if (acesso === "suspended") {
    title = "Acesso suspenso";
    body =
      "O seu acesso está temporariamente suspenso pelo coach. Os seus dados permanecem guardados.";
  } else if (acesso === "revoked") {
    title = "Acesso revogado";
    body =
      "O acesso à plataforma foi revogado. Os seus dados históricos não foram apagados — contacte o coach se precisar de reactivar.";
  }

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">{body}</p>
          <p className="text-xs text-muted-foreground">
            Estado: {ACESSO_OPERACIONAL_LABELS[acesso]}
            {reason ? ` · motivo: ${reason}` : ""}
          </p>
          <div className="flex flex-col gap-2 pt-4">
            <Button variant="outline" onClick={handleLogout} className="w-full gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentAccessBlocked;
