# FedEx Shipping Dashboard

A comprehensive dashboard for tracking and managing FedEx shipments with Google Sheets integration and real-time FedEx API updates.

### Overview
This application provides a visual dashboard to track and manage FedEx shipments, emphasizing easy package count verification. It integrates with Google Sheets for data import and the FedEx API for real-time tracking updates. The primary goal is to offer a robust, real-time solution for logistics management, enhancing operational efficiency and providing clear visibility into the shipping process for businesses.

### User Preferences
No specific user preferences were provided in the original `replit.md` file. The agent should infer best practices for coding and interaction.

### System Architecture

**UI/UX Decisions:**
- **Frontend Framework:** React, TypeScript
- **Styling:** Tailwind CSS, Shadcn UI for consistent components
- **State Management/Data Fetching:** TanStack Query
- **Theming:** Full dark mode support
- **Visual Indicators:** Color-coded badges for shipment statuses, clickable status cards for detailed views.
- **Interactive Elements:** Searchable/sortable tables, detail panels, real-time stats cards.

**Technical Implementations:**
- **Auto-Sync:** Google Sheets integration syncs every 5 minutes from the "Output" sheet.
- **Live Tracking:** FedEx API provides automatic status updates every 5 minutes.
- **Reset All Data:** Red "Reset All Data" button next to "Sync Now" allows clearing all shipment data from database to start fresh with new day's data. Includes confirmation dialog to prevent accidental deletion.
- **Error Logging:** All sync operations are logged to PostgreSQL with debugging data, viewable via a dedicated UI.
- **Tracking Number Comparison Tool:**
    - Auto-saves input to browser storage.
    - Smart barcode recognition extracts 12-digit FedEx tracking numbers from longer barcodes.
    - Highlights missing/found numbers, provides copy functionality.
    - Supports saving and loading scanned sessions.
- **Manual Child Tracking Number Entry:** Allows manual entry of individual package tracking numbers for multi-package shipments.
- **Data Source Prioritization:** ALL INBOUND sheet > Output sheet > FedEx for enriching shipment data.

**Feature Specifications:**
- **Dashboard:** Real-time stats, searchable/sortable table, dynamic status filtering, clickable tracking numbers.
- **Error Log UI:** Displays sync operation successes/failures with detailed input and response data.
- **FedEx Data Investigation:** Stores and displays complete FedEx API responses for each shipment.
- **Shipment Import:** Supports TSV/CSV with automatic grouping by master tracking number.

**System Design Choices:**
- **Tech Stack:**
    - **Frontend:** React, TypeScript, Tailwind CSS, Shadcn UI, TanStack Query
    - **Backend:** Express.js, Node.js
    - **Database:** PostgreSQL with Drizzle ORM
- **API Integration:** Google Sheets API, FedEx API
- **Data Persistence:** PostgreSQL for all application data, including shipments, sync logs, and scanned sessions.
- **FedEx as Source of Truth:** FedEx API is the primary source for shipment status and details.
- **Error Handling:** Comprehensive logging for sync operations, user-friendly toast notifications.

**Project Structure:**
```
client/
  src/
    components/
    pages/
    lib/
server/
  services/
  routes.ts
  storage.ts
  db.ts
shared/
  schema.ts
```

### External Dependencies

- **Google Sheets API:** Used for automatic syncing of shipment data from specified Google Sheets (specifically the "Output" sheet). Requires Google Cloud Project setup, enabled Google Sheets API, a Service Account with JSON credentials, and sharing the Google Sheet with the service account.
- **FedEx API:** Integrated for real-time tracking updates, shipment status, and detailed tracking information. Requires a FedEx Developer account and API credentials (Key and Secret).
- **PostgreSQL:** Primary database for storing all application data, including shipment details, sync logs, and scanned sessions.
- **Drizzle ORM:** Used for interacting with the PostgreSQL database.