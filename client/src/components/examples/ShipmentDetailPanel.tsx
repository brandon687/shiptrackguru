import { ShipmentDetailPanel } from "../ShipmentDetailPanel";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { Shipment } from "../ShipmentTable";

const mockShipment: Shipment = {
  id: "1",
  trackingNumber: "885508936262",
  shipper: "COPPELL, TX",
  service: "FEDEX_1_DAY_FREIGHT",
  totalWeight: "648.0LB",
  count: 1,
  lastLocation: "Dallas, TX",
  status: "in_transit",
  estimatedDelivery: "Oct 29, 2025",
  lastUpdate: new Date(Date.now() - 2 * 60 * 60 * 1000),
};

export default function ShipmentDetailPanelExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-8">
      <Button onClick={() => setIsOpen(true)}>
        Open Shipment Details
      </Button>
      {isOpen && (
        <ShipmentDetailPanel
          shipment={mockShipment}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
