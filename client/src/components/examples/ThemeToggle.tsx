import { ThemeToggle } from "../ThemeToggle";
import { ThemeProvider } from "../ThemeProvider";

export default function ThemeToggleExample() {
  return (
    <ThemeProvider>
      <div className="p-8">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Toggle theme:</span>
          <ThemeToggle />
        </div>
      </div>
    </ThemeProvider>
  );
}
