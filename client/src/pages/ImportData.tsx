import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkImport } from "@/components/BulkImport";
import { ManualEntry } from "@/components/ManualEntry";
import { Upload, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function ImportData() {
  const handleBulkImport = async (shipments: any[]) => {
    await apiRequest("POST", "/api/shipments/bulk", shipments);
    queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
  };

  const handleManualAdd = async (shipment: any) => {
    await apiRequest("POST", "/api/shipments", shipment);
    queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Import Shipment Data</h1>
          <p className="text-muted-foreground mt-1">
            Load shipment data manually from your spreadsheet or add individual entries
          </p>
        </div>

        <Tabs defaultValue="bulk" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="bulk" className="gap-2" data-testid="tab-bulk">
              <Upload className="h-4 w-4" />
              Bulk Import
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2" data-testid="tab-manual">
              <Plus className="h-4 w-4" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bulk" className="mt-6">
            <BulkImport onImport={handleBulkImport} />
          </TabsContent>

          <TabsContent value="manual" className="mt-6">
            <ManualEntry onAdd={handleManualAdd} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
