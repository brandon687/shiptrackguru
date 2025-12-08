import axios, { AxiosError } from "axios";

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
  childTrackingNumbers?: string[];
  rawApiResponse?: any;
}

interface QueuedRequest {
  trackingNumber: string;
  resolve: (value: FedExTrackingInfo | null) => void;
  reject: (error: any) => void;
  retryCount: number;
  addedAt: number;
}

export class FedExService {
  private apiKey: string | undefined;
  private apiSecret: string | undefined;
  private accountNumber: string | undefined;
  private baseUrl = "https://apis.fedex.com";

  // Rate limiting
  private lastRequestTime = 0;
  private minRequestInterval = 2000; // 2 seconds between requests (conservative)

  // Request queue
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;

  // Retry configuration
  private readonly maxRetries = 3;
  private readonly retryDelays = [30000, 60000, 120000]; // 30s, 1m, 2m

  // Token caching
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;

  // Request timeout
  private readonly requestTimeout = 30000; // 30 seconds

  constructor() {
    this.apiKey = process.env.FEDEX_API_KEY;
    this.apiSecret = process.env.FEDEX_SECRET_KEY || process.env.FEDEX_API_SECRET;
    this.accountNumber = process.env.FEDEX_ACCOUNT_NUMBER;

    if (!this.apiKey || !this.apiSecret) {
      console.warn("⚠️  FedEx API not configured - FEDEX_API_KEY or FEDEX_SECRET_KEY not set");
    } else {
      console.log("✅ FedEx API configured successfully");
      if (this.accountNumber) {
        console.log(`📦 FedEx Account Number: ${this.accountNumber}`);
      }
    }
  }

