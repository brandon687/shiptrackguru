import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParsedShipment {
  trackingNumber: string;
  status: string;
  scheduledDelivery?: string;
  shipperName?: string;
  shipperCompany?: string;
  recipientName?: string;
  recipientCompany?: string;
  masterTrackingNumber?: string;
  packageCount: number;
  packageType?: string;
  packageWeight?: string;
  totalWeight?: string;
  direction?: string;
  serviceType?: string;
  childTrackingNumbers?: string[];
  isValid: boolean;
  errors: string[];
}

interface BulkImportProps {
  onImport: (shipments: ParsedShipment[]) => Promise<void>;
}

export function BulkImport({ onImport }: BulkImportProps) {
  const [input, setInput] = useState("");
  const [parsedShipments, setParsedShipments] = useState<ParsedShipment[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const parseLine = (line: string): string[] => {
    // Try tab-separated first (TSV format)
    if (line.includes('\t')) {
      return line.split('\t').map(part => part.trim());
    }
    
    // Fall back to CSV parsing
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseInput = () => {
    const lines = input.trim().split("\n");
    const rawRows: any[] = [];

    // First pass: parse all rows
    lines.forEach((line, index) => {
      if (!line.trim()) return;

      // Skip header row if it contains "Tracking Number"
      if (line.includes("Tracking Number") && index === 0) return;

      const parts = parseLine(line);

      // Format: Tracking Number, Status, Scheduled delivery date, Shipper name, Shipper company,
      // Recipient contact name, Recipient company, Master tracking number, No. of packages,
      // Package Type, Pkg Wt (Lbs), Total Wt (Lbs), Direction, Service type
      const trackingNumber = parts[0]?.trim() || "";
      const status = parts[1]?.trim() || "Pending";
      const scheduledDelivery = parts[2]?.trim() || undefined;
      const shipperName = parts[3]?.trim() || undefined;
      const shipperCompany = parts[4]?.trim() || undefined;
      const recipientName = parts[5]?.trim() || undefined;
      const recipientCompany = parts[6]?.trim() || undefined;
      const masterTrackingNumber = parts[7]?.trim() || undefined;
      const packageCountStr = parts[8]?.trim() || "1";
      const packageType = parts[9]?.trim() || undefined;
      const packageWeight = parts[10]?.trim() ? `${parts[10].trim()}LB` : undefined;
      const totalWeight = parts[11]?.trim() ? `${parts[11].trim()}LB` : undefined;
      const direction = parts[12]?.trim() || undefined;
      const serviceType = parts[13]?.trim() || undefined;

      if (!trackingNumber) return;

      const packageCount = parseInt(packageCountStr);

      rawRows.push({
        trackingNumber,
        status,
        scheduledDelivery,
        shipperName,
        shipperCompany,
        recipientName,
        recipientCompany,
        masterTrackingNumber,
        packageCount: isNaN(packageCount) ? 1 : packageCount,
        packageType,
        packageWeight,
        totalWeight,
        direction,
        serviceType,
      });
    });

    // Second pass: group by master tracking number
    const groupedByMaster = new Map<string, any[]>();
    const standaloneShipments: any[] = [];

    rawRows.forEach(row => {
      const master = row.masterTrackingNumber;
      
      if (master) {
        // This row has a master tracking number - group it
        if (!groupedByMaster.has(master)) {
          groupedByMaster.set(master, []);
        }
        groupedByMaster.get(master)!.push(row);
      } else {
        // No master tracking number - standalone shipment
        standaloneShipments.push(row);
      }
    });

    // Third pass: create final shipment records
    const parsed: ParsedShipment[] = [];

    // Process grouped shipments
    groupedByMaster.forEach((rows, masterTrackingNumber) => {
      const errors: string[] = [];
      
      // Use data from the first row or the master row
      const masterRow = rows.find(r => r.trackingNumber === masterTrackingNumber) || rows[0];
      
      // Collect all child tracking numbers
      const childTrackingNumbers = rows.map(r => r.trackingNumber);
      
      if (!masterTrackingNumber) errors.push("Missing master tracking number");

      parsed.push({
        trackingNumber: masterTrackingNumber,
        status: masterRow.status,
        scheduledDelivery: masterRow.scheduledDelivery,
        shipperName: masterRow.shipperName,
        shipperCompany: masterRow.shipperCompany,
        recipientName: masterRow.recipientName,
        recipientCompany: masterRow.recipientCompany,
        masterTrackingNumber: masterTrackingNumber,
        packageCount: masterRow.packageCount,
        packageType: masterRow.packageType,
        packageWeight: masterRow.packageWeight,
        totalWeight: masterRow.totalWeight,
        direction: masterRow.direction,
        serviceType: masterRow.serviceType,
        childTrackingNumbers,
        isValid: errors.length === 0,
        errors,
      });
    });

    // Process standalone shipments
    standaloneShipments.forEach(row => {
      const errors: string[] = [];
      
      if (!row.trackingNumber) errors.push("Missing tracking number");

      const packageCount = row.packageCount;
      if (isNaN(packageCount) || packageCount <= 0) {
        errors.push("Invalid package count");
      }

      parsed.push({
        trackingNumber: row.trackingNumber,
        status: row.status,
        scheduledDelivery: row.scheduledDelivery,
        shipperName: row.shipperName,
        shipperCompany: row.shipperCompany,
        recipientName: row.recipientName,
        recipientCompany: row.recipientCompany,
        masterTrackingNumber: row.masterTrackingNumber,
        packageCount: row.packageCount,
        packageType: row.packageType,
        packageWeight: row.packageWeight,
        totalWeight: row.totalWeight,
        direction: row.direction,
        serviceType: row.serviceType,
        isValid: errors.length === 0,
        errors,
      });
    });

    setParsedShipments(parsed);
  };

  const handleImport = async () => {
    const validShipments = parsedShipments.filter(s => s.isValid);
    
    if (validShipments.length === 0) {
      toast({
        title: "No valid shipments",
        description: "Please fix the errors before importing",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      await onImport(validShipments);
      toast({
        title: "Import successful",
        description: `${validShipments.length} shipment(s) imported`,
      });
      setInput("");
      setParsedShipments([]);
    } catch (error) {
      toast({
        title: "Import failed",
        description: "An error occurred while importing shipments",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedShipments.filter(s => s.isValid).length;
  const invalidCount = parsedShipments.length - validCount;
  const totalBoxes = parsedShipments
    .filter(s => s.isValid)
    .reduce((sum, s) => sum + (s.childTrackingNumbers?.length || 1), 0);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold mb-2">Paste Tab-Separated Data from FedEx</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Copy and paste the entire export from FedEx (including headers). The system supports both tab-separated (TSV) and comma-separated (CSV) formats.
              <br />
              <strong className="block mt-1">Important:</strong> If rows have the same "Master tracking number", they will be automatically grouped with child tracking numbers.
              <br />
              <code className="text-xs bg-muted px-1 py-0.5 rounded mt-1 inline-block">
                Expected columns: Tracking Number, Status, Scheduled delivery date, Shipper name, Shipper company, Recipient contact name, Recipient company, Master tracking number, No. of packages, Package Type, Pkg Wt (Lbs), Total Wt (Lbs), Direction, Service type
              </code>
            </p>
          </div>

          <Textarea
            placeholder="Paste your tab-separated or CSV data here (with headers)&#10;Tracking Number   Status  Scheduled delivery date ...&#10;456516701366    Out for delivery        10/28/25        ..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="font-mono text-sm min-h-[200px]"
            data-testid="textarea-bulk-import"
          />

          <div className="flex items-center gap-2">
            <Button
              onClick={parseInput}
              disabled={!input.trim()}
              variant="outline"
              size="sm"
              data-testid="button-parse"
            >
              Parse Data
            </Button>
            {parsedShipments.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {validCount} shipment{validCount !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  📦 {totalBoxes} box{totalBoxes !== 1 ? "es" : ""}
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {invalidCount} errors
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {parsedShipments.length > 0 && (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Preview ({parsedShipments.length} rows)</h3>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || isImporting}
                size="sm"
                data-testid="button-import"
                className="gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Import {validCount} Shipment{validCount !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {parsedShipments.map((shipment, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border text-sm ${
                    shipment.isValid
                      ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20"
                      : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
                  }`}
                  data-testid={`preview-row-${index}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div>
                          <span className="text-xs text-muted-foreground">Master Tracking:</span>
                          <code className="block font-mono text-sm font-medium">
                            {shipment.trackingNumber || "(empty)"}
                          </code>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Status:</span>
                          <p className="text-sm font-medium">{shipment.status}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Shipper:</span>
                          <p className="text-xs">{shipment.shipperCompany || shipment.shipperName || "(empty)"}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Package Count:</span>
                          <p className="text-sm font-bold">
                            {shipment.packageCount} pkg{shipment.packageCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      
                      {shipment.childTrackingNumbers && shipment.childTrackingNumbers.length > 0 && (
                        <div className="pt-2 border-t border-muted">
                          <span className="text-xs text-muted-foreground">Child Tracking Numbers ({shipment.childTrackingNumbers.length}):</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {shipment.childTrackingNumbers.map((childNum, idx) => (
                              <Badge key={idx} variant="secondary" className="font-mono text-xs">
                                {childNum}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {shipment.isValid ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          <div className="text-xs text-red-600 text-right">
                            {shipment.errors.map((error, i) => (
                              <div key={i}>{error}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
