import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { X, ExternalLink, Package, Archive } from "lucide-react";
import type { Shipment } from "./ShipmentTable";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface StatusDetailPanelProps {
  title: string;
  shipments: Shipment[];
  onClose: () => void;
}

export function StatusDetailPanel({ title, shipments, onClose }: StatusDetailPanelProps) {
  const [isArchiving, setIsArchiving] = useState(false);
  const { toast } = useToast();

  const handleArchive = async () => {
    if (title !== "Delivered Packages" || shipments.length === 0) return;

    setIsArchiving(true);
    const trackingNumbers = shipments.map(s => s.trackingNumber);

    try {
      const response = await fetch("/api/shipments/archive-delivered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumbers }),
      });

      if (!response.ok) {
        throw new Error("Failed to archive shipments");
      }

      const data = await response.json();

      toast({
        title: "Archived Successfully",
        description: `${data.count} shipment(s) moved to delivered history`,
      });

      // Refresh the shipments list
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });

      // Close the panel after a brief delay
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error("Failed to archive delivered shipments:", error);
      toast({
        title: "Archive Failed",
        description: "Could not archive shipments. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsArchiving(false);
    }
  };
  // Show only master tracking numbers (what you physically scan)
  const trackingItems = shipments.map(shipment => ({
    trackingNumber: shipment.trackingNumber,
    masterTrackingNumber: shipment.trackingNumber,
    shipperCompany: shipment.shipperCompany,
    recipientCompany: shipment.recipientCompany,
    serviceType: shipment.serviceType,
    status: shipment.status,
    scheduledDelivery: shipment.scheduledDelivery,
    packageCount: shipment.packageCount,
    deliveredPackageCount: shipment.deliveredPackageCount || 0,
  }));

  const handleOpenTracking = (trackingNumber: string) => {
    window.open(`https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">
              {trackingItems.length} master tracking number{trackingItems.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {title === "Delivered Packages" && shipments.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleArchive}
                disabled={isArchiving}
                data-testid="button-archive-delivered"
              >
                <Archive className="h-4 w-4 mr-2" />
                {isArchiving ? "Archiving..." : "Archive All"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-status-detail"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {trackingItems.map((item, index) => (
              <Card 
                key={`${item.trackingNumber}-${index}`}
                className="p-4 hover-elevate"
                data-testid={`card-tracking-${item.trackingNumber}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        className="font-mono text-base text-primary hover:underline cursor-pointer flex items-center gap-1"
                        onClick={() => handleOpenTracking(item.trackingNumber)}
                        data-testid={`link-tracking-${item.trackingNumber}`}
                      >
                        {item.trackingNumber}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                      {item.packageCount > 1 && item.trackingNumber !== item.masterTrackingNumber && (
                        <Badge variant="secondary" className="text-xs">
                          Part of {item.packageCount}-package shipment
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {item.shipperCompany && (
                        <div>
                          <span className="text-muted-foreground">From: </span>
                          <span className="font-medium">{item.shipperCompany}</span>
                        </div>
                      )}
                      {item.recipientCompany && (
                        <div>
                          <span className="text-muted-foreground">To: </span>
                          <span className="font-medium">{item.recipientCompany}</span>
                        </div>
                      )}
                      {item.serviceType && (
                        <div>
                          <span className="text-muted-foreground">Service: </span>
                          <span className="font-medium">{item.serviceType}</span>
                        </div>
                      )}
                      {item.scheduledDelivery && (
                        <div>
                          <span className="text-muted-foreground">Expected: </span>
                          <span className="font-medium">
                            {new Date(item.scheduledDelivery).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {item.packageCount > 1 && item.trackingNumber === item.masterTrackingNumber && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Package className="h-3 w-3" />
                        {item.deliveredPackageCount > 0 && item.deliveredPackageCount < item.packageCount ? (
                          <span>
                            Master tracking - {item.deliveredPackageCount}/{item.packageCount} packages delivered
                          </span>
                        ) : (
                          <span>Master tracking for {item.packageCount} packages</span>
                        )}
                      </div>
                    )}
                  </div>

                  <Badge 
                    variant="secondary"
                    className="whitespace-nowrap"
                    data-testid={`status-${item.trackingNumber}`}
                  >
                    {item.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
