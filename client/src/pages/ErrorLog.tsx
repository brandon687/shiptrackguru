import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SyncLog {
  id: string;
  timestamp: Date;
  source: string;
  trackingNumber: string | null;
  success: number;
  errorMessage: string | null;
  errorStack: string | null;
  sheetData: string | null;
  responseData: string | null;
}

export default function ErrorLog() {
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);

  const { data: logs, isLoading } = useQuery<SyncLog[]>({
    queryKey: ["/api/sync-logs"],
  });

  const errorLogs = logs?.filter(log => log.success === 0) || [];
  const successLogs = logs?.filter(log => log.success === 1) || [];
  const totalErrors = errorLogs.length;
  const totalSuccess = successLogs.length;
  const errorRate = logs && logs.length > 0 ? Math.round((totalErrors / logs.length) * 100) : 0;

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <>
      <div className="flex-1 overflow-auto">
        <div className="container max-w-7xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <FileText className="h-8 w-8" />
                Error Log & Sync Reports
              </h1>
              <p className="text-muted-foreground mt-1">
                Full reports of all sync operations and errors
              </p>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Syncs</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{logs?.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  All sync operations logged
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Successful</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{totalSuccess}</div>
                <p className="text-xs text-muted-foreground">
                  Synced successfully
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Errors</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{totalErrors}</div>
                <p className="text-xs text-muted-foreground">
                  {errorRate}% error rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Error Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Sync Logs</CardTitle>
              <CardDescription>
                Click any row to view full details including raw data and error stack traces
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
              ) : !logs || logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No sync logs yet</div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Tracking Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow 
                          key={log.id}
                          className="cursor-pointer hover-elevate"
                          onClick={() => setSelectedLog(log)}
                          data-testid={`row-log-${log.id}`}
                        >
                          <TableCell className="text-sm">
                            {formatDate(log.timestamp)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.source}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.trackingNumber || "N/A"}
                          </TableCell>
                          <TableCell>
                            {log.success === 1 ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Error
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                            {log.errorMessage || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sync Log Details</DialogTitle>
            <DialogDescription>
              Full report for {selectedLog?.trackingNumber || "sync operation"}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-semibold">Timestamp</div>
                  <div className="text-sm text-muted-foreground">{formatDate(selectedLog.timestamp)}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">Source</div>
                  <Badge variant="outline">{selectedLog.source}</Badge>
                </div>
                <div>
                  <div className="text-sm font-semibold">Tracking Number</div>
                  <div className="text-sm font-mono">{selectedLog.trackingNumber || "N/A"}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">Status</div>
                  {selectedLog.success === 1 ? (
                    <Badge variant="default" className="bg-green-500">Success</Badge>
                  ) : (
                    <Badge variant="destructive">Error</Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Error Details */}
              {selectedLog.errorMessage && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Error Message</div>
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm">
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}

              {selectedLog.errorStack && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Error Stack Trace</div>
                  <ScrollArea className="h-[150px] w-full rounded-md border">
                    <pre className="p-3 text-xs">{selectedLog.errorStack}</pre>
                  </ScrollArea>
                </div>
              )}

              {/* Sheet Data */}
              {selectedLog.sheetData && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Google Sheets Data (Input)</div>
                  <ScrollArea className="h-[150px] w-full rounded-md border">
                    <pre className="p-3 text-xs">
                      {JSON.stringify(JSON.parse(selectedLog.sheetData), null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              {/* Response Data */}
              {selectedLog.responseData && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">FedEx API Response (Output)</div>
                  <ScrollArea className="h-[200px] w-full rounded-md border">
                    <pre className="p-3 text-xs">
                      {JSON.stringify(JSON.parse(selectedLog.responseData), null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
