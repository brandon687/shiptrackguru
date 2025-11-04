import { Badge } from "@/components/ui/badge";
import { Circle, Package, Truck, CheckCircle2, AlertCircle, Clock, Tag } from "lucide-react";
import { LucideIcon } from "lucide-react";

export type ShipmentStatus = string;

interface StatusBadgeProps {
  status: ShipmentStatus;
  className?: string;
}

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  className: string;
}

// Map common FedEx status values to visual config
const statusConfig: Record<string, StatusConfig> = {
  // FedEx actual statuses
  "Label created": {
    label: "Label Created",
    icon: Tag,
    className: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  },
  "Delivery updated": {
    label: "Delivery Updated",
    icon: Clock,
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900",
  },
  "On the way": {
    label: "On the Way",
    icon: Truck,
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900",
  },
  "Running late": {
    label: "Running Late",
    icon: AlertCircle,
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900",
  },
  "We have your package": {
    label: "Package Received",
    icon: Package,
    className: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400 dark:border-indigo-900",
  },
  "Out for delivery": {
    label: "Out for Delivery",
    icon: Package,
    className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-900",
  },
  "Delivered": {
    label: "Delivered",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900",
  },
  "Exception": {
    label: "Exception",
    icon: AlertCircle,
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900",
  },
  "Pending": {
    label: "Pending",
    icon: Clock,
    className: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  },
  // Legacy statuses for backward compatibility
  "in_transit": {
    label: "In Transit",
    icon: Truck,
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900",
  },
  "out_for_delivery": {
    label: "Out for Delivery",
    icon: Package,
    className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-900",
  },
  "delivered": {
    label: "Delivered",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900",
  },
  "exception": {
    label: "Exception",
    icon: AlertCircle,
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900",
  },
  "pending": {
    label: "Pending",
    icon: Clock,
    className: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  },
  "picked_up": {
    label: "Picked Up",
    icon: Circle,
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900",
  },
};

// Default config for unknown statuses
const defaultConfig: StatusConfig = {
  label: "Unknown",
  icon: Circle,
  className: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  // Get config for this status, or use default if not found
  const config = statusConfig[status] || {
    ...defaultConfig,
    label: status, // Use the actual status string as the label
  };
  
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.className} ${className} gap-1 px-2.5 py-0.5 text-xs font-medium`}
      data-testid={`badge-status-${status}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
