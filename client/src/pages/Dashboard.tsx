import { useProjects } from "@/hooks/use-projects";
import Layout from "@/components/Layout";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { AnalyticsChart } from "@/components/AnalyticsChart";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Folder, Clock, MoreVertical, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: projects, isLoading } = useProjects();

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of your secure workspaces and activity.</p>
          </div>
          <CreateProjectDialog />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content: Projects Grid */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold font-display flex items-center gap-2">
              <Folder className="w-5 h-5 text-primary" />
              Active Projects
            </h2>
            
            {isLoading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-2xl" />
                ))}
              </div>
            ) : projects && projects.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {projects.map((project) => (
                  <Link key={project.id} href={`/project/${project.id}`}>
                    <div className="group cursor-pointer">
                      <Card className="h-full hover:shadow-lg hover:shadow-primary/5 hover:border-primary/50 transition-all duration-300 relative overflow-hidden bg-card/50 backdrop-blur-sm">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3 group-hover:scale-110 transition-transform duration-300">
                              <Folder className="w-5 h-5" />
                            </div>
                            <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="rounded-full">
                              {project.status}
                            </Badge>
                          </div>
                          <CardTitle className="font-display text-lg group-hover:text-primary transition-colors">
                            {project.name}
                          </CardTitle>
                          <CardDescription className="line-clamp-2">
                            {project.description || "No description provided."}
                          </CardDescription>
                        </CardHeader>
                        <CardFooter className="pt-0 text-xs text-muted-foreground border-t bg-muted/20 p-4 mt-auto">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Updated {project.createdAt ? format(new Date(project.createdAt), 'MMM d, yyyy') : 'N/A'}
                          </div>
                        </CardFooter>
                      </Card>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Card className="p-8 flex flex-col items-center justify-center text-center border-dashed border-2">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Folder className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg">No projects yet</h3>
                <p className="text-muted-foreground mb-4 max-w-xs">Create your first project to start sharing files securely.</p>
              </Card>
            )}
          </div>

          {/* Sidebar: Analytics */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold font-display">Activity Overview</h2>
            <AnalyticsChart />
            
            <Card className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white border-none shadow-xl">
              <CardHeader>
                <CardTitle className="font-display">Pro Tips</CardTitle>
                <CardDescription className="text-indigo-200">
                  Did you know you can organize files in nested folders?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-indigo-100">
                  Use the file manager to create deep structures for complex deliverables.
                </p>
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="secondary" className="w-full text-indigo-900 font-bold">
                  Learn More
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
