import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/StatsCard";
import { ShipmentTable, type Shipment } from "@/components/ShipmentTable";
import { ShipmentDetailPanel } from "@/components/ShipmentDetailPanel";
import { TrackingComparisonPanel } from "@/components/TrackingComparisonPanel";
import { StatusDetailPanel } from "@/components/StatusDetailPanel";
import { SyncStatus } from "@/components/SyncStatus";
import { Package, Truck, CheckCircle2, AlertCircle, BarChart3 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { transformShipmentsFromAPI } from "@/lib/shipmentUtils";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showStatusDetail, setShowStatusDetail] = useState<'inTransit' | 'delivered' | 'notScanned' | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | undefined>(undefined);

  const { data: rawApiShipments, isLoading } = useQuery({
    queryKey: ["/api/shipments"],
  });

  const { data: allTrackingNumbers } = useQuery<string[]>({
    queryKey: ["/api/tracking-numbers/all"],
  });

  const { data: scanningProgress } = useQuery({
    queryKey: ["/api/scanning-progress"],
    refetchInterval: 2000, // Refresh every 2 seconds for live updates
  });

  // Transform API data to ensure dates are properly parsed
  const apiShipments = rawApiShipments ? transformShipmentsFromAPI(rawApiShipments as any[]) : undefined;

  // Use API data
  const shipments = apiShipments || [];

  // Debug logging
  if (shipments.length > 0) {
    console.log("First shipment data:", shipments[0]);
    console.log("notScanned:", shipments[0].notScanned, "type:", typeof shipments[0].notScanned);
    console.log("manuallyCompleted:", shipments[0].manuallyCompleted, "type:", typeof shipments[0].manuallyCompleted);
  }

  // Helper function to count total packages for shipments matching a condition
  // Sums up the packageCount from each shipment to show total individual packages
  const countTrackingNumbers = (condition: (s: Shipment) => boolean) => {
    return shipments
      .filter(condition)
      .reduce((total, shipment) => {
        return total + (shipment.packageCount || 1);
      }, 0);
  };

  // Filter functions for status categories (now based on manual user actions)
  const inTransitShipments = shipments.filter((s) =>
    s.notScanned === 0 && s.manuallyCompleted === 0
  );

  const deliveredShipments = shipments.filter((s) =>
    s.manuallyCompleted === 1
  );

  const notScannedShipments = shipments.filter((s) =>
    s.notScanned === 1
  );

  // Count not scanned as 1 per shipment (master tracking number missing)
  const countNotScannedTrackingNumbers = () => {
    return notScannedShipments.length;
  };

  // Count delivered packages more accurately - use deliveredPackageCount if available
  const countDeliveredPackages = () => {
    return shipments.reduce((total, shipment) => {
      // If deliveredPackageCount is set and greater than 0, use it
      // Otherwise fall back to old logic (all packages delivered if manuallyCompleted === 1)
      if (shipment.deliveredPackageCount && shipment.deliveredPackageCount > 0) {
        return total + shipment.deliveredPackageCount;
      } else if (shipment.manuallyCompleted === 1) {
        return total + (shipment.packageCount || 1);
      }
      return total;
    }, 0);
  };

  const stats = {
    total: shipments.length, // Keep showing master shipment count for "Total Shipments"
    inTransit: countTrackingNumbers((s) =>
      s.notScanned === 0 && s.manuallyCompleted === 0
    ),
    deliveredToday: countDeliveredPackages(),
    notScanned: countNotScannedTrackingNumbers(),
  };

  const handleSync = async () => {
    console.log("Manual sync - syncing from Google Sheets");
    // Note: Bulk FedEx refresh is disabled to prevent rate limiting
    // Use the refresh button in individual shipment detail panels instead

    try {
      // Sync from Google Sheets to get new tracking numbers
      const response = await fetch("/api/sync/google-sheets", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to sync from Google Sheets");
      }

      // Refresh the shipments list
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracking-numbers/all"] });
      setLastSynced(new Date());
    } catch (error) {
      console.error("Error syncing:", error);
      // Still update last synced time even on error
      setLastSynced(new Date());
    }
  };

  // Auto-refresh disabled to prevent FedEx API rate limiting
  // Users should manually refresh individual shipments using the detail panel

  return (
    <>
      <div className="flex-1 overflow-auto">
        <div className="container max-w-7xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Track and manage your FedEx shipments
              </p>
            </div>
            <SyncStatus
              lastSynced={lastSynced}
              onSync={handleSync}
            />
          </div>

          {!apiShipments || apiShipments.length === 0 ? (
            <Card className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No shipments yet</h3>
              <p className="text-muted-foreground mb-4">
                Click "Refresh Tracking" to sync data from your Google Sheet
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Make sure you have GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEET_ID configured in your secrets
              </p>
              <Button onClick={handleSync} data-testid="button-sync-now">
                Sync Now
              </Button>
            </Card>
          ) : null}

          {apiShipments && apiShipments.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatsCard
                  title="Total Shipments"
                  value={stats.total}
                  icon={Package}
                  onClick={() => setShowComparison(true)}
                />
                <StatsCard
                  title="In Transit"
                  value={stats.inTransit}
                  icon={Truck}
                  onClick={() => setShowStatusDetail('inTransit')}
                />
                <StatsCard
                  title="Delivered"
                  value={stats.deliveredToday}
                  icon={CheckCircle2}
                  onClick={() => setShowStatusDetail('delivered')}
                />
                <StatsCard
                  title="Not Scanned"
                  value={stats.notScanned}
                  icon={AlertCircle}
                  onClick={() => setShowStatusDetail('notScanned')}
                />
                <Card className="p-6 cursor-pointer hover-elevate group" onClick={() => setShowComparison(true)}>
                  <div className="flex items-center justify-between space-x-2">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Scanning Progress
                      </p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold">
                          {scanningProgress ? `${scanningProgress.totalScanned}/${scanningProgress.totalExpected}` : "—/—"}
                        </p>
                        {scanningProgress && scanningProgress.percentageScanned !== undefined && (
                          <span className="text-sm text-muted-foreground">
                            ({scanningProgress.percentageScanned}%)
                          </span>
                        )}
                      </div>
                      {scanningProgress && scanningProgress.totalExpected > 0 && (
                        <Progress
                          value={scanningProgress.percentageScanned}
                          className="mt-2 h-2"
                        />
                      )}
                    </div>
                    <div className="rounded-full bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Shipments</h2>
                </div>
                <ShipmentTable
                  shipments={shipments}
                  onViewDetails={setSelectedShipment}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>

      {selectedShipment && (
        <ShipmentDetailPanel
          shipment={selectedShipment}
          onClose={() => setSelectedShipment(null)}
        />
      )}

      {showComparison && allTrackingNumbers && (
        <TrackingComparisonPanel
          allTrackingNumbers={allTrackingNumbers}
          onClose={() => setShowComparison(false)}
        />
      )}

      {showStatusDetail === 'inTransit' && (
        <StatusDetailPanel
          title="In Transit Packages"
          shipments={inTransitShipments}
          onClose={() => setShowStatusDetail(null)}
        />
      )}

      {showStatusDetail === 'delivered' && (
        <StatusDetailPanel
          title="Delivered Packages"
          shipments={deliveredShipments}
          onClose={() => setShowStatusDetail(null)}
        />
      )}

      {showStatusDetail === 'notScanned' && (
        <StatusDetailPanel
          title="Not Scanned Packages"
          shipments={notScannedShipments}
          onClose={() => setShowStatusDetail(null)}
        />
      )}
    </>
  );
}
