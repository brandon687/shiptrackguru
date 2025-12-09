import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date/time string to PST timezone with 12-hour format
 * Example output: "12/09/2025 3:45 PM PST"
 * @param dateString - ISO date string or any valid date string
 * @returns Formatted date string in PST, or null if invalid
 */
export function formatDateTimePST(dateString: string | null | undefined): string | null {
  if (!dateString) return null;

  try {
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) return null;

    // Format to PST (America/Los_Angeles timezone)
    const formattedDate = date.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return `${formattedDate} PST`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
}
