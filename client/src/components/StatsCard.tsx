import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  onClick?: () => void;
}

export function StatsCard({ title, value, icon: Icon, trend, className = "", onClick }: StatsCardProps) {
  return (
    <Card 
      className={`p-4 ${onClick ? 'cursor-pointer hover-elevate active-elevate-2' : ''} ${className}`} 
      data-testid={`card-stats-${title.toLowerCase().replace(/\s+/g, '-')}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-bold" data-testid={`text-stat-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
            {trend && (
              <span
                className={`text-xs font-medium ${
                  trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {trend.isPositive ? "+" : ""}{trend.value}%
              </span>
            )}
          </div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </Card>
  );
}
