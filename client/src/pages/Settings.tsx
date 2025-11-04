import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Settings() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const handleGoogleSheetsSync = async () => {
    setIsSyncing(true);
    try {
      const response = await apiRequest("POST", "/api/sync/google-sheets");
      const result = await response.json();
      toast({
        title: "Sync successful",
        description: `Synced ${result.successful} shipment(s) from Google Sheets`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync from Google Sheets",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFedExRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await apiRequest("POST", "/api/fedex/refresh-all");
      const result = await response.json();
      toast({
        title: "Refresh successful",
        description: `Updated ${result.successful} shipment(s) with FedEx data`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
    } catch (error: any) {
      toast({
        title: "Refresh failed",
        description: error.message || "Failed to refresh FedEx data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage integrations and API configurations
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Google Sheets Integration</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Connection Status</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatically sync shipment data from your Google Sheet
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Not Configured
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Setup Instructions</h3>
                  <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                    <li>
                      Create a Google Cloud Project and enable the Google Sheets API
                      <a
                        href="https://console.cloud.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 ml-2 text-primary hover:underline"
                      >
                        Open Console
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                    <li>Create a Service Account and download the JSON credentials</li>
                    <li>Share your Google Sheet with the service account email</li>
                    <li>
                      Add these secrets in your Replit project:
                      <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                        <li>
                          <code className="bg-muted px-1 py-0.5 rounded text-xs">
                            GOOGLE_SERVICE_ACCOUNT_JSON
                          </code>
                          {" "}(the full JSON content)
                        </li>
                        <li>
                          <code className="bg-muted px-1 py-0.5 rounded text-xs">
                            GOOGLE_SHEET_ID
                          </code>
                          {" "}(from your sheet URL)
                        </li>
                      </ul>
                    </li>
                  </ol>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleGoogleSheetsSync}
                    disabled={isSyncing}
                    variant="outline"
                    data-testid="button-sync-sheets"
                    className="gap-2"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Sync from Google Sheets
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div>
              <h2 className="text-xl font-semibold mb-4">FedEx API Integration</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Connection Status</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Validate tracking numbers and fetch real-time shipment details
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Not Configured
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Setup Instructions</h3>
                  <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                    <li>
                      Sign up for FedEx Developer access
                      <a
                        href="https://developer.fedex.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 ml-2 text-primary hover:underline"
                      >
                        Developer Portal
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                    <li>Create a new project and get your API credentials</li>
                    <li>
                      Add these secrets in your Replit project:
                      <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                        <li>
                          <code className="bg-muted px-1 py-0.5 rounded text-xs">
                            FEDEX_API_KEY
                          </code>
                        </li>
                        <li>
                          <code className="bg-muted px-1 py-0.5 rounded text-xs">
                            FEDEX_API_SECRET
                          </code>
                        </li>
                      </ul>
                    </li>
                  </ol>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleFedExRefresh}
                    disabled={isRefreshing}
                    variant="outline"
                    data-testid="button-refresh-fedex"
                    className="gap-2"
                  >
                    {isRefreshing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Refresh All with FedEx Data
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-muted/50">
          <h3 className="text-sm font-semibold mb-2">Note</h3>
          <p className="text-sm text-muted-foreground">
            The dashboard currently works with manual data entry and will show mock data for demonstration.
            Once you configure the integrations above, you'll be able to automatically sync from your Google Sheet
            and enrich shipment data with real-time FedEx tracking information.
          </p>
        </Card>
      </div>
    </div>
  );
}
