import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "./StatusBadge";
import { X, Copy, RefreshCw, MapPin, Package, Weight, Truck, ChevronDown, ChevronRight, Edit, Save, ExternalLink } from "lucide-react";
import type { Shipment } from "./ShipmentTable";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ShipmentDetailPanelProps {
  shipment: Shipment | null;
  onClose: () => void;
}

export function ShipmentDetailPanel({ shipment, onClose }: ShipmentDetailPanelProps) {
  const [showFedExData, setShowFedExData] = useState(false);
  const [isEditingChildTracking, setIsEditingChildTracking] = useState(false);
  const [childTrackingInput, setChildTrackingInput] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  // All hooks must be called before any conditional returns
  const updateChildTrackingMutation = useMutation({
    mutationFn: async (childTrackingNumbers: string[]) => {
      if (!shipment) throw new Error("No shipment selected");
      return await apiRequest(
        "PATCH",
        `/api/shipments/${shipment.trackingNumber}/child-tracking-numbers`,
        { childTrackingNumbers }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracking-numbers/all"] });
      setIsEditingChildTracking(false);
      toast({
        title: "Updated",
        description: "Child tracking numbers updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update child tracking numbers",
        variant: "destructive",
      });
    },
  });

  const refreshTrackingMutation = useMutation({
    mutationFn: async () => {
      if (!shipment) throw new Error("No shipment selected");
      return await apiRequest("POST", `/api/shipments/${shipment.trackingNumber}/refresh`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      toast({
        title: "Tracking Refreshed",
        description: "Live tracking information updated from FedEx",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh tracking information",
        variant: "destructive",
      });
    },
  });

  // Now we can safely return early after all hooks have been called
  if (!shipment) return null;

  // Initialize child tracking input when editing starts
  const startEditingChildTracking = () => {
    const current = shipment.childTrackingNumbers || [];
    setChildTrackingInput(current.join("\n"));
    setIsEditingChildTracking(true);
  };

  const handleSaveChildTracking = () => {
    const trackingNumbers = childTrackingInput
      .split(/[\n,]+/)
      .map(tn => tn.trim())
      .filter(tn => tn.length > 0);
    
    updateChildTrackingMutation.mutate(trackingNumbers);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shipment.trackingNumber);
    toast({
      title: "Copied",
      description: "Tracking number copied to clipboard",
    });
  };

  const handleRefresh = () => {
    refreshTrackingMutation.mutate();
  };

  // Parse FedEx raw data if available
  let fedexData = null;
  try {
    if (shipment.fedexRawData) {
      fedexData = JSON.parse(shipment.fedexRawData);
    }
  } catch (error) {
    console.error("Error parsing FedEx data:", error);
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-background border-l shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Shipment Details</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-close-detail"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Tracking Number
                </p>
                <a
                  href={`https://www.fedex.com/fedextrack/?trknbr=${shipment.trackingNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-mono font-semibold break-all text-primary hover:underline"
                  data-testid="link-tracking-detail"
                >
                  {shipment.trackingNumber}
                </a>
              </div>
              <StatusBadge status={shipment.status} />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex-1 gap-2"
                data-testid="button-copy-tracking"
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="flex-1 gap-2"
                data-testid="button-refresh-tracking"
                disabled={refreshTrackingMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 ${refreshTrackingMutation.isPending ? 'animate-spin' : ''}`} />
                {refreshTrackingMutation.isPending ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Shipper</span>
              </div>
              <p className="font-medium text-sm">
                {shipment.shipperName && <span className="block">{shipment.shipperName}</span>}
                {shipment.shipperCompany && <span className="block text-muted-foreground">{shipment.shipperCompany}</span>}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Recipient</span>
              </div>
              <p className="font-medium text-sm">
                {shipment.recipientName && <span className="block">{shipment.recipientName}</span>}
                {shipment.recipientCompany && <span className="block text-muted-foreground">{shipment.recipientCompany}</span>}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Truck className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Service</span>
              </div>
              <p className="text-sm">{shipment.serviceType || "N/A"}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Weight className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Weight</span>
              </div>
              <p className="font-mono text-sm">{shipment.totalWeight || "N/A"}</p>
            </div>
            <div className="col-span-2">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Package className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Package Count</span>
              </div>
              <Badge variant="default" className="text-2xl font-bold px-3 py-1" data-testid="text-detail-count">
                {shipment.packageCount}
              </Badge>
            </div>
          </div>

          {shipment.packageCount > 1 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Individual Package Tracking Numbers
                  </p>
                  {!isEditingChildTracking && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startEditingChildTracking}
                      data-testid="button-edit-child-tracking"
                      className="h-7"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      {shipment.childTrackingNumbers && shipment.childTrackingNumbers.length > 0 ? "Edit" : "Add"}
                    </Button>
                  )}
                </div>

                {!isEditingChildTracking ? (
                  <>
                    {shipment.childTrackingNumbers && shipment.childTrackingNumbers.length > 0 ? (
                      <div className="space-y-1">
                        {shipment.childTrackingNumbers.map((trackingNum, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <a
                              href={`https://www.fedex.com/fedextrack/?trknbr=${trackingNum}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                              data-testid={`link-child-tracking-${idx}`}
                            >
                              {trackingNum}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground p-3 bg-muted/20 rounded border border-dashed">
                        <p>No individual tracking numbers entered.</p>
                        <p className="text-xs mt-1">
                          Click "Add" to manually enter tracking numbers from FedEx tracking page.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      value={childTrackingInput}
                      onChange={(e) => setChildTrackingInput(e.target.value)}
                      placeholder="Enter tracking numbers (one per line)"
                      className="font-mono text-sm min-h-32"
                      data-testid="input-child-tracking-numbers"
                    />
                    <p className="text-xs text-muted-foreground">
                      Visit the{" "}
                      <a
                        href={`https://www.fedex.com/fedextrack/?trknbr=${shipment.trackingNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        FedEx tracking page
                      </a>
                      {" "}to find individual package tracking numbers.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSaveChildTracking}
                        disabled={updateChildTrackingMutation.isPending}
                        data-testid="button-save-child-tracking"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        {updateChildTrackingMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingChildTracking(false)}
                        disabled={updateChildTrackingMutation.isPending}
                        data-testid="button-cancel-child-tracking"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {shipment.scheduledDelivery && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Scheduled Delivery
                </p>
                <p className="text-lg font-semibold">{shipment.scheduledDelivery}</p>
              </div>
            </>
          )}

          {shipment.direction && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Direction
                </p>
                <Badge variant="secondary">{shipment.direction}</Badge>
              </div>
            </>
          )}

          {fedexData && (
            <>
              <Separator />
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFedExData(!showFedExData)}
                  className="w-full justify-start gap-2 p-0 h-auto font-semibold text-sm"
                  data-testid="button-toggle-fedex-data"
                >
                  {showFedExData ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  FedEx API Data (for investigation)
                </Button>
                {showFedExData && (
                  <div className="mt-3">
                    <div className="bg-muted/50 rounded-md p-3 overflow-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap break-words" data-testid="text-fedex-raw-data">
                        {JSON.stringify(fedexData, null, 2)}
                      </pre>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      This contains the complete FedEx API response. You can use this to identify additional fields and adjust your workflow.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {fedexData?.events && fedexData.events.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-4">FedEx Tracking Events</h3>
                <div className="space-y-4">
                  {fedexData.events.map((event: any, index: number) => (
                    <div key={index} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-3 w-3 rounded-full ${index === 0 ? "bg-primary" : "bg-muted"}`} />
                        {index !== fedexData.events.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border mt-1 min-h-8" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-sm font-medium">{event.status}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {event.description}
                        </p>
                        {event.location && (
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{event.location}</span>
                            {event.timestamp && (
                              <>
                                <span>•</span>
                                <span>{new Date(event.timestamp).toLocaleString()}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
