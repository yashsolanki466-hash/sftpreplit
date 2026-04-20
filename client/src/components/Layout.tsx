import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  FolderKanban,
  FolderOpen, 
  Download, 
  Activity, 
  Settings,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import unigenomeLogo from "@assets/image_1769856125829.png";

interface AuthStatus {
  authenticated: boolean;
  connectionType?: "ftp" | "sftp" | "none";
  host?: string;
  user?: any;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: authStatus } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/status"],
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ftp/disconnect", { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
      setLocation("/");
    },
  });

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/files", label: "File Manager", icon: FolderOpen },
    { href: "/downloads", label: "Downloads", icon: Download },
    { href: "/audit", label: "Audit", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 md:gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 group shrink-0">
              <img 
                src={unigenomeLogo} 
                alt="Unigenome" 
                className="h-8 object-contain"
                data-testid="logo-unigenome"
              />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location === item.href || location.startsWith(item.href + "/");
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                    className={`
                      px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2
                      ${isActive 
                        ? "bg-orange-50 text-orange-600" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }
                    `}
                  >
                    <item.icon className={`w-4 h-4 ${isActive ? "text-orange-500" : "text-muted-foreground"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection Status Badge */}
            {authStatus?.connectionType && authStatus.connectionType !== "none" && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
                <Wifi className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">
                  {authStatus.connectionType.toUpperCase()} - {authStatus.host}
                </span>
              </div>
            )}

            {/* Settings Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full"
                  data-testid="button-settings"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Connection Status</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {authStatus?.connectionType !== "none" 
                        ? `Connected via ${authStatus?.connectionType?.toUpperCase()}` 
                        : "Not connected"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {authStatus?.host && (
                  <DropdownMenuItem disabled className="flex justify-between">
                    <span>Host</span>
                    <Badge variant="secondary" className="text-xs">{authStatus.host}</Badge>
                  </DropdownMenuItem>
                )}
                {authStatus?.connectionType && authStatus.connectionType !== "none" && (
                  <DropdownMenuItem disabled className="flex justify-between">
                    <span>Protocol</span>
                    <Badge variant="outline" className="text-xs">{authStatus.connectionType.toUpperCase()}</Badge>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => disconnectMutation.mutate()}
                  data-testid="button-disconnect"
                >
                  <WifiOff className="w-4 h-4 mr-2" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden border-b bg-background px-4 py-4 space-y-2 shadow-lg"
          >
            {navItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href} 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-colors
                  ${location === item.href ? "bg-orange-50 text-orange-600 font-medium" : "text-muted-foreground hover:bg-muted"}
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
            <div className="pt-2 mt-2 border-t">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => disconnectMutation.mutate()}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 container mx-auto px-4 py-8 animate-fade-in-up">
        {children}
      </main>
    </div>
  );
}
