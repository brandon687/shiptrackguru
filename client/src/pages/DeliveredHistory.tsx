import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTimePST } from "@/lib/utils";

interface DeliveredShipment {
  id: string;
  trackingNumber: string;
  status: string;
  shipperCompany: string | null;
  recipientCompany: string | null;
  serviceType: string | null;
  packageWeight: string | null;
  packageCount: number;
  expectedDelivery: string | null;
  actualDelivery: string;
  deliveredAt: string;
}

export default function DeliveredHistory() {
  const { data: deliveredShipments = [], isLoading } = useQuery<DeliveredShipment[]>({
    queryKey: ["/api/delivered-shipments"],
  });

  const handleOpenTracking = (trackingNumber: string) => {
    window.open(`https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`, '_blank');
  };

  const formatDate = (dateString: string) => {
    // Use PST format for consistency, or fall back to short format if needed
    const pstFormat = formatDateTimePST(dateString);
    if (pstFormat) return pstFormat;

    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    });
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-7xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Delivered Shipments History</h1>
          <p className="text-muted-foreground mt-1">
            Historical record of all delivered packages
          </p>
        </div>

        {isLoading ? (
          <Card className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading delivered shipments...</p>
          </Card>
        ) : deliveredShipments.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No delivered shipments yet</h3>
            <p className="text-muted-foreground">
              Completed shipments will appear here when marked as delivered
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold text-sm">Status</th>
                      <th className="text-left p-3 font-semibold text-sm">Tracking Number</th>
                      <th className="text-left p-3 font-semibold text-sm">Shipper</th>
                      <th className="text-left p-3 font-semibold text-sm">Recipient</th>
                      <th className="text-left p-3 font-semibold text-sm">Service</th>
                      <th className="text-right p-3 font-semibold text-sm">Weight</th>
                      <th className="text-right p-3 font-semibold text-sm">COUNT</th>
                      <th className="text-left p-3 font-semibold text-sm">Expected Delivery</th>
                      <th className="text-left p-3 font-semibold text-sm">Actual Delivery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveredShipments.map((shipment) => (
                      <tr
                        key={shipment.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3">
                          <Badge variant="secondary" className="whitespace-nowrap bg-green-100 dark:bg-green-900/20 text-green-900 dark:text-green-400">
                            {shipment.status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleOpenTracking(shipment.trackingNumber)}
                            className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            {shipment.trackingNumber}
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </td>
                        <td className="p-3 text-sm">
                          {shipment.shipperCompany || '-'}
                        </td>
                        <td className="p-3 text-sm">
                          {shipment.recipientCompany || '-'}
                        </td>
                        <td className="p-3 text-sm">
                          {shipment.serviceType || '-'}
                        </td>
                        <td className="p-3 text-sm text-right">
                          {shipment.packageWeight || '-'}
                        </td>
                        <td className="p-3 text-sm text-right font-semibold">
                          <Badge variant="outline">{shipment.packageCount}</Badge>
                        </td>
                        <td className="p-3 text-sm">
                          {shipment.expectedDelivery ? formatDate(shipment.expectedDelivery) : '-'}
                        </td>
                        <td className="p-3 text-sm">
                          {formatDate(shipment.actualDelivery)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
            <div className="border-t p-4 bg-muted/30">
              <p className="text-sm text-muted-foreground">
                Total: {deliveredShipments.length} delivered shipment{deliveredShipments.length !== 1 ? 's' : ''}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
