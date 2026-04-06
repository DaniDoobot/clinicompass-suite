import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PipelinePage from "./pages/PipelinePage";
import LeadsPage from "./pages/LeadsPage";
import PatientsPage from "./pages/PatientsPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import AgendaPage from "./pages/AgendaPage";
import CentersPage from "./pages/CentersPage";
import PhysioPage from "./pages/PhysioPage";
import NutritionPage from "./pages/NutritionPage";
import PsychotechPage from "./pages/PsychotechPage";
import CampaignsPage from "./pages/CampaignsPage";
import BillingPage from "./pages/BillingPage";
import DocumentsPage from "./pages/DocumentsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/pipeline" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
            <Route path="/pacientes" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
            <Route path="/pacientes/:id" element={<ProtectedRoute><PatientDetailPage /></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute><AgendaPage /></ProtectedRoute>} />
            <Route path="/centros" element={<ProtectedRoute><CentersPage /></ProtectedRoute>} />
            <Route path="/fisioterapia" element={<ProtectedRoute><PhysioPage /></ProtectedRoute>} />
            <Route path="/nutricion" element={<ProtectedRoute><NutritionPage /></ProtectedRoute>} />
            <Route path="/psicotecnicos" element={<ProtectedRoute><PsychotechPage /></ProtectedRoute>} />
            <Route path="/campanas" element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>} />
            <Route path="/facturacion" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
            <Route path="/documentos" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
            <Route path="/configuracion" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
