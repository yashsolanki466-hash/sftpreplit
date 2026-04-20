import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FolderOpen, 
  File, 
  Download, 
  ChevronRight,
  Home,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function FileManager() {
  const [currentPath, setCurrentPath] = useState("/");
  const { toast } = useToast();

  const { data: files, isLoading, error, refetch } = useQuery<FileEntry[]>({
    queryKey: ["/api/ftp/files", currentPath],
    queryFn: async () => {
      const res = await fetch(`/api/ftp/files?path=${encodeURIComponent(currentPath)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to list files");
      }
      return res.json();
    },
  });

  const pathParts = currentPath.split("/").filter(Boolean);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const handleDownload = async (file: FileEntry) => {
    try {
      const response = await fetch(`/api/ftp/download?path=${encodeURIComponent(file.path)}`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download started",
        description: `Downloading ${file.name}`,
      });
    } catch (err) {
      toast({
        title: "Download failed",
        description: "Could not download the file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPath("/");
    } else {
      const newPath = "/" + pathParts.slice(0, index + 1).join("/");
      setCurrentPath(newPath);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">File Manager</h1>
            <p className="text-muted-foreground mt-1">
              Browse and download files from the server
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink 
                      className="cursor-pointer flex items-center gap-1"
                      onClick={() => handleBreadcrumbClick(-1)}
                    >
                      <Home className="w-4 h-4" />
                      Root
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {pathParts.map((part, index) => (
                    <span key={index} className="flex items-center">
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {index === pathParts.length - 1 ? (
                          <BreadcrumbPage>{part}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink 
                            className="cursor-pointer"
                            onClick={() => handleBreadcrumbClick(index)}
                          >
                            {part}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </span>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                <h3 className="text-lg font-semibold mb-2">Connection Error</h3>
                <p className="text-muted-foreground mb-4">
                  {(error as Error).message || "Could not connect to the server"}
                </p>
                <Button variant="outline" onClick={() => refetch()}>
                  Try Again
                </Button>
              </div>
            ) : isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-3">
                    <Skeleton className="w-10 h-10 rounded" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4 mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : files && files.length > 0 ? (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%]">Name</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Modified</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files
                      .sort((a, b) => {
                        if (a.type === "directory" && b.type !== "directory") return -1;
                        if (a.type !== "directory" && b.type === "directory") return 1;
                        return a.name.localeCompare(b.name);
                      })
                      .map((file) => (
                        <TableRow 
                          key={file.path}
                          className={file.type === "directory" ? "cursor-pointer hover:bg-muted/50" : ""}
                          onClick={() => file.type === "directory" && handleNavigate(file.path)}
                          data-testid={`file-row-${file.name}`}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              {file.type === "directory" ? (
                                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                                  <FolderOpen className="w-5 h-5 text-orange-600" />
                                </div>
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                                  <File className="w-5 h-5 text-blue-600" />
                                </div>
                              )}
                              <span className="truncate max-w-[300px]">{file.name}</span>
                              {file.type === "directory" && (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {file.type === "file" ? formatFileSize(file.size) : "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {file.modifiedAt 
                              ? format(new Date(file.modifiedAt), "MMM d, yyyy HH:mm")
                              : "-"
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            {file.type === "file" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(file);
                                }}
                                data-testid={`button-download-${file.name}`}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Empty Directory</h3>
                <p className="text-muted-foreground">
                  This directory contains no files or folders.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
