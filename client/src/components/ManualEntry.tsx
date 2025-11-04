import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ManualEntryProps {
  onAdd: (shipment: {
    trackingNumber: string;
    shipper: string;
    service: string;
    totalWeight: string;
    count: number;
    lastLocation: string;
  }) => Promise<void>;
}

export function ManualEntry({ onAdd }: ManualEntryProps) {
  const [formData, setFormData] = useState({
    trackingNumber: "",
    shipper: "",
    service: "",
    totalWeight: "",
    count: "",
    lastLocation: "",
  });
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const count = parseInt(formData.count);
    if (isNaN(count) || count <= 0) {
      toast({
        title: "Invalid count",
        description: "Please enter a valid package count",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      await onAdd({
        ...formData,
        count,
      });
      toast({
        title: "Shipment added",
        description: `Tracking ${formData.trackingNumber} added successfully`,
      });
      setFormData({
        trackingNumber: "",
        shipper: "",
        service: "",
        totalWeight: "",
        count: "",
        lastLocation: "",
      });
    } catch (error) {
      toast({
        title: "Failed to add shipment",
        description: "An error occurred while adding the shipment",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-3">Add Single Shipment</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="trackingNumber" className="text-xs">
              Tracking Number *
            </Label>
            <Input
              id="trackingNumber"
              value={formData.trackingNumber}
              onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
              placeholder="885508936262"
              className="font-mono"
              required
              data-testid="input-tracking"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shipper" className="text-xs">
              Shipper Location *
            </Label>
            <Input
              id="shipper"
              value={formData.shipper}
              onChange={(e) => setFormData({ ...formData, shipper: e.target.value })}
              placeholder="COPPELL, TX"
              required
              data-testid="input-shipper"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service" className="text-xs">
              Service Type *
            </Label>
            <Input
              id="service"
              value={formData.service}
              onChange={(e) => setFormData({ ...formData, service: e.target.value })}
              placeholder="FEDEX_1_DAY_FREIGHT"
              required
              data-testid="input-service"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalWeight" className="text-xs">
              Total Weight *
            </Label>
            <Input
              id="totalWeight"
              value={formData.totalWeight}
              onChange={(e) => setFormData({ ...formData, totalWeight: e.target.value })}
              placeholder="648.0LB"
              required
              data-testid="input-weight"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="count" className="text-xs">
              Package Count *
            </Label>
            <Input
              id="count"
              type="number"
              min="1"
              value={formData.count}
              onChange={(e) => setFormData({ ...formData, count: e.target.value })}
              placeholder="1"
              required
              data-testid="input-count"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastLocation" className="text-xs">
              Last Location
            </Label>
            <Input
              id="lastLocation"
              value={formData.lastLocation}
              onChange={(e) => setFormData({ ...formData, lastLocation: e.target.value })}
              placeholder="Dallas, TX"
              data-testid="input-location"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={isAdding}
            data-testid="button-add-shipment"
            className="gap-2"
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add Shipment
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
