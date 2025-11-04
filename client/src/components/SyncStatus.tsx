import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SyncStatusProps {
  lastSynced?: Date;
  onSync?: () => void;
}

export function SyncStatus({ lastSynced, onSync }: SyncStatusProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [, setTick] = useState(0); // Force re-render every second
  const { toast } = useToast();

  const handleSync = async () => {
    setIsSyncing(true);
    console.log("Syncing with Google Sheets and FedEx API...");
    
    try {
      onSync?.();
      // Give time for the sync to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
    } finally {
      setIsSyncing(false);
    }
  };

  const resetAllMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/shipments");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracking-numbers/all"] });
      toast({
        title: "All Data Cleared",
        description: "All tracking data has been reset. You can now sync new data.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset data",
        variant: "destructive",
      });
    },
  });

  const getTimeSince = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Update the time display every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(tick => tick + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3">
      {lastSynced && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-muted-foreground">
            Last synced: <span className="font-medium text-foreground">{getTimeSince(lastSynced)}</span>
          </span>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={isSyncing}
        data-testid="button-sync"
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
        {isSyncing ? "Refreshing..." : "Refresh Tracking"}
      </Button>
      
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            size="sm"
            data-testid="button-reset-all"
            className="gap-2"
            disabled={resetAllMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
            {resetAllMutation.isPending ? "Resetting..." : "Reset All Data"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Tracking Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all shipment data from the database. 
              This action cannot be undone. You can sync new data after resetting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              data-testid="button-cancel-reset"
              disabled={resetAllMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-reset"
              onClick={() => resetAllMutation.mutate()}
              disabled={resetAllMutation.isPending}
            >
              {resetAllMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Resetting...
                </div>
              ) : (
                "Reset All Data"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
