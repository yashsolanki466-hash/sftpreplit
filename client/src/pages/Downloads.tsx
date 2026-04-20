import { useDownloads } from "@/hooks/use-downloads";
import Layout from "@/components/Layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Download, FileIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export default function Downloads() {
  const { data: downloads, isLoading } = useDownloads();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display">Download History</h1>
          <p className="text-muted-foreground mt-1">Files you have previously downloaded.</p>
        </div>

        <div className="grid gap-4">
          {isLoading ? (
             <div className="text-muted-foreground">Loading history...</div>
          ) : downloads && downloads.length > 0 ? (
            downloads.map((download) => (
              <Card key={download.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                      <FileIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">File #{download.fileId}</p>
                      <p className="text-xs text-muted-foreground">
                        Downloaded on {download.downloadedAt ? format(new Date(download.downloadedAt), 'PPP p') : 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    Download Again
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl bg-muted/10">
              <Download className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-medium">No downloads yet</h3>
              <p className="text-muted-foreground">Your download history will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
