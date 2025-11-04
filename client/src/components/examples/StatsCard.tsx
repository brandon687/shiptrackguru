import { StatsCard } from "../StatsCard";
import { Package, Truck, CheckCircle2, AlertCircle } from "lucide-react";

export default function StatsCardExample() {
  return (
    <div className="p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Shipments"
          value={127}
          icon={Package}
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          title="In Transit"
          value={45}
          icon={Truck}
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          title="Delivered Today"
          value={23}
          icon={CheckCircle2}
        />
        <StatsCard
          title="Exceptions"
          value={3}
          icon={AlertCircle}
          trend={{ value: 2, isPositive: false }}
        />
      </div>
    </div>
  );
}
