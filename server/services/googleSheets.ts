import { google } from "googleapis";

export class GoogleSheetsService {
  private sheets;
  private auth;

  constructor() {
    try {
      const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      if (!serviceAccountJson) {
        console.log("Google Sheets integration not configured - GOOGLE_SERVICE_ACCOUNT_JSON not set");
        return;
      }

      const credentials = JSON.parse(serviceAccountJson);
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });

      this.sheets = google.sheets({ version: "v4", auth: this.auth });
    } catch (error) {
      console.error("Failed to initialize Google Sheets service:", error);
    }
  }

  private isValidTrackingNumber(value: string): boolean {
    // FedEx tracking numbers are typically 12-15 digits, may contain some letters
    // Filter out headers like "Tracking Number", "TRACKING", empty strings, etc.
    const trimmed = value.trim();
    
    // Reject if empty
    if (!trimmed || trimmed.length === 0) {
      return false;
    }
    
    // Reject if it looks like a header (contains common header words)
    const headerPatterns = /tracking|number|#|shipment|status|delivery/i;
    if (headerPatterns.test(trimmed)) {
      return false;
    }
    
    // Accept if it's mostly digits (at least 70% digits) and reasonable length
    const digitCount = (trimmed.match(/\d/g) || []).length;
    const digitRatio = digitCount / trimmed.length;
    
    // Valid tracking numbers: 10-20 characters, at least 70% digits
    return trimmed.length >= 10 && 
           trimmed.length <= 20 && 
           digitRatio >= 0.7;
  }

  async readTrackingNumbers(spreadsheetId: string, range: string = "INBOUND!A5:A"): Promise<string[]> {
    if (!this.sheets) {
      throw new Error("Google Sheets service not initialized");
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return [];
      }

      // Extract and validate tracking numbers from column A, starting from row 5
      const validTrackingNumbers = rows
        .map(row => row[0]?.toString().trim())
        .filter(value => value && this.isValidTrackingNumber(value));
      
      console.log(`Found ${validTrackingNumbers.length} valid tracking numbers out of ${rows.length} rows`);
      
      return validTrackingNumbers;
    } catch (error) {
      console.error("Error reading from Google Sheets:", error);
      throw new Error("Failed to read from Google Sheets");
    }
  }

  private escapeSheetName(sheetName: string): string {
    // If sheet name contains spaces or special characters, wrap it in single quotes
    if (sheetName.includes(' ') || sheetName.includes('!') || sheetName.includes("'")) {
      // Escape single quotes within the name by doubling them
      const escaped = sheetName.replace(/'/g, "''");
      return `'${escaped}'`;
    }
    return sheetName;
  }

  async readShipmentData(spreadsheetId: string, sheetName: string = "Sheet2"): Promise<any[]> {
    if (!this.sheets) {
      throw new Error("Google Sheets service not initialized");
    }

    try {
      // Read all data starting from row 1 (headers) to get column mappings
      const range = `${this.escapeSheetName(sheetName)}!A1:Z`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log("No data found in sheet");
        return [];
      }

      // First row contains headers
      const headers = rows[0].map((h: string) => h.trim().toLowerCase());
      console.log(`Found headers: ${headers.join(", ")}`);

      // Map remaining rows to objects
      const shipments = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const shipment: any = {};
        
        // Map each column to its header
        headers.forEach((header, index) => {
          const value = row[index]?.toString().trim();
          if (value) {
            shipment[header] = value;
          }
        });

        // Only include rows with a tracking number
        const trackingNum = shipment.trackingnumber || shipment["tracking number"];
        if (trackingNum && this.isValidTrackingNumber(trackingNum)) {
          shipments.push(shipment);
        }
      }

      console.log(`Found ${shipments.length} valid shipments out of ${rows.length - 1} rows`);
      return shipments;
    } catch (error) {
      console.error("Error reading shipment data from Google Sheets:", error);
      throw new Error("Failed to read shipment data from Google Sheets");
    }
  }

  async readShipmentDataByTracking(spreadsheetId: string, sheetName: string, trackingNumber: string): Promise<any | null> {
    if (!this.sheets) {
      throw new Error("Google Sheets service not initialized");
    }

    try {
      // Read all data from the sheet
      const range = `${this.escapeSheetName(sheetName)}!A1:Z`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return null;
      }

      // First row contains headers
      const headers = rows[0].map((h: string) => h.trim().toLowerCase());

      // Search for matching tracking number
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowData: any = {};
        
        // Map each column to its header
        headers.forEach((header, index) => {
          const value = row[index]?.toString().trim();
          if (value) {
            rowData[header] = value;
          }
        });

        const rowTracking = rowData.trackingnumber || rowData["tracking number"];
        if (rowTracking === trackingNumber) {
          return rowData;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error looking up tracking ${trackingNumber} in ${sheetName}:`, error);
      return null;
    }
  }

  isConfigured(): boolean {
    return !!this.sheets;
  }
}

export const googleSheetsService = new GoogleSheetsService();
