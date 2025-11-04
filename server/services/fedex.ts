import axios from "axios";

interface FedExTrackingInfo {
  trackingNumber: string;
  status: string;
  estimatedDelivery?: string;
  lastLocation?: string;
  events: Array<{
    timestamp: string;
    location: string;
    status: string;
    description: string;
  }>;
}

export class FedExService {
  private apiKey: string | undefined;
  private apiSecret: string | undefined;
  private baseUrl = "https://apis.fedex.com";
  private lastRequestTime = 0;
  private minRequestInterval = 2000; // Minimum 2 seconds between requests

  constructor() {
    this.apiKey = process.env.FEDEX_API_KEY;
    this.apiSecret = process.env.FEDEX_SECRET_KEY || process.env.FEDEX_API_SECRET;

    if (!this.apiKey || !this.apiSecret) {
      console.log("FedEx API not configured - FEDEX_API_KEY or FEDEX_SECRET_KEY not set");
      console.log(`FEDEX_API_KEY present: ${!!process.env.FEDEX_API_KEY}`);
      console.log(`FEDEX_SECRET_KEY present: ${!!process.env.FEDEX_SECRET_KEY}`);
      console.log(`FEDEX_API_SECRET present: ${!!process.env.FEDEX_API_SECRET}`);
    } else {
      console.log("FedEx API configured successfully");
    }
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  async validateTrackingNumber(trackingNumber: string): Promise<boolean> {
    if (!this.isConfigured()) {
      // Basic format validation when API not configured
      return /^\d{12,15}$/.test(trackingNumber);
    }

    try {
      await this.getTrackingInfo(trackingNumber);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getTrackingInfo(trackingNumber: string): Promise<FedExTrackingInfo | null> {
    if (!this.isConfigured()) {
      console.log("FedEx API not configured, skipping tracking lookup");
      return null;
    }

    try {
      // Apply rate limiting before making request
      await this.rateLimit();

      const token = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseUrl}/track/v1/trackingnumbers`,
        {
          trackingInfo: [
            {
              trackingNumberInfo: {
                trackingNumber,
              },
            },
          ],
          includeDetailedScans: true,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Log the full response structure for debugging
      console.log("=== FULL FEDEX API RESPONSE ===");
      console.log(JSON.stringify(response.data, null, 2));
      console.log("================================");

      const trackingResult = response.data.output?.completeTrackResults?.[0];
      if (!trackingResult) {
        console.warn("No tracking results in FedEx response");
        return null;
      }

      const latestStatus = trackingResult.trackResults?.[0];

      // Log the structure we're working with
      console.log("Tracking result structure:", {
        hasTrackResults: !!trackingResult.trackResults,
        trackResultsLength: trackingResult.trackResults?.length,
        hasLatestStatusDetail: !!latestStatus?.latestStatusDetail,
        statusCode: latestStatus?.latestStatusDetail?.code,
        hasScanEvents: !!latestStatus?.scanEvents,
        scanEventsLength: latestStatus?.scanEvents?.length,
      });

      // Store the full raw response for extracting child tracking numbers later
      const result = {
        trackingNumber,
        status: this.mapFedExStatus(latestStatus?.latestStatusDetail?.code),
        estimatedDelivery: latestStatus?.dateAndTimes?.find((d: any) => d.type === "ESTIMATED_DELIVERY")?.dateTime,
        lastLocation: latestStatus?.latestStatusDetail?.scanLocation?.city,
        events: (latestStatus?.scanEvents || []).map((event: any) => ({
          timestamp: event.date,
          location: `${event.scanLocation?.city || ""}, ${event.scanLocation?.stateOrProvinceCode || ""}`.trim(),
          status: event.eventDescription,
          description: event.eventDescription,
        })),
      };

      console.log("Parsed result:", {
        status: result.status,
        estimatedDelivery: result.estimatedDelivery,
        lastLocation: result.lastLocation,
        eventsCount: result.events.length,
      });

      // Add the full raw API response for debugging and child tracking number extraction
      (result as any).rawApiResponse = response.data;

      return result;
    } catch (error: any) {
      // Handle rate limiting errors specifically
      if (error.response?.status === 429) {
        console.warn(`Rate limit hit for tracking ${trackingNumber} - will retry later`);
        return null;
      }
      console.error("Error fetching FedEx tracking info:", error.message || error);
      return null;
    }
  }

  private async getAccessToken(): Promise<string> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error("FedEx API credentials not configured");
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth/token`,
        new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.apiKey,
          client_secret: this.apiSecret,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error("Error getting FedEx access token:", error);
      throw new Error("Failed to authenticate with FedEx API");
    }
  }

  private mapFedExStatus(fedexStatus: string): string {
    const statusMap: Record<string, string> = {
      IT: "in_transit",
      OD: "out_for_delivery",
      DL: "delivered",
      DE: "exception",
      PU: "picked_up",
    };

    return statusMap[fedexStatus] || "pending";
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret);
  }
}

export const fedExService = new FedExService();
