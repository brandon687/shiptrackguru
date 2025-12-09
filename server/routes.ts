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

  // Get all tracking numbers (including all child tracking numbers for comparison)
  app.get("/api/tracking-numbers/all", async (req, res) => {
    try {
      const shipments = await storage.getAllShipments();
      const allTrackingNumbers = new Set<string>();

      // Return all child tracking numbers (what you physically scan on each package)
      for (const shipment of shipments) {
        // If shipment has child tracking numbers, add all of them
        if (shipment.childTrackingNumbers && shipment.childTrackingNumbers.length > 0) {
          shipment.childTrackingNumbers.forEach(tn => allTrackingNumbers.add(tn));
        } else {
          // If no child tracking numbers, add the master tracking number
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

  // Update delivered package count for a shipment (for partial deliveries)
  app.patch("/api/shipments/:trackingNumber/delivered-count", async (req, res) => {
    try {
      const { trackingNumber } = req.params;
      const { deliveredPackageCount } = req.body;

      if (typeof deliveredPackageCount !== "number" || deliveredPackageCount < 0) {
        return res.status(400).json({ error: "deliveredPackageCount must be a non-negative number" });
      }

      const shipment = await storage.getShipmentByTracking(trackingNumber);
      if (!shipment) {
        return res.status(404).json({ error: "Shipment not found" });
      }

      if (deliveredPackageCount > shipment.packageCount) {
        return res.status(400).json({
          error: `deliveredPackageCount (${deliveredPackageCount}) cannot exceed total packageCount (${shipment.packageCount})`
        });
      }

      await storage.updateShipment(shipment.id, { deliveredPackageCount });
      const updatedShipment = await storage.getShipmentByTracking(trackingNumber);
      res.json(updatedShipment);
    } catch (error) {
      console.error("Error updating delivered package count:", error);
      res.status(500).json({ error: "Failed to update delivered package count" });
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

  // Test endpoint: Get child tracking numbers for a master tracking number
  app.get("/api/fedex/child-tracking/:masterTrackingNumber", async (req, res) => {
    try {
      const { masterTrackingNumber } = req.params;

      if (!fedExService.isConfigured()) {
        return res.status(400).json({
          error: "FedEx API not configured",
          message: "Please configure FEDEX_API_KEY and FEDEX_SECRET_KEY"
        });
      }

      console.log(`🔍 Looking up child tracking numbers for master: ${masterTrackingNumber}`);

      // Get child tracking numbers using our smart discovery
      const childTrackingNumbers = await fedExService.getAssociatedShipments(masterTrackingNumber);

      // Also get full tracking info to show the package count
      const trackingInfo = await fedExService.getTrackingInfo(masterTrackingNumber);

      res.json({
        masterTrackingNumber,
        childTrackingNumbers,
        childCount: childTrackingNumbers.length,
        packageCount: trackingInfo ? parseInt(trackingInfo.rawApiResponse?.output?.completeTrackResults?.[0]?.trackResults?.[0]?.packageDetails?.count || '1') : null,
        hasAssociatedShipments: trackingInfo?.rawApiResponse?.output?.completeTrackResults?.[0]?.trackResults?.[0]?.additionalTrackingInfo?.hasAssociatedShipments || false,
        trackingInfo
      });
    } catch (error) {
      console.error("Error getting child tracking numbers:", error);
      res.status(500).json({ error: "Failed to get child tracking numbers" });
    }
  });

  // Bulk import shipments
  app.post("/api/shipments/bulk", async (req, res) => {
    try {
      const shipments = req.body;
      if (!Array.isArray(shipments)) {
        return res.status(400).json({ error: "Expected array of shipments" });
      }

      console.log(`📦 Bulk import: Receiving ${shipments.length} shipments`);

      const results = [];
      for (const shipmentData of shipments) {
        try {
          console.log(`🔍 Processing shipment:`, {
            trackingNumber: shipmentData.trackingNumber,
            childTrackingNumbers: shipmentData.childTrackingNumbers,
            hasChildren: !!shipmentData.childTrackingNumbers,
            childCount: shipmentData.childTrackingNumbers?.length || 0
          });

          const validatedData = insertShipmentSchema.parse(shipmentData);

          console.log(`✅ Validated data:`, {
            trackingNumber: validatedData.trackingNumber,
            childTrackingNumbers: validatedData.childTrackingNumbers,
            childCount: validatedData.childTrackingNumbers?.length || 0
          });

          const shipment = await storage.upsertShipment(validatedData);

          console.log(`💾 Saved to DB:`, {
            trackingNumber: shipment.trackingNumber,
            childTrackingNumbers: shipment.childTrackingNumbers,
            childCount: shipment.childTrackingNumbers?.length || 0
          });

          results.push({ success: true, shipment });
        } catch (error) {
          console.error(`❌ Error processing shipment ${shipmentData.trackingNumber}:`, error);
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

      console.log('🔄 Starting Google Sheets sync...');

      // Read shipment data from Output sheet
      const sheetData = await googleSheetsService.readShipmentData(spreadsheetId, "Output");
      console.log(`📊 Found ${sheetData.length} shipments in Google Sheets`);

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
        console.log(`🗑️  Deleted shipment ${shipment.trackingNumber} - no longer in Output sheet`);
      }

      const results = [];
      for (const row of sheetData) {
        const trackingNumber = row.trackingnumber || row["tracking number"];
        try {
          // Check if we should skip FedEx API call (smart caching)
          const existingShipment = dbShipments.find(s => s.trackingNumber === trackingNumber);
          const shouldRefreshFromFedEx = shouldRefreshShipment(existingShipment);

          // Look up additional data from ALL INBOUND sheet (read-only)
          let inboundRow = null;
          try {
            inboundRow = await googleSheetsService.readShipmentDataByTracking(spreadsheetId, "ALL INBOUND", trackingNumber);
          } catch (error) {
            console.log(`Could not find tracking ${trackingNumber} in ALL INBOUND sheet`);
          }

          // Get data from FedEx API as source of truth for status/tracking
          let fedexData = null;
          if (shouldRefreshFromFedEx) {
            console.log(`🔍 Fetching FedEx data for ${trackingNumber}`);
            fedexData = await fedExService.getTrackingInfo(trackingNumber);
          } else {
            console.log(`⚡ Using cached data for ${trackingNumber} (${existingShipment?.status})`);
            // Parse cached FedEx data
            if (existingShipment?.fedexRawData) {
              try {
                fedexData = JSON.parse(existingShipment.fedexRawData);
              } catch (e) {
                console.warn(`Could not parse cached FedEx data for ${trackingNumber}`);
              }
            }
          }

          // Merge Output + ALL INBOUND + FedEx data
          const shipmentData = {
            trackingNumber: trackingNumber,
            // FedEx as source of truth for status
            status: fedexData?.status || existingShipment?.status || "Pending",
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
            fedexRawData: fedexData ? JSON.stringify(fedexData) : existingShipment?.fedexRawData,
            // DON'T include childTrackingNumbers in Google Sheets sync - preserve what's in DB
            // Only update childTrackingNumbers if FedEx API explicitly returns new ones
          };

          // Add childTrackingNumbers ONLY if FedEx API returned new ones (not empty)
          if (fedexData?.childTrackingNumbers && fedexData.childTrackingNumbers.length > 0) {
            (shipmentData as any).childTrackingNumbers = fedexData.childTrackingNumbers;
          }

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
            source: shouldRefreshFromFedEx ? "google_sheets_merged_with_fedex" : "google_sheets_with_cached_fedex",
            childTrackingNumbers: fedexData?.childTrackingNumbers || []
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
      const queueStatus = fedExService.getQueueStatus();

      console.log(`✅ Sync complete: ${successCount}/${sheetData.length} successful`);

      res.json({
        total: sheetData.length,
        successful: successCount,
        failed: sheetData.length - successCount,
        queueStatus,
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

  /**
   * Smart caching: Determine if shipment needs to be refreshed from FedEx API
   */
  function shouldRefreshShipment(shipment: any): boolean {
    if (!shipment) return true; // New shipment, always fetch
    if (!shipment.lastUpdate) return true; // No last update, always fetch

    const now = Date.now();
    const lastUpdate = new Date(shipment.lastUpdate).getTime();
    const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);

    // Don't refresh delivered or manually completed shipments
    if (shipment.status === 'delivered' || shipment.manuallyCompleted === 1) {
      return false;
    }

    // Refresh out_for_delivery every 30 minutes
    if (shipment.status === 'out_for_delivery' && hoursSinceUpdate < 0.5) {
      return false;
    }

    // Refresh in_transit every 2 hours
    if (shipment.status === 'in_transit' && hoursSinceUpdate < 2) {
      return false;
    }

    // Refresh pending/exception more frequently (every hour)
    if ((shipment.status === 'pending' || shipment.status === 'exception') && hoursSinceUpdate < 1) {
      return false;
    }

    return true; // Refresh if none of the conditions above matched
  }

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
    // Disabled due to FedEx API rate limiting
    // Use individual shipment refresh instead
    return res.status(400).json({
      error: "Bulk refresh disabled",
      message: "Bulk refresh has been disabled to prevent FedEx API rate limiting. Please refresh individual shipments using the refresh button in the shipment detail panel."
    });
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

  // Mark shipments as completed
  app.post("/api/shipments/mark-completed", async (req, res) => {
    try {
      const { trackingNumbers } = req.body;

      if (!Array.isArray(trackingNumbers) || trackingNumbers.length === 0) {
        return res.status(400).json({ error: "trackingNumbers must be a non-empty array" });
      }

      await storage.markShipmentsAsCompleted(trackingNumbers);
      res.json({
        message: "Shipments marked as completed",
        count: trackingNumbers.length
      });
    } catch (error) {
      console.error("Error marking shipments as completed:", error);
      res.status(500).json({ error: "Failed to mark shipments as completed" });
    }
  });

  // Reset all scan/completion flags (for testing)
  app.post("/api/shipments/reset-flags", async (req, res) => {
    try {
      const shipments = await storage.getAllShipments();
      for (const shipment of shipments) {
        await storage.updateShipment(shipment.id, {
          notScanned: 0,
          manuallyCompleted: 0,
        });
      }
      res.json({
        message: "All scan and completion flags reset",
        count: shipments.length
      });
    } catch (error) {
      console.error("Error resetting flags:", error);
      res.status(500).json({ error: "Failed to reset flags" });
    }
  });

  // Get all delivered shipments history
  app.get("/api/delivered-shipments", async (req, res) => {
    try {
      const deliveredShipments = await storage.getAllDeliveredShipments();
      res.json(deliveredShipments);
    } catch (error) {
      console.error("Error getting delivered shipments:", error);
      res.status(500).json({ error: "Failed to get delivered shipments" });
    }
  });

  // Archive completed shipments to delivered history
  app.post("/api/shipments/archive-delivered", async (req, res) => {
    try {
      const { trackingNumbers } = req.body;

      if (!Array.isArray(trackingNumbers) || trackingNumbers.length === 0) {
        return res.status(400).json({ error: "trackingNumbers must be a non-empty array" });
      }

      const archived = [];
      for (const trackingNumber of trackingNumbers) {
        const shipment = await storage.getShipmentByTracking(trackingNumber);
        if (shipment && shipment.manuallyCompleted === 1) {
          // Create delivered shipment record
          await storage.createDeliveredShipment({
            trackingNumber: shipment.trackingNumber,
            status: shipment.status,
            shipperCompany: shipment.shipperCompany || null,
            recipientCompany: shipment.recipientCompany || null,
            serviceType: shipment.serviceType || null,
            packageWeight: shipment.packageWeight || null,
            packageCount: shipment.packageCount,
            expectedDelivery: shipment.scheduledDelivery || null,
            actualDelivery: new Date(),
          });
          archived.push(trackingNumber);
        }
      }

      res.json({
        message: "Shipments archived to delivered history",
        count: archived.length,
        archived
      });
    } catch (error) {
      console.error("Error archiving delivered shipments:", error);
      res.status(500).json({ error: "Failed to archive delivered shipments" });
    }
  });

  // Refresh single shipment tracking data from FedEx
  app.post("/api/shipments/:trackingNumber/refresh", async (req, res) => {
    try {
      const { trackingNumber } = req.params;
      const shipment = await storage.getShipmentByTracking(trackingNumber);

      if (!shipment) {
        return res.status(404).json({ error: "Shipment not found" });
      }

      console.log(`🔄 Refreshing tracking data for: ${trackingNumber}`);

      // Check if FedEx service is configured
      if (!fedExService.isConfigured()) {
        console.warn("FedEx API not configured - skipping live refresh");
        return res.json({
          message: "FedEx API not configured - using cached data",
          shipment: shipment,
          fedexData: shipment.fedexRawData ? JSON.parse(shipment.fedexRawData) : null
        });
      }

      // Get live tracking data from FedEx (will be queued automatically)
      const fedexData = await fedExService.getTrackingInfo(trackingNumber);

      if (!fedexData) {
        console.warn(`No tracking data returned from FedEx for: ${trackingNumber}`);
        // Return existing data instead of error
        return res.json({
          message: "No new tracking data available",
          shipment: shipment,
          fedexData: shipment.fedexRawData ? JSON.parse(shipment.fedexRawData) : null
        });
      }

      console.log(`✅ Successfully retrieved FedEx data for: ${trackingNumber}`);
      console.log(`📦 Status: ${fedexData.status}`);
      console.log(`📅 Estimated Delivery: ${fedexData.estimatedDelivery}`);
      console.log(`📍 Events: ${fedexData.events?.length || 0}`);
      if (fedexData.childTrackingNumbers && fedexData.childTrackingNumbers.length > 0) {
        console.log(`👶 Child Tracking Numbers: ${fedexData.childTrackingNumbers.join(', ')}`);
      }

      // Update shipment with latest FedEx data
      // IMPORTANT: Only update childTrackingNumbers if FedEx returns NEW ones (not empty)
      const updates: any = {
        status: fedexData.status || shipment.status,
        scheduledDelivery: fedexData.estimatedDelivery || shipment.scheduledDelivery,
        fedexRawData: JSON.stringify(fedexData),
      };

      // Only update childTrackingNumbers if FedEx API explicitly returns new ones (length > 0)
      // This preserves bulk imported child tracking numbers
      if (fedexData.childTrackingNumbers && fedexData.childTrackingNumbers.length > 0) {
        updates.childTrackingNumbers = fedexData.childTrackingNumbers;
      }

      await storage.updateShipment(shipment.id, updates);

      console.log(`✅ Updated shipment ${trackingNumber} with status: ${fedexData.status}`);

      // Get updated shipment
      const updatedShipment = await storage.getShipmentByTracking(trackingNumber);

      res.json({
        message: "Tracking information refreshed from FedEx",
        shipment: updatedShipment,
        fedexData,
        queueStatus: fedExService.getQueueStatus()
      });
    } catch (error) {
      console.error("❌ Error refreshing shipment:", error);
      // Return graceful error with existing data
      const shipment = await storage.getShipmentByTracking(req.params.trackingNumber);
      res.json({
        message: "Failed to refresh - using cached data",
        shipment: shipment,
        fedexData: shipment?.fedexRawData ? JSON.parse(shipment.fedexRawData) : null,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get FedEx API queue status
  app.get("/api/fedex/queue-status", (req, res) => {
    const status = fedExService.getQueueStatus();
    res.json({
      ...status,
      message: status.isProcessing
        ? `Processing ${status.queueLength} requests...`
        : status.queueLength > 0
        ? `${status.queueLength} requests queued`
        : "Queue empty"
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