  /**
   * Check if FedEx API is properly configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret);
  }

  /**
   * Validate tracking number format
   */
  async validateTrackingNumber(trackingNumber: string): Promise<boolean> {
    if (!this.isConfigured()) {
      // Basic format validation when API not configured
      return /^\d{12,15}$/.test(trackingNumber);
    }

    try {
      const info = await this.getTrackingInfo(trackingNumber);
      return info !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get tracking information for a tracking number
   * Uses queue system to prevent rate limiting
   */
  async getTrackingInfo(trackingNumber: string): Promise<FedExTrackingInfo | null> {
    if (!this.isConfigured()) {
      console.log("FedEx API not configured, skipping tracking lookup");
      return null;
    }

    return new Promise((resolve, reject) => {
      // Add to queue
      this.requestQueue.push({
        trackingNumber,
        resolve,
        reject,
        retryCount: 0,
        addedAt: Date.now(),
      });

      // Start processing queue if not already running
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests one at a time with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;
    console.log(`🔄 Starting queue processing with ${this.requestQueue.length} requests`);

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;

      try {
        // Apply rate limiting
        await this.rateLimit();

        // Make the actual API call
        const result = await this.fetchTrackingInfo(request.trackingNumber);
        request.resolve(result);

        console.log(`✅ Processed tracking: ${request.trackingNumber}`);

      } catch (error: any) {
        // Handle rate limiting with retry
        if (this.isRateLimitError(error)) {
          if (request.retryCount < this.maxRetries) {
            const delay = this.retryDelays[request.retryCount];
            console.warn(`⏳ Rate limit hit for ${request.trackingNumber}, retrying in ${delay/1000}s (attempt ${request.retryCount + 1}/${this.maxRetries})`);

            // Re-queue with incremented retry count
            request.retryCount++;

            // Wait before re-queuing
            await new Promise(resolve => setTimeout(resolve, delay));
            this.requestQueue.push(request);
          } else {
            console.error(`❌ Max retries exceeded for ${request.trackingNumber}`);
            request.reject(new Error('Rate limit exceeded after max retries'));
          }
        } else {
          // Non-rate-limit error
          console.error(`❌ Error processing ${request.trackingNumber}:`, error.message);
          request.reject(error);
        }
      }
    }

    this.isProcessingQueue = false;
    console.log('✅ Queue processing completed');
  }

  /**
   * Apply rate limiting between requests
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏱️  Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch tracking info from FedEx API with timeout
   */
  private async fetchTrackingInfo(trackingNumber: string): Promise<FedExTrackingInfo | null> {
    try {
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
          timeout: this.requestTimeout,
        }
      );

      return this.parseTrackingResponse(trackingNumber, response.data);

    } catch (error: any) {
      if (this.isRateLimitError(error)) {
        throw error; // Let queue handler deal with rate limits
      }

      if (error.code === 'ECONNABORTED') {
        console.error(`⏱️  Request timeout for ${trackingNumber}`);
        return null;
      }

      console.error(`Error fetching tracking info for ${trackingNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Parse FedEx API response and extract tracking information
   */
  private parseTrackingResponse(trackingNumber: string, data: any): FedExTrackingInfo | null {
    const trackingResult = data.output?.completeTrackResults?.[0];
    if (!trackingResult) {
      console.warn(`No tracking results for ${trackingNumber}`);
      return null;
    }

    const latestStatus = trackingResult.trackResults?.[0];
    if (!latestStatus) {
      console.warn(`No track results for ${trackingNumber}`);
      return null;
    }

    // Extract child tracking numbers (for multi-package shipments)
    const childTrackingNumbers = this.extractChildTrackingNumbers(data);

    const result: FedExTrackingInfo = {
      trackingNumber,
      status: this.mapFedExStatus(latestStatus?.latestStatusDetail?.code),
      estimatedDelivery: latestStatus?.dateAndTimes?.find((d: any) => d.type === "ESTIMATED_DELIVERY")?.dateTime,
      lastLocation: this.formatLocation(latestStatus?.latestStatusDetail?.scanLocation),
      events: (latestStatus?.scanEvents || []).map((event: any) => ({
        timestamp: event.date,
        location: this.formatLocation(event.scanLocation),
        status: event.eventDescription,
        description: event.eventDescription,
      })),
      childTrackingNumbers,
      rawApiResponse: data, // Store full response for debugging
    };

    console.log(`📦 Parsed ${trackingNumber}: ${result.status}${childTrackingNumbers.length > 0 ? ` (${childTrackingNumbers.length} child packages)` : ''}`);

    return result;
  }

  /**
   * Extract child tracking numbers from API response
   * This eliminates the need for manual entry
   */
  private extractChildTrackingNumbers(data: any): string[] {
    const childNumbers: string[] = [];

    try {
      // Check for associated shipments in the response
      const trackResults = data.output?.completeTrackResults?.[0]?.trackResults || [];

      for (const result of trackResults) {
        // Look for additional tracking numbers in various response fields
        const associatedTrackingNumbers = result.associatedTrackingNumbers || [];
        childNumbers.push(...associatedTrackingNumbers);

        // Check packageDetails for individual package tracking numbers
        const packageDetails = result.packageDetails || [];
        for (const pkg of packageDetails) {
          if (pkg.trackingNumber && !childNumbers.includes(pkg.trackingNumber)) {
            childNumbers.push(pkg.trackingNumber);
          }
        }
      }
    } catch (error) {
      console.warn('Could not extract child tracking numbers:', error);
    }

    return Array.from(new Set(childNumbers)); // Remove duplicates
  }

  /**
   * Format location from FedEx response
   */
  private formatLocation(location: any): string {
    if (!location) return '';

    const parts = [
      location.city,
      location.stateOrProvinceCode,
      location.countryCode,
    ].filter(Boolean);

    return parts.join(', ');
  }

  /**
   * Get OAuth access token with caching
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.cachedToken && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

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
          timeout: 10000, // 10 second timeout for auth
        }
      );

      const token = response.data.access_token;
      if (!token) {
        throw new Error("No access token in response");
      }

      this.cachedToken = token;
      // Cache token for 50 minutes (they expire in 60 minutes)
      this.tokenExpiry = Date.now() + (50 * 60 * 1000);

      console.log('🔑 FedEx access token obtained and cached');
      return token;

    } catch (error) {
      console.error("Error getting FedEx access token:", error);
      throw new Error("Failed to authenticate with FedEx API");
    }
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    return error.response?.status === 429 ||
           error.message?.includes('rate limit') ||
           error.message?.includes('429');
  }

  /**
   * Map FedEx status codes to our internal status
   */
  private mapFedExStatus(fedexStatus: string): string {
    const statusMap: Record<string, string> = {
      'IT': 'in_transit',
      'OD': 'out_for_delivery',
      'DL': 'delivered',
      'DE': 'exception',
      'PU': 'picked_up',
      'OC': 'picked_up', // On FedEx vehicle for pickup
      'AR': 'in_transit', // Arrived at FedEx location
      'DP': 'in_transit', // Departed FedEx location
      'PX': 'picked_up', // Picked up
    };

    return statusMap[fedexStatus] || 'pending';
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessingQueue,
    };
  }

  /**
   * Clear the request queue (for emergency situations)
   */
  clearQueue(): void {
    console.warn('⚠️  Clearing FedEx request queue');
    this.requestQueue = [];
  }
}

export const fedExService = new FedExService();
