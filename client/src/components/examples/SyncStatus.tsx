import { SyncStatus } from "../SyncStatus";

export default function SyncStatusExample() {
  return (
    <div className="p-8">
      <SyncStatus
        lastSynced={new Date(Date.now() - 5 * 60 * 1000)}
        onSync={() => console.log("Sync triggered")}
      />
    </div>
  );
}
