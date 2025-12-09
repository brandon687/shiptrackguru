import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, type ShipmentStatus } from "./StatusBadge";
import { MoreVertical, Search, Copy, Eye, RefreshCw, ArrowUpDown, Filter, X, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export interface Shipment {
  id: string;
  trackingNumber: string;
  status: string;
  statusDescription?: string | null; // FedEx's actual status text like "On the way"
  scheduledDelivery: string | null;
  shipperName: string | null;
  shipperCompany: string | null;
  recipientName: string | null;
  recipientCompany: string | null;
  masterTrackingNumber: string | null;
  packageCount: number;
  packageType: string | null;
  packageWeight: string | null;
  totalWeight: string | null;
  direction: string | null;
  serviceType: string | null;
  lastUpdate: Date;
  googleSheetRow: number | null;
  fedexRawData: string | null;
  childTrackingNumbers: string[] | null;
  notScanned: number;
  manuallyCompleted: number;
  deliveredPackageCount: number;
}

interface ShipmentTableProps {
  shipments: Shipment[];
  onViewDetails?: (shipment: Shipment) => void;
}

type SortField = "trackingNumber" | "shipperCompany" | "packageCount" | "status" | "lastUpdate";
type SortDirection = "asc" | "desc";

export function ShipmentTable({ shipments, onViewDetails }: ShipmentTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastUpdate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Get unique statuses from all shipments
  const availableStatuses = useMemo(() => {
    const statuses = new Set(shipments.map(s => s.status));
    return Array.from(statuses).sort();
  }, [shipments]);

  const deleteMutation = useMutation({
    mutationFn: async (trackingNumber: string) => {
      await apiRequest("DELETE", `/api/shipments/${trackingNumber}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      toast({
        title: "Shipment deleted",
        description: "The tracking number has been removed from your list.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete shipment. Please try again.",
      });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleCopyTracking = (trackingNumber: string) => {
    navigator.clipboard.writeText(trackingNumber);
    toast({
      title: "Copied!",
      description: "Tracking number copied to clipboard.",
    });
  };

  const handleRefreshTracking = (trackingNumber: string) => {
    console.log(`Refreshing tracking for: ${trackingNumber}`);
  };

  const handleDeleteShipment = (trackingNumber: string) => {
    deleteMutation.mutate(trackingNumber);
  };

  const toggleStatus = (status: string) => {
    const newStatuses = new Set(selectedStatuses);
    if (newStatuses.has(status)) {
      newStatuses.delete(status);
    } else {
      newStatuses.add(status);
    }
    setSelectedStatuses(newStatuses);
  };

  const clearStatusFilter = () => {
    setSelectedStatuses(new Set());
  };

  const filteredShipments = shipments.filter((shipment) => {
    // Status filter
    if (selectedStatuses.size > 0 && !selectedStatuses.has(shipment.status)) {
      return false;
    }

    // Search filter
    const search = searchTerm.toLowerCase();
    if (search) {
      return (
        shipment.trackingNumber.toLowerCase().includes(search) ||
        (shipment.shipperCompany?.toLowerCase().includes(search) || false) ||
        (shipment.shipperName?.toLowerCase().includes(search) || false) ||
        (shipment.recipientCompany?.toLowerCase().includes(search) || false) ||
        (shipment.serviceType?.toLowerCase().includes(search) || false) ||
        shipment.status.toLowerCase().includes(search)
      );
    }

    return true;
  });

  const sortedShipments = [...filteredShipments].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];
    
    if (sortField === "lastUpdate") {
      aValue = a.lastUpdate.getTime();
      bValue = b.lastUpdate.getTime();
    }
    
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by tracking #, shipper, recipient, service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-filter-status">
              <Filter className="h-4 w-4" />
              Status
              {selectedStatuses.size > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {selectedStatuses.size}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex items-center justify-between">
              Filter by Status
              {selectedStatuses.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearStatusFilter}
                  className="h-6 px-2 text-xs"
                  data-testid="button-clear-status-filter"
                >
                  Clear
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableStatuses.map((status) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={selectedStatuses.has(status)}
                onCheckedChange={() => toggleStatus(status)}
                data-testid={`checkbox-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <StatusBadge status={status as ShipmentStatus} />
                <span className="ml-2">{status}</span>
              </DropdownMenuCheckboxItem>
            ))}
            {availableStatuses.length === 0 && (
              <div className="p-2 text-sm text-muted-foreground text-center">
                No statuses available
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="text-sm text-muted-foreground">
          {sortedShipments.length} of {shipments.length} shipments
        </div>
      </div>

      {selectedStatuses.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {Array.from(selectedStatuses).map((status) => (
            <Badge
              key={status}
              variant="secondary"
              className="gap-1"
              data-testid={`badge-active-filter-${status.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {status}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover-elevate"
                onClick={() => toggleStatus(status)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">Status</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("trackingNumber")}
                  className="gap-1 px-0 hover-elevate"
                  data-testid="button-sort-tracking"
                >
                  Tracking Number
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("shipperCompany")}
                  className="gap-1 px-0 hover-elevate"
                  data-testid="button-sort-shipper"
                >
                  Shipper
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Service</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("packageCount")}
                  className="gap-1 px-0 hover-elevate"
                  data-testid="button-sort-count"
                >
                  COUNT
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Expected Delivery</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedShipments.map((shipment) => (
              <TableRow
                key={shipment.id}
                className="hover-elevate cursor-pointer"
                onClick={() => onViewDetails?.(shipment)}
                data-testid={`row-shipment-${shipment.trackingNumber}`}
              >
                <TableCell>
                  <StatusBadge status={shipment.status as ShipmentStatus} statusDescription={shipment.statusDescription} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <a
                    href={`https://www.fedex.com/fedextrack/?tracknumbers=${shipment.trackingNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-primary hover:underline"
                    data-testid={`link-tracking-${shipment.id}`}
                  >
                    {shipment.trackingNumber}
                  </a>
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span className="text-sm">{shipment.shipperCompany || shipment.shipperName || "—"}</span>
                    {shipment.direction && (
                      <span className="text-xs text-muted-foreground">{shipment.direction}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {shipment.recipientCompany || shipment.recipientName || "—"}
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {shipment.serviceType || "—"}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {shipment.totalWeight || "—"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary font-bold text-base px-3 py-1"
                    data-testid={`text-count-${shipment.id}`}
                  >
                    {shipment.packageCount}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {shipment.scheduledDelivery || "—"}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-actions-${shipment.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onViewDetails?.(shipment)}
                        data-testid={`button-view-${shipment.id}`}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleCopyTracking(shipment.trackingNumber)}
                        data-testid={`button-copy-${shipment.id}`}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Tracking #
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRefreshTracking(shipment.trackingNumber)}
                        data-testid={`button-refresh-${shipment.id}`}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh Status
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteShipment(shipment.trackingNumber)}
                        className="text-destructive focus:text-destructive"
                        data-testid={`button-delete-${shipment.id}`}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
