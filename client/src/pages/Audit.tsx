import { useAuditLogs } from "@/hooks/use-audit";
import Layout from "@/components/Layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ShieldAlert, Terminal } from "lucide-react";

export default function Audit() {
  const { data: logs, isLoading } = useAuditLogs();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">Track system security and file access events.</p>
        </div>

        <Card className="shadow-lg border-border/60">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />
              Event Log
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="secondary">Filter: All</Badge>
              <Badge variant="outline">Export CSV</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[120px]">Action</TableHead>
                    <TableHead className="w-[150px]">User</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-[150px] text-right">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.timestamp ? format(new Date(log.timestamp), 'PP pp') : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`
                            ${log.action === 'login' ? 'border-green-200 bg-green-50 text-green-700' : 
                              log.action === 'delete' ? 'border-red-200 bg-red-50 text-red-700' :
                              'border-blue-200 bg-blue-50 text-blue-700'}
                          `}
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">User #{log.userId}</TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate" title={log.details || ""}>
                        {log.details || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {log.ipAddress || "127.0.0.1"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!logs?.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <ShieldAlert className="w-8 h-8 mb-2 opacity-50" />
                          No audit logs found.
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
