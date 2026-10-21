import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard, LogOut } from "lucide-react";

// RBAC-01: Tela de bloqueio para alunos inadimplentes
const StudentBlocked = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleViewFinancial = () => {
    navigate('/portal-aluno/financial');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl text-destructive">Acesso Bloqueado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Seu acesso à plataforma está temporariamente suspenso devido a pendências financeiras.
          </p>
          <p className="text-sm text-muted-foreground">
            Para regularizar sua situação e restaurar o acesso, entre em contato com seu coach ou efetue o pagamento das parcelas em aberto.
          </p>
          <div className="flex flex-col gap-2 pt-4">
            <Button 
              onClick={handleViewFinancial}
              className="w-full gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Ver Pendências Financeiras
            </Button>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="w-full gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentBlocked;
