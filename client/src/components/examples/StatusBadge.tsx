import { StatusBadge } from "../StatusBadge";

export default function StatusBadgeExample() {
  return (
    <div className="p-8 space-y-4">
      <h3 className="text-lg font-semibold mb-4">Status Badges</h3>
      <div className="flex flex-wrap gap-3">
        <StatusBadge status="in_transit" />
        <StatusBadge status="out_for_delivery" />
        <StatusBadge status="delivered" />
        <StatusBadge status="exception" />
        <StatusBadge status="pending" />
        <StatusBadge status="picked_up" />
      </div>
    </div>
  );
}
