import { useRoute } from "wouter";
import { useProject } from "@/hooks/use-projects";
import { useProjectFiles } from "@/hooks/use-files";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Folder, 
  Download, 
  ChevronRight, 
  Home, 
  MoreHorizontal,
  File,
  HardDrive
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

export default function ProjectDetails() {
  const [, params] = useRoute("/project/:id");
  const projectId = params ? parseInt(params.id) : 0;
  
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: files, isLoading: filesLoading } = useProjectFiles(projectId);
  
  // Simple state for "current folder" navigation mock
  const [currentPath, setCurrentPath] = useState<string[]>([]);

  if (projectLoading) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!project) return <Layout><div>Project not found</div></Layout>;

  // Filter files based on basic logic (in a real app, parentId would guide this)
  // For this mock, we just show all if at root, or filter if we had hierarchical data
  const visibleFiles = files || []; 

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Home className="w-4 h-4" />
              <ChevronRight className="w-3 h-3" />
              <span>Projects</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-medium">{project.name}</span>
            </div>
            <h1 className="text-3xl font-bold font-display">{project.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-8 px-3">{project.status}</Badge>
            <Button>
              <HardDrive className="w-4 h-4 mr-2" />
              Upload Files
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
          {/* Left Panel: Metadata */}
          <Card className="h-fit shadow-md border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
                <p className="text-sm mt-1 text-foreground/80 leading-relaxed">
                  {project.description || "No description provided."}
                </p>
              </div>
              <div className="h-px bg-border/50" />
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</label>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                    CL
                  </div>
                  <span className="text-sm font-medium">Client #{project.clientId}</span>
                </div>
              </div>
              <div className="h-px bg-border/50" />
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</label>
                <p className="text-sm mt-1 font-mono">
                  {project.createdAt ? format(new Date(project.createdAt), 'PPP') : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Right Panel: File Manager */}
          <Card className="lg:col-span-3 flex flex-col shadow-md border-border/60 overflow-hidden bg-white/50 backdrop-blur-sm">
            {/* File Manager Toolbar */}
            <div className="p-4 border-b flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setCurrentPath([])}
                  className={currentPath.length === 0 ? "bg-white shadow-sm" : "text-muted-foreground"}
                >
                  Root
                </Button>
                {currentPath.map((folder, i) => (
                  <div key={i} className="flex items-center">
                    <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
                    <Button variant="ghost" size="sm" className="text-sm">
                      {folder}
                    </Button>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                {visibleFiles.length} items
              </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-auto p-4">
              {filesLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : visibleFiles.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                  <Folder className="w-16 h-16 mb-4 stroke-1" />
                  <p>No files in this directory</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {visibleFiles.map((file) => (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={file.id}
                      className="group flex items-center justify-between p-3 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-border/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${file.type === 'directory' ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                          {file.type === 'directory' ? <Folder className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {file.size ? `${(file.size / 1024).toFixed(1)} KB` : '--'} • {format(new Date(file.createdAt || new Date()), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
