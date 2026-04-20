import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Server, Shield, Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import unigenomeLogo from "@assets/image_1769856125829.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("client");

  // Client FTP form state
  const [clientPassword, setClientPassword] = useState("");

  // Admin SFTP form state
  const [adminHost, setAdminHost] = useState("");
  const [adminPort, setAdminPort] = useState("22");
  const [adminUser, setAdminUser] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const connectMutation = useMutation({
    mutationFn: async (data: { host: string; port: number; user: string; password: string; type: "ftp" | "sftp" }) => {
      const res = await fetch("/api/ftp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Connection failed");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
      toast({
        title: "Connected",
        description: "Successfully connected to the server.",
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClientLogin = (e: React.FormEvent) => {
    e.preventDefault();
    connectMutation.mutate({
      host: "120.72.93.162",
      port: 9091,
      user: "client",
      password: clientPassword,
      type: "ftp",
    });
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    connectMutation.mutate({
      host: adminHost,
      port: parseInt(adminPort) || 22,
      user: adminUser,
      password: adminPassword,
      type: "sftp",
    });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel: Hero with Unigenome Branding */}
      <div className="hidden lg:flex flex-col justify-center p-12 relative overflow-hidden" style={{ backgroundColor: '#1a2744' }}>
        <div className="absolute inset-0 opacity-10" 
             style={{ 
               backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", 
               backgroundSize: "32px 32px" 
             }} 
        />
        
        <div className="relative z-10 max-w-lg space-y-6">
          <div className="mb-8">
            <img 
              src={unigenomeLogo} 
              alt="Unigenome - Leading Genomics Innovations" 
              className="h-16 object-contain"
              data-testid="logo-login"
            />
          </div>
          
          <h2 className="text-4xl font-bold leading-tight text-white">
            Secure File <br />
            Transfer Portal
          </h2>
          <p className="text-lg text-gray-300">
            Access your genomics data deliverables securely. All file transfers are encrypted and logged for compliance.
          </p>

          <div className="flex flex-wrap gap-4 pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Server className="w-4 h-4 text-orange-400" />
              FTP/SFTP Support
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Shield className="w-4 h-4 text-orange-400" />
              End-to-End Encryption
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="flex items-center justify-center p-6 bg-background">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <img 
              src={unigenomeLogo} 
              alt="Unigenome" 
              className="h-12 object-contain"
            />
          </div>

          <Card className="border-border/50 shadow-2xl shadow-primary/5">
            <CardHeader className="space-y-1 text-center pb-6">
              <CardTitle className="text-2xl font-bold">Welcome</CardTitle>
              <CardDescription>
                Connect to access your files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 p-1 bg-muted/50">
                  <TabsTrigger 
                    value="client" 
                    className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    data-testid="tab-client"
                  >
                    Client Portal
                  </TabsTrigger>
                  <TabsTrigger 
                    value="admin" 
                    className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    data-testid="tab-admin"
                  >
                    Administrator
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="client">
                  <form onSubmit={handleClientLogin} className="space-y-4">
                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 flex items-start gap-3">
                      <Server className="w-5 h-5 mt-0.5 text-blue-600 shrink-0" />
                      <div>
                        <span className="font-semibold block mb-1">Client FTP Access</span>
                        Connecting to ftp://120.72.93.162:9091
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="client-password">Password</Label>
                      <Input 
                        id="client-password" 
                        type="password" 
                        value={clientPassword}
                        onChange={(e) => setClientPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="bg-muted/30"
                        data-testid="input-client-password"
                        required
                      />
                    </div>

                    <Button 
                      type="submit"
                      className="w-full h-12 text-base mt-4 bg-orange-500 hover:bg-orange-600"
                      disabled={connectMutation.isPending}
                      data-testid="button-client-connect"
                    >
                      {connectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Connect
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="admin">
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-4 text-sm text-purple-800 flex items-start gap-3">
                      <Shield className="w-5 h-5 mt-0.5 text-purple-600 shrink-0" />
                      <div>
                        <span className="font-semibold block mb-1">Admin SFTP Access</span>
                        Configure your SFTP server connection
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="admin-host">Host</Label>
                        <Input 
                          id="admin-host" 
                          type="text" 
                          value={adminHost}
                          onChange={(e) => setAdminHost(e.target.value)}
                          placeholder="sftp.example.com"
                          className="bg-muted/30"
                          data-testid="input-admin-host"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-port">Port</Label>
                        <Input 
                          id="admin-port" 
                          type="number" 
                          value={adminPort}
                          onChange={(e) => setAdminPort(e.target.value)}
                          placeholder="22"
                          className="bg-muted/30"
                          data-testid="input-admin-port"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="admin-user">Username</Label>
                      <Input 
                        id="admin-user" 
                        type="text" 
                        value={adminUser}
                        onChange={(e) => setAdminUser(e.target.value)}
                        placeholder="admin"
                        className="bg-muted/30"
                        data-testid="input-admin-user"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="admin-password">Password</Label>
                      <Input 
                        id="admin-password" 
                        type="password" 
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Enter password"
                        className="bg-muted/30"
                        data-testid="input-admin-password"
                        required
                      />
                    </div>

                    <Button 
                      type="submit"
                      className="w-full h-12 text-base mt-4 bg-orange-500 hover:bg-orange-600"
                      disabled={connectMutation.isPending}
                      data-testid="button-admin-connect"
                    >
                      {connectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Connect via SFTP
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
