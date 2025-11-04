import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const shipments = pgTable("shipments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trackingNumber: text("tracking_number").notNull(),
  status: text("status").notNull(),
  scheduledDelivery: text("scheduled_delivery"),
  shipperName: text("shipper_name"),
  shipperCompany: text("shipper_company"),
  recipientName: text("recipient_name"),
  recipientCompany: text("recipient_company"),
  masterTrackingNumber: text("master_tracking_number"),
  packageCount: integer("package_count").notNull(),
  packageType: text("package_type"),
  packageWeight: text("package_weight"),
  totalWeight: text("total_weight"),
  direction: text("direction"),
  serviceType: text("service_type"),
  lastUpdate: timestamp("last_update").notNull().defaultNow(),
  googleSheetRow: integer("google_sheet_row"),
  fedexRawData: text("fedex_raw_data"),
  childTrackingNumbers: text("child_tracking_numbers").array(),
  notScanned: integer("not_scanned").notNull().default(0), // 0 = scanned, 1 = not scanned
  manuallyCompleted: integer("manually_completed").notNull().default(0), // 0 = not complete, 1 = complete
}, (table) => ({
  trackingNumberIdx: uniqueIndex("tracking_number_idx").on(table.trackingNumber),
}));

export const insertShipmentSchema = createInsertSchema(shipments).omit({
  id: true,
  lastUpdate: true,
});

export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type Shipment = typeof shipments.$inferSelect;

export type ShipmentStatus = 
  | "Label created"
  | "On the way"
  | "Out for delivery"
  | "Delivered"
  | "Exception"
  | "Pending";

export const syncLogs = pgTable("sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  source: text("source").notNull(), // "google_sheets" or "fedex"
  trackingNumber: text("tracking_number"),
  success: integer("success").notNull(), // 1 for success, 0 for failure (using integer as boolean)
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  sheetData: text("sheet_data"), // JSON string of the raw sheet data
  responseData: text("response_data"), // JSON string of the API response
});

export const insertSyncLogSchema = createInsertSchema(syncLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertSyncLog = z.infer<typeof insertSyncLogSchema>;
export type SyncLog = typeof syncLogs.$inferSelect;

export const scannedSessions = pgTable("scanned_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  sessionName: text("session_name"),
  scannedNumbers: text("scanned_numbers").array().notNull(),
});

export const insertScannedSessionSchema = createInsertSchema(scannedSessions).omit({
  id: true,
  timestamp: true,
});

export type InsertScannedSession = z.infer<typeof insertScannedSessionSchema>;
export type ScannedSession = typeof scannedSessions.$inferSelect;

export const deliveredShipments = pgTable("delivered_shipments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trackingNumber: text("tracking_number").notNull(),
  status: text("status").notNull(),
  shipperCompany: text("shipper_company"),
  recipientCompany: text("recipient_company"),
  serviceType: text("service_type"),
  packageWeight: text("package_weight"),
  packageCount: integer("package_count").notNull(),
  expectedDelivery: text("expected_delivery"),
  actualDelivery: timestamp("actual_delivery").notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at").notNull().defaultNow(),
}, (table) => ({
  trackingNumberIdx: uniqueIndex("delivered_tracking_number_idx").on(table.trackingNumber),
}));

export const insertDeliveredShipmentSchema = createInsertSchema(deliveredShipments).omit({
  id: true,
  deliveredAt: true,
});

export type InsertDeliveredShipment = z.infer<typeof insertDeliveredShipmentSchema>;
export type DeliveredShipment = typeof deliveredShipments.$inferSelect;
