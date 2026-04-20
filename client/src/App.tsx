import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetails from "@/pages/ProjectDetails";
import FileManager from "@/pages/FileManager";
import Audit from "@/pages/Audit";
import Downloads from "@/pages/Downloads";
import NotFound from "@/pages/not-found";

interface AuthStatus {
  authenticated: boolean;
  connectionType?: "ftp" | "sftp" | "none";
  host?: string;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: authStatus, isLoading } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/status"],
  });
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const isConnected = authStatus?.connectionType && authStatus.connectionType !== "none";

  if (!isConnected) {
    setLocation("/");
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/projects">
        <ProtectedRoute component={Projects} />
      </Route>
      <Route path="/project/:id">
        <ProtectedRoute component={ProjectDetails} />
      </Route>
      <Route path="/files">
        <ProtectedRoute component={FileManager} />
      </Route>
      <Route path="/audit">
        <ProtectedRoute component={Audit} />
      </Route>
      <Route path="/downloads">
        <ProtectedRoute component={Downloads} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
