import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { DataContextProvider } from "./contexts/DataContext";
import { BootstrapGuard } from "./components/BootstrapScreen";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import StudentDetails from "./components/StudentDetails";
import DietaPage from "./pages/DietaPage";
import StudentPortal from "./pages/StudentPortal";
import StudentBlocked from "./pages/StudentBlocked";
import ReportViewPage from "./pages/ReportViewPage";

const queryClient = new QueryClient();

// RBAC-01: Rotas separadas por role (coach vs aluno)
// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Bootstrap com lock de contexto de dados
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DataContextProvider>
        <BootstrapGuard>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Rotas públicas */}
                <Route path="/auth" element={<Auth />} />
                
                {/* Rotas do COACH (base '/') */}
                <Route 
                  path="/" 
                  element={
                    <ProtectedRoute allowedRoles={['coach']}>
                      <Index />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/alunos/:id" 
                  element={
                    <ProtectedRoute allowedRoles={['coach']}>
                      <StudentDetails />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/dieta/:id" 
                  element={
                    <ProtectedRoute allowedRoles={['coach']}>
                      <DietaPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/report/:id" 
                  element={
                    <ProtectedRoute allowedRoles={['coach']}>
                      <ReportViewPage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Rotas do ALUNO (base '/portal-aluno') */}
                <Route 
                  path="/portal-aluno/blocked" 
                  element={
                    <ProtectedRoute allowedRoles={['aluno']} checkPayment={false}>
                      <StudentBlocked />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/portal-aluno/*" 
                  element={
                    <ProtectedRoute allowedRoles={['aluno']} checkPayment={true}>
                      <StudentPortal />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Rotas legacy (redirecionamento automático via ProtectedRoute) */}
                <Route 
                  path="/aluno" 
                  element={
                    <ProtectedRoute allowedRoles={['aluno']} checkPayment={true}>
                      <StudentPortal />
                    </ProtectedRoute>
                  } 
                />
                
                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </BootstrapGuard>
      </DataContextProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
