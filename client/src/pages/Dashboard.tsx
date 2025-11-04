import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/StatsCard";
import { ShipmentTable, type Shipment } from "@/components/ShipmentTable";
import { ShipmentDetailPanel } from "@/components/ShipmentDetailPanel";
import { TrackingComparisonPanel } from "@/components/TrackingComparisonPanel";
import { StatusDetailPanel } from "@/components/StatusDetailPanel";
import { SyncStatus } from "@/components/SyncStatus";
import { Package, Truck, CheckCircle2, AlertCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { transformShipmentsFromAPI } from "@/lib/shipmentUtils";

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

  // Helper function to count master tracking numbers for shipments matching a condition
  // Counts 1 per shipment (the master tracking number you scan), not individual packages
  const countTrackingNumbers = (condition: (s: Shipment) => boolean) => {
    return shipments.filter(condition).length;
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

  const stats = {
    total: shipments.length, // Keep showing master shipment count for "Total Shipments"
    inTransit: countTrackingNumbers((s) =>
      s.notScanned === 0 && s.manuallyCompleted === 0
    ),
    deliveredToday: countTrackingNumbers((s) =>
      s.manuallyCompleted === 1
    ),
    notScanned: countTrackingNumbers((s) =>
      s.notScanned === 1
    ),
  };

  const handleSync = async () => {
    console.log("Refreshing FedEx tracking data...");

    try {
      // Refresh FedEx tracking data for all shipments
      const fedexResponse = await fetch("/api/fedex/refresh-all", {
        method: "POST",
      });

      if (fedexResponse.ok) {
        const fedexResult = await fedexResponse.json();
        console.log(`Updated ${fedexResult.successful} shipments with live FedEx data`);
        setLastSynced(new Date());
      }
    } catch (error) {
      console.log("FedEx refresh failed:", error);
    }

    // Refresh the shipments list
    queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
  };

  // Auto-refresh FedEx data every 5 minutes
  useEffect(() => {
    // Refresh FedEx data immediately on load
    handleSync();

    // Set up periodic refresh every 5 minutes (300000ms)
    const syncInterval = setInterval(() => {
      console.log("Auto-refreshing FedEx tracking data...");
      handleSync();
    }, 5 * 60 * 1000);

    // Cleanup interval on unmount
    return () => clearInterval(syncInterval);
  }, []); // Empty dependency array means this runs once on mount

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
                Data will automatically sync from your Google Sheet every 5 minutes
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
