import type { Shipment } from "@/components/ShipmentTable";

// Transform API response to ensure dates are properly parsed
export function transformShipmentFromAPI(shipment: any): Shipment {
  return {
    ...shipment,
    lastUpdate: typeof shipment.lastUpdate === "string" 
      ? new Date(shipment.lastUpdate) 
      : shipment.lastUpdate,
  };
}

export function transformShipmentsFromAPI(shipments: any[]): Shipment[] {
  return shipments.map(transformShipmentFromAPI);
}
