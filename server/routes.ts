import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertShipmentSchema, insertScannedSessionSchema } from "@shared/schema";
import { z } from "zod";
import { googleSheetsService } from "./services/googleSheets";
import { fedExService } from "./services/fedex";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all shipments
  app.get("/api/shipments", async (req, res) => {
    try {
      const shipments = await storage.getAllShipments();
      res.json(shipments);
    } catch (error) {
      console.error("Error getting shipments:", error);
      res.status(500).json({ error: "Failed to get shipments" });
    }
  });

  // Get all tracking numbers (including manually entered child tracking numbers)
  app.get("/api/tracking-numbers/all", async (req, res) => {
    try {
      const shipments = await storage.getAllShipments();
      const allTrackingNumbers = new Set<string>();

      for (const shipment of shipments) {
        // For single-package shipments, just add the master tracking number
        if (shipment.packageCount === 1) {
          allTrackingNumbers.add(shipment.trackingNumber);
        } 
        // For multi-package shipments, use manually entered child tracking numbers
        else if (shipment.childTrackingNumbers && shipment.childTrackingNumbers.length > 0) {
          shipment.childTrackingNumbers.forEach(tn => allTrackingNumbers.add(tn));
        }
        // If multi-package but no child tracking numbers entered, just show master
        else {
          allTrackingNumbers.add(shipment.trackingNumber);
        }
      }

      res.json(Array.from(allTrackingNumbers).sort());
    } catch (error) {
      console.error("Error getting all tracking numbers:", error);
      res.status(500).json({ error: "Failed to get tracking numbers" });
    }
  });

  // Update child tracking numbers for a shipment
  app.patch("/api/shipments/:trackingNumber/child-tracking-numbers", async (req, res) => {
    try {
      const { trackingNumber } = req.params;
      const { childTrackingNumbers } = req.body;

      if (!Array.isArray(childTrackingNumbers)) {
        return res.status(400).json({ error: "childTrackingNumbers must be an array" });
      }

      // Validate that tracking numbers are non-empty strings
      const validTrackingNumbers = childTrackingNumbers
        .map(tn => String(tn).trim())
        .filter(tn => tn.length > 0);

      const shipment = await storage.getShipmentByTracking(trackingNumber);
      if (!shipment) {
        return res.status(404).json({ error: "Shipment not found" });
      }

      const updatedShipment = await storage.updateChildTrackingNumbers(trackingNumber, validTrackingNumbers);
      res.json(updatedShipment);
    } catch (error) {
      console.error("Error updating child tracking numbers:", error);
      res.status(500).json({ error: "Failed to update child tracking numbers" });
    }
  });

  // Get single shipment by tracking number
  app.get("/api/shipments/:trackingNumber", async (req, res) => {
    try {
      const shipment = await storage.getShipmentByTracking(req.params.trackingNumber);
      if (!shipment) {
        return res.status(404).json({ error: "Shipment not found" });
      }
      res.json(shipment);
    } catch (error) {
      console.error("Error getting shipment:", error);
      res.status(500).json({ error: "Failed to get shipment" });
    }
  });

  // Create single shipment
  app.post("/api/shipments", async (req, res) => {
    try {
      console.log("Received shipment data:", req.body);
      const validatedData = insertShipmentSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      const shipment = await storage.upsertShipment(validatedData);
      res.json(shipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ error: "Invalid shipment data", details: error.errors });
      }
      console.error("Error creating shipment:", error);
      res.status(500).json({ error: "Failed to create shipment" });
    }
  });

  // Bulk import shipments
  app.post("/api/shipments/bulk", async (req, res) => {
    try {
      const shipments = req.body;
      if (!Array.isArray(shipments)) {
        return res.status(400).json({ error: "Expected array of shipments" });
      }

      const results = [];
      for (const shipmentData of shipments) {
        try {
          const validatedData = insertShipmentSchema.parse(shipmentData);
          const shipment = await storage.upsertShipment(validatedData);
          results.push({ success: true, shipment });
        } catch (error) {
          results.push({ 
            success: false, 
            trackingNumber: shipmentData.trackingNumber,
            error: error instanceof Error ? error.message : "Unknown error" 
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.json({
        total: shipments.length,
        successful: successCount,
        failed: shipments.length - successCount,
        results
      });
    } catch (error) {
      console.error("Error bulk importing shipments:", error);
      res.status(500).json({ error: "Failed to bulk import shipments" });
    }
  });

  // Sync from Google Sheets
  app.post("/api/sync/google-sheets", async (req, res) => {
    try {
      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      if (!spreadsheetId) {
        return res.status(400).json({ 
          error: "GOOGLE_SHEET_ID not configured",
          message: "Please set GOOGLE_SHEET_ID in your environment variables"
        });
      }

      if (!googleSheetsService.isConfigured()) {
        return res.status(400).json({ 
          error: "Google Sheets service not configured",
          message: "Please set GOOGLE_SERVICE_ACCOUNT_JSON in your environment variables"
        });
      }

      // Read shipment data from Output sheet
      const sheetData = await googleSheetsService.readShipmentData(spreadsheetId, "Output");
      
      // Get current tracking numbers from the sheet
      const sheetTrackingNumbers = sheetData.map(row => row.trackingnumber || row["tracking number"]);
      
      // Get all shipments currently in database
      const dbShipments = await storage.getAllShipments();
      
      // Delete shipments that are no longer in the Output sheet
      const shipmentsToDelete = dbShipments.filter(
        dbShipment => !sheetTrackingNumbers.includes(dbShipment.trackingNumber)
      );
      
      for (const shipment of shipmentsToDelete) {
        await storage.deleteShipment(shipment.trackingNumber);
        console.log(`Deleted shipment ${shipment.trackingNumber} - no longer in Output sheet`);
      }
      
      const results = [];
      for (const row of sheetData) {
        const trackingNumber = row.trackingnumber || row["tracking number"];
        try {
          // Look up additional data from ALL INBOUND sheet (read-only)
          let inboundRow = null;
          try {
            inboundRow = await googleSheetsService.readShipmentDataByTracking(spreadsheetId, "ALL INBOUND", trackingNumber);
          } catch (error) {
            console.log(`Could not find tracking ${trackingNumber} in ALL INBOUND sheet`);
          }
          
          // Get data from FedEx API as source of truth for status/tracking
          const fedexData = await fedExService.getTrackingInfo(trackingNumber);
          
          // Merge Output + ALL INBOUND + FedEx data
          const shipmentData = {
            trackingNumber: trackingNumber,
            // FedEx as source of truth for status
            status: fedexData?.status || "Pending",
            // Priority: ALL INBOUND > Output > FedEx for expected delivery
            scheduledDelivery: inboundRow?.["scheduled delivery date"] || row.expected_delivery || row.expecteddelivery || row["expected delivery"] || fedexData?.estimatedDelivery || null,
            // ALL INBOUND data for shipper/recipient info
            shipperName: inboundRow?.["shipper name"] || null,
            shipperCompany: row.sender || inboundRow?.["shipper company"] || null,
            recipientName: inboundRow?.["recipient contact name"] || null,
            recipientCompany: inboundRow?.["recipient company"] || null,
            masterTrackingNumber: inboundRow?.["master tracking number"] || null,
            packageCount: row.package_count ? parseInt(row.package_count) : (inboundRow?.["no. of packages"] ? parseInt(inboundRow["no. of packages"]) : 1),
            packageType: inboundRow?.["package type"] || null,
            packageWeight: row.package_weight || inboundRow?.["pkg wt (lbs)"] || null,
            totalWeight: row.total_weight || inboundRow?.["total wt (lbs)"] || null,
            direction: inboundRow?.direction || null,
            serviceType: row.service_type || inboundRow?.["service type"] || null,
            googleSheetRow: null,
            fedexRawData: fedexData ? JSON.stringify(fedexData) : null,
          };
          
          const validatedData = insertShipmentSchema.parse(shipmentData);
          const shipment = await storage.upsertShipment(validatedData);
          
          // Log successful sync
          await storage.createSyncLog({
            source: "google_sheets",
            trackingNumber,
            success: 1,
            errorMessage: null,
            errorStack: null,
            sheetData: JSON.stringify(row),
            responseData: fedexData ? JSON.stringify(fedexData) : null,
          });
          
          results.push({ 
            success: true, 
            shipment, 
            trackingNumber,
            source: "google_sheets_merged_with_fedex"
          });
        } catch (error) {
          console.error(`Error processing tracking number ${trackingNumber}:`, error);
          
          // Log failed sync
          await storage.createSyncLog({
            source: "google_sheets",
            trackingNumber,
            success: 0,
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorStack: error instanceof Error ? error.stack : undefined,
            sheetData: JSON.stringify(row),
            responseData: null,
          });
          
          results.push({ 
            success: false, 
            trackingNumber,
            sheetData: row,
            error: error instanceof Error ? error.message : "Unknown error",
            errorStack: error instanceof Error ? error.stack : undefined
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.json({
        total: sheetData.length,
        successful: successCount,
        failed: sheetData.length - successCount,
        results
      });
    } catch (error) {
      console.error("Error syncing from Google Sheets:", error);
      res.status(500).json({ 
        error: "Failed to sync from Google Sheets",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Validate tracking number with FedEx
  app.post("/api/fedex/validate/:trackingNumber", async (req, res) => {
    try {
      const { trackingNumber } = req.params;
      const isValid = await fedExService.validateTrackingNumber(trackingNumber);
      res.json({ trackingNumber, isValid });
    } catch (error) {
      console.error("Error validating tracking number:", error);
      res.status(500).json({ error: "Failed to validate tracking number" });
    }
  });

  // Get FedEx tracking info
  app.get("/api/fedex/track/:trackingNumber", async (req, res) => {
    try {
      const { trackingNumber } = req.params;
      const trackingInfo = await fedExService.getTrackingInfo(trackingNumber);
      
      if (!trackingInfo) {
        return res.status(404).json({ error: "Tracking information not found" });
      }

      // Update shipment in storage with FedEx data
      const shipment = await storage.getShipmentByTracking(trackingNumber);
      if (shipment) {
        await storage.updateShipment(shipment.id, {
          status: trackingInfo.status,
          fedexRawData: JSON.stringify(trackingInfo),
        });
      }

      res.json(trackingInfo);
    } catch (error) {
      console.error("Error getting FedEx tracking info:", error);
      res.status(500).json({ error: "Failed to get tracking information" });
    }
  });

  // Refresh all shipments with FedEx data
  app.post("/api/fedex/refresh-all", async (req, res) => {
    try {
      if (!fedExService.isConfigured()) {
        return res.status(400).json({ 
          error: "FedEx API not configured",
          message: "Please set FEDEX_API_KEY and FEDEX_API_SECRET in your environment variables"
        });
      }

      const shipments = await storage.getAllShipments();
      const results = [];

      for (const shipment of shipments) {
        try {
          const trackingInfo = await fedExService.getTrackingInfo(shipment.trackingNumber);
          if (trackingInfo) {
            await storage.updateShipment(shipment.id, {
              status: trackingInfo.status,
              fedexRawData: JSON.stringify(trackingInfo),
            });
            results.push({ success: true, trackingNumber: shipment.trackingNumber, status: trackingInfo.status });
          } else {
            results.push({ success: false, trackingNumber: shipment.trackingNumber, error: "No tracking info found" });
          }
        } catch (error) {
          results.push({ 
            success: false, 
            trackingNumber: shipment.trackingNumber,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.json({
        total: shipments.length,
        successful: successCount,
        failed: shipments.length - successCount,
        results
      });
    } catch (error) {
      console.error("Error refreshing FedEx data:", error);
      res.status(500).json({ error: "Failed to refresh FedEx data" });
    }
  });

  // Delete single shipment by tracking number
  app.delete("/api/shipments/:trackingNumber", async (req, res) => {
    try {
      const { trackingNumber } = req.params;
      const deleted = await storage.deleteShipment(trackingNumber);
      
      if (!deleted) {
        return res.status(404).json({ error: "Shipment not found" });
      }
      
      res.json({ message: "Shipment deleted", trackingNumber });
    } catch (error) {
      console.error("Error deleting shipment:", error);
      res.status(500).json({ error: "Failed to delete shipment" });
    }
  });

  // Delete all shipments (for development/testing)
  app.delete("/api/shipments", async (req, res) => {
    try {
      await storage.deleteAllShipments();
      res.json({ message: "All shipments deleted" });
    } catch (error) {
      console.error("Error deleting shipments:", error);
      res.status(500).json({ error: "Failed to delete shipments" });
    }
  });

  // Get all sync logs
  app.get("/api/sync-logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getAllSyncLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error getting sync logs:", error);
      res.status(500).json({ error: "Failed to get sync logs" });
    }
  });

  // Get sync logs for specific tracking number
  app.get("/api/sync-logs/:trackingNumber", async (req, res) => {
    try {
      const { trackingNumber } = req.params;
      const logs = await storage.getSyncLogsByTracking(trackingNumber);
      res.json(logs);
    } catch (error) {
      console.error("Error getting sync logs for tracking number:", error);
      res.status(500).json({ error: "Failed to get sync logs" });
    }
  });

  // Get all scanned sessions
  app.get("/api/scanned-sessions", async (req, res) => {
    try {
      const sessions = await storage.getAllScannedSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error getting scanned sessions:", error);
      res.status(500).json({ error: "Failed to get scanned sessions" });
    }
  });

  // Create new scanned session
  app.post("/api/scanned-sessions", async (req, res) => {
    try {
      const validatedData = insertScannedSessionSchema.parse(req.body);
      const session = await storage.createScannedSession(validatedData);
      res.json(session);
    } catch (error) {
      console.error("Error creating scanned session:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create scanned session" });
    }
  });

  // Delete scanned session
  app.delete("/api/scanned-sessions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteScannedSession(id);
      res.json({ message: "Scanned session deleted" });
    } catch (error) {
      console.error("Error deleting scanned session:", error);
      res.status(500).json({ error: "Failed to delete scanned session" });
    }
  });

  // Mark shipments as not scanned
  app.post("/api/shipments/mark-not-scanned", async (req, res) => {
    try {
      const { trackingNumbers } = req.body;
      
      if (!Array.isArray(trackingNumbers) || trackingNumbers.length === 0) {
        return res.status(400).json({ error: "trackingNumbers must be a non-empty array" });
      }

      await storage.markShipmentsAsNotScanned(trackingNumbers);
      res.json({ 
        message: "Shipments marked as not scanned", 
        count: trackingNumbers.length 
      });
    } catch (error) {
      console.error("Error marking shipments as not scanned:", error);
      res.status(500).json({ error: "Failed to mark shipments as not scanned" });
    }
  });

  // Mark shipments as scanned
  app.post("/api/shipments/mark-scanned", async (req, res) => {
    try {
      const { trackingNumbers } = req.body;
      
      if (!Array.isArray(trackingNumbers) || trackingNumbers.length === 0) {
        return res.status(400).json({ error: "trackingNumbers must be a non-empty array" });
      }

      await storage.markShipmentsAsScanned(trackingNumbers);
      res.json({ 
        message: "Shipments marked as scanned", 
        count: trackingNumbers.length 
      });
    } catch (error) {
      console.error("Error marking shipments as scanned:", error);
      res.status(500).json({ error: "Failed to mark shipments as scanned" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
