import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { transformShipmentsFromAPI } from "@/lib/shipmentUtils";
import { BarChart3, Database } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Analytics() {
  const { data: rawApiShipments, isLoading } = useQuery({
    queryKey: ["/api/shipments"],
  });

  const apiShipments = rawApiShipments ? transformShipmentsFromAPI(rawApiShipments as any[]) : [];

  // Column mapping definition
  const columnMapping = [
    { header: "Status", fedexField: "status", ourField: "status", description: "Current shipment status" },
    { header: "Tracking Number", fedexField: "trackingNumber", ourField: "trackingNumber", description: "Unique tracking identifier" },
    { header: "Shipper", fedexField: "shipperName + shipperCompany", ourField: "shipperName, shipperCompany", description: "Sender information" },
    { header: "Recipient", fedexField: "recipientName + recipientCompany", ourField: "recipientName, recipientCompany", description: "Receiver information" },
    { header: "Service", fedexField: "serviceType", ourField: "serviceType", description: "FedEx service type" },
    { header: "Weight", fedexField: "packageWeight or totalWeight", ourField: "packageWeight, totalWeight", description: "Package/total weight" },
    { header: "COUNT", fedexField: "packageCount", ourField: "packageCount", description: "Number of packages" },
    { header: "Delivery", fedexField: "scheduledDelivery", ourField: "scheduledDelivery", description: "Scheduled delivery date" },
  ];

  // Sample FedEx data from first shipment
  const sampleShipment = apiShipments[0];

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Analytics & Field Mapping
            </h1>
            <p className="text-muted-foreground mt-1">
              View FedEx API field mappings and verify column alignment
            </p>
          </div>
        </div>

        {/* Column Mapping Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Column Header Mapping</CardTitle>
            <CardDescription>
              How your table headers map to FedEx API fields
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table Header</TableHead>
                  <TableHead>FedEx API Field(s)</TableHead>
                  <TableHead>Database Field(s)</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {columnMapping.map((mapping, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-semibold">{mapping.header}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{mapping.fedexField}</code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{mapping.ourField}</TableCell>
                    <TableCell className="text-sm">{mapping.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Sample FedEx Data */}
        {sampleShipment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Sample Shipment Data
              </CardTitle>
              <CardDescription>
                Viewing data for tracking number: {sampleShipment.trackingNumber}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Structured Data View */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Status Information</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="secondary">{sampleShipment.status || "N/A"}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tracking Number:</span>
                      <span className="font-mono">{sampleShipment.trackingNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Master Tracking:</span>
                      <span className="font-mono">{sampleShipment.masterTrackingNumber || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Package Information</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Package Count:</span>
                      <span className="font-semibold">{sampleShipment.packageCount || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Package Type:</span>
                      <span>{sampleShipment.packageType || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Package Weight:</span>
                      <span>{sampleShipment.packageWeight || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Weight:</span>
                      <span>{sampleShipment.totalWeight || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Shipper Information</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span>{sampleShipment.shipperName || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Company:</span>
                      <span>{sampleShipment.shipperCompany || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Recipient Information</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span>{sampleShipment.recipientName || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Company:</span>
                      <span>{sampleShipment.recipientCompany || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Delivery Information</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service Type:</span>
                      <span>{sampleShipment.serviceType || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Delivery:</span>
                      <span>{sampleShipment.scheduledDelivery || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Metadata</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Update:</span>
                      <span>{sampleShipment.lastUpdate ? new Date(sampleShipment.lastUpdate).toLocaleString() : "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sheet Row:</span>
                      <span>{sampleShipment.googleSheetRow || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Raw FedEx API Data */}
              {sampleShipment.fedexRawData && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Raw FedEx API Response</h3>
                  <ScrollArea className="h-[400px] w-full rounded-md border">
                    <pre className="p-4 text-xs">
                      {JSON.stringify(JSON.parse(sampleShipment.fedexRawData), null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* All Shipments Field Overview */}
        <Card>
          <CardHeader>
            <CardTitle>All Shipments - Field Population</CardTitle>
            <CardDescription>
              Overview of which fields are populated across all {apiShipments.length} shipments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {columnMapping.map((mapping, index) => {
                const fieldNames = mapping.ourField.split(", ");
                const populatedCount = apiShipments.filter(shipment => {
                  return fieldNames.some(fieldName => {
                    const value = shipment[fieldName.trim() as keyof typeof shipment];
                    return value !== null && value !== undefined && value !== "";
                  });
                }).length;
                const percentage = apiShipments.length > 0 ? Math.round((populatedCount / apiShipments.length) * 100) : 0;

                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <div className="flex-1">
                      <div className="font-medium">{mapping.header}</div>
                      <div className="text-xs text-muted-foreground">{mapping.ourField}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {populatedCount} / {apiShipments.length}
                      </span>
                      <Badge variant={percentage === 100 ? "default" : percentage > 50 ? "secondary" : "outline"}>
                        {percentage}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
