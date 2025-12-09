import { type Shipment, type InsertShipment, shipments, type SyncLog, type InsertSyncLog, syncLogs, type ScannedSession, type InsertScannedSession, scannedSessions, type DeliveredShipment, type InsertDeliveredShipment, deliveredShipments } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Shipment operations
  getAllShipments(): Promise<Shipment[]>;
  getShipmentByTracking(trackingNumber: string): Promise<Shipment | undefined>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
  updateShipment(id: string, shipment: Partial<Shipment>): Promise<Shipment | undefined>;
  upsertShipment(shipment: InsertShipment): Promise<Shipment>;
  updateChildTrackingNumbers(trackingNumber: string, childTrackingNumbers: string[]): Promise<Shipment>;
  deleteShipment(trackingNumber: string): Promise<boolean>;
  deleteAllShipments(): Promise<void>;
  markShipmentsAsNotScanned(trackingNumbers: string[]): Promise<void>;
  markShipmentsAsScanned(trackingNumbers: string[]): Promise<void>;

  // Sync log operations
  getAllSyncLogs(limit?: number): Promise<SyncLog[]>;
  createSyncLog(log: InsertSyncLog): Promise<SyncLog>;
  getSyncLogsByTracking(trackingNumber: string): Promise<SyncLog[]>;

  // Scanned session operations
  getAllScannedSessions(): Promise<ScannedSession[]>;
  createScannedSession(session: InsertScannedSession): Promise<ScannedSession>;
  deleteScannedSession(id: string): Promise<boolean>;

  // Delivered shipments operations
  getAllDeliveredShipments(): Promise<DeliveredShipment[]>;
  createDeliveredShipment(shipment: InsertDeliveredShipment): Promise<DeliveredShipment>;
  getDeliveredShipmentByTracking(trackingNumber: string): Promise<DeliveredShipment | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getAllShipments(): Promise<Shipment[]> {
    return await db.select().from(shipments).orderBy(desc(shipments.lastUpdate));
  }

  async getShipmentByTracking(trackingNumber: string): Promise<Shipment | undefined> {
    const results = await db
      .select()
      .from(shipments)
      .where(eq(shipments.trackingNumber, trackingNumber))
      .limit(1);
    return results[0];
  }

  async getShipmentsByTrackingNumbers(trackingNumbers: string[]): Promise<Shipment[]> {
    if (trackingNumbers.length === 0) return [];

    const results = await db
      .select()
      .from(shipments)
      .where(sql`${shipments.trackingNumber} = ANY(${trackingNumbers})`);
    return results;
  }

  async createShipment(insertShipment: InsertShipment): Promise<Shipment> {
    const [shipment] = await db
      .insert(shipments)
      .values(insertShipment)
      .returning();
    return shipment;
  }

  async updateShipment(id: string, updates: Partial<Omit<Shipment, 'id' | 'lastUpdate'>>): Promise<Shipment | undefined> {
    const [updated] = await db
      .update(shipments)
      .set({ ...updates, lastUpdate: new Date() })
      .where(eq(shipments.id, id))
      .returning();
    return updated;
  }

  async upsertShipment(insertShipment: InsertShipment): Promise<Shipment> {
    const existing = await this.getShipmentByTracking(insertShipment.trackingNumber);
    
    if (existing) {
      // Only update fields that are provided (not null)
      const updates: Partial<Omit<Shipment, 'id' | 'lastUpdate'>> = {};
      Object.keys(insertShipment).forEach((key) => {
        const value = (insertShipment as any)[key];
        if (value !== null && value !== undefined) {
          (updates as any)[key] = value;
        }
      });
      const updated = await this.updateShipment(existing.id, updates);
      return updated!;
    }
    
    return this.createShipment(insertShipment);
  }

  async updateChildTrackingNumbers(trackingNumber: string, childTrackingNumbers: string[]): Promise<Shipment> {
    const shipment = await this.getShipmentByTracking(trackingNumber);
    if (!shipment) {
      throw new Error(`Shipment with tracking number ${trackingNumber} not found`);
    }

    // CRITICAL FIX: Merge new child tracking numbers with existing ones (don't replace)
    // This prevents losing previously imported child tracking numbers when adding new ones
    const existingChildren = shipment.childTrackingNumbers || [];
    const mergedChildren = [...new Set([...existingChildren, ...childTrackingNumbers])];

    const [updated] = await db
      .update(shipments)
      .set({
        childTrackingNumbers: mergedChildren,
        lastUpdate: new Date()
      })
      .where(eq(shipments.trackingNumber, trackingNumber))
      .returning();

    return updated;
  }

  async deleteShipment(trackingNumber: string): Promise<boolean> {
    const shipment = await this.getShipmentByTracking(trackingNumber);
    if (!shipment) return false;
    
    await db.delete(shipments).where(eq(shipments.id, shipment.id));
    return true;
  }

  async deleteAllShipments(): Promise<void> {
    await db.delete(shipments);
  }

  async markShipmentsAsNotScanned(trackingNumbers: string[]): Promise<void> {
    for (const trackingNumber of trackingNumbers) {
      await db.update(shipments)
        .set({ notScanned: 1 })
        .where(eq(shipments.trackingNumber, trackingNumber));
    }
  }

  async markShipmentsAsScanned(trackingNumbers: string[]): Promise<void> {
    for (const trackingNumber of trackingNumbers) {
      await db.update(shipments)
        .set({ notScanned: 0 })
        .where(eq(shipments.trackingNumber, trackingNumber));
    }
  }

  async markShipmentsAsCompleted(trackingNumbers: string[]): Promise<void> {
    for (const trackingNumber of trackingNumbers) {
      await db.update(shipments)
        .set({ manuallyCompleted: 1, notScanned: 0 })
        .where(eq(shipments.trackingNumber, trackingNumber));
    }
  }

  async getAllSyncLogs(limit: number = 100): Promise<SyncLog[]> {
    return await db.select().from(syncLogs).orderBy(desc(syncLogs.timestamp)).limit(limit);
  }

  async createSyncLog(insertLog: InsertSyncLog): Promise<SyncLog> {
    const [log] = await db
      .insert(syncLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async getSyncLogsByTracking(trackingNumber: string): Promise<SyncLog[]> {
    return await db
      .select()
      .from(syncLogs)
      .where(eq(syncLogs.trackingNumber, trackingNumber))
      .orderBy(desc(syncLogs.timestamp));
  }

  async getAllScannedSessions(): Promise<ScannedSession[]> {
    return await db.select().from(scannedSessions).orderBy(desc(scannedSessions.timestamp));
  }

  async createScannedSession(insertSession: InsertScannedSession): Promise<ScannedSession> {
    const [session] = await db
      .insert(scannedSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async deleteScannedSession(id: string): Promise<boolean> {
    const result = await db.delete(scannedSessions).where(eq(scannedSessions.id, id));
    return true;
  }

  async getAllDeliveredShipments(): Promise<DeliveredShipment[]> {
    return await db.select().from(deliveredShipments).orderBy(desc(deliveredShipments.deliveredAt));
  }

  async createDeliveredShipment(insertShipment: InsertDeliveredShipment): Promise<DeliveredShipment> {
    const [shipment] = await db
      .insert(deliveredShipments)
      .values(insertShipment)
      .returning();
    return shipment;
  }

  async getDeliveredShipmentByTracking(trackingNumber: string): Promise<DeliveredShipment | undefined> {
    const result = await db
      .select()
      .from(deliveredShipments)
      .where(eq(deliveredShipments.trackingNumber, trackingNumber))
      .limit(1);
    return result[0];
  }
}

export const storage = new DatabaseStorage();
