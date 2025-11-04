import { ShipmentTable, type Shipment } from "../ShipmentTable";
import { useState } from "react";

const mockShipments: Shipment[] = [
  {
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
  },
  {
    id: "2",
    trackingNumber: "885510251024",
    shipper: "SOUTHLAKE, TX",
    service: "PRIORITY_OVERNIGHT",
    totalWeight: "44.0LB",
    count: 2,
    lastLocation: "Memphis, TN",
    status: "out_for_delivery",
    estimatedDelivery: "Oct 28, 2025",
    lastUpdate: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    id: "3",
    trackingNumber: "456516701366",
    shipper: "LaVergne, TN",
    service: "PRIORITY_OVERNIGHT",
    totalWeight: "107.0LB",
    count: 5,
    lastLocation: "Nashville, TN",
    status: "delivered",
    estimatedDelivery: "Oct 28, 2025",
    lastUpdate: new Date(Date.now() - 30 * 60 * 1000),
  },
];

export default function ShipmentTableExample() {
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  return (
    <div className="p-8">
      <ShipmentTable
        shipments={mockShipments}
        onViewDetails={(shipment) => {
          console.log("View details:", shipment);
          setSelectedShipment(shipment);
        }}
      />
    </div>
  );
}
