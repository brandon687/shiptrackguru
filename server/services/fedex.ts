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

  constructor() {
    this.apiKey = process.env.FEDEX_API_KEY;
    this.apiSecret = process.env.FEDEX_API_SECRET;

    if (!this.apiKey || !this.apiSecret) {
      console.log("FedEx API not configured - FEDEX_API_KEY or FEDEX_API_SECRET not set");
    }
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
      // Note: This is a simplified example. Actual FedEx API integration requires:
      // 1. OAuth token acquisition
      // 2. Proper request formatting according to FedEx API docs
      // 3. Error handling for rate limits, invalid tracking numbers, etc.
      
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

      const trackingResult = response.data.output?.completeTrackResults?.[0];
      if (!trackingResult) {
        return null;
      }

      const latestStatus = trackingResult.trackResults?.[0];
      
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

      // Add the full raw API response for debugging and child tracking number extraction
      (result as any).rawApiResponse = response.data;

      return result;
    } catch (error) {
      console.error("Error fetching FedEx tracking info:", error);
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
