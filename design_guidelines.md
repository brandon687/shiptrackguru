# FedEx Shipping Dashboard - Design Guidelines

## Design Approach
**Design System**: Material Design with influences from Linear and Notion
**Rationale**: Utility-focused dashboard requiring efficient data management, clear status visualization, and high information density. Material Design provides excellent patterns for data-heavy applications with strong visual feedback systems.

## Core Design Principles
1. **Data Clarity First**: Prioritize scannable, actionable information over decoration
2. **Status-Driven Design**: Use color and iconography to communicate shipment states instantly
3. **Efficient Workflows**: Minimize clicks for common tasks (validate tracking, refresh data, view details)
4. **Progressive Disclosure**: Show summary data upfront, detailed tracking on interaction

---

## Layout System

### Spacing Primitives
Use Tailwind units: **2, 4, 6, 8, 12, 16** for consistent rhythm
- Component padding: `p-4` to `p-6`
- Section spacing: `gap-6` to `gap-8`
- Page margins: `p-8` for desktop, `p-4` for mobile

### Dashboard Structure
```
┌─────────────────────────────────────────┐
│  Header (Stats Bar)                     │
├──────┬──────────────────────────────────┤
│ Side │  Main Content Area               │
│ Nav  │  (Tables/Cards/Charts)           │
│      │                                  │
└──────┴──────────────────────────────────┘
```

**Header**: Fixed top bar (h-16) with:
- App title/logo (left)
- Quick stats cards showing: Total Shipments, In Transit, Delivered Today, Exceptions
- Sync/Refresh button (right)
- User account menu (right)

**Sidebar Navigation** (w-64, collapsible to w-16):
- Dashboard (home)
- All Shipments
- Active Tracking
- Delivered
- Exceptions
- Analytics
- Settings
- Collapse toggle at bottom

**Main Content**: Full remaining width with max-w-7xl container, px-8 py-6

---

## Typography

### Font Families
- **Primary**: Inter (via Google Fonts) - body text, UI elements
- **Monospace**: JetBrains Mono - tracking numbers, dates

### Hierarchy
- **Page Titles**: text-2xl font-semibold (Inter)
- **Section Headers**: text-lg font-medium
- **Card Titles**: text-base font-medium
- **Body Text**: text-sm font-normal
- **Labels**: text-xs font-medium uppercase tracking-wide
- **Tracking Numbers**: text-sm font-mono
- **Data Values**: text-base font-semibold

---

## Component Library

### 1. Navigation Components
**Top Stats Bar**:
- 4 metric cards in grid (grid-cols-4 gap-4)
- Each card: rounded-lg border p-4
- Label (text-xs uppercase), Value (text-2xl font-bold), Trend indicator
- Icon (Heroicons) aligned left of value

**Sidebar Navigation**:
- Nav items with icon + label, py-3 px-4, rounded-md
- Active state: filled background, bold text
- Hover: subtle background change
- Collapsed state: center icons only, hide text

### 2. Data Display Components

**Shipment Table** (Primary View):
- Full-width table with sticky header
- Columns: Status Icon, Tracking #, Recipient, Origin → Destination, Ship Date, Est. Delivery, Last Update, Actions
- Row height: h-14
- Alternating row backgrounds for scannability
- Sortable column headers with sort indicators
- Row hover: subtle highlight
- Action column: View Details, Copy Tracking, Refresh buttons (icon buttons)

**Status Indicators**:
- Badge component with dot + text
- States: In Transit (blue), Out for Delivery (purple), Delivered (green), Exception (red), Pending (gray)
- Size: px-3 py-1, rounded-full
- Include status icon from Heroicons

**Shipment Card View** (Alternative layout):
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Card structure: p-6, rounded-lg, border
- Header: Tracking # (mono font) + Status badge
- Body: Recipient name, destination city, estimated delivery (large text-lg)
- Footer: Last updated timestamp + action buttons
- Progress indicator showing shipment journey stages

### 3. Data Entry & Validation

**Tracking Number Input**:
- Large input field with monospace font
- Auto-validate on blur using FedEx format patterns
- Inline validation feedback with icons (checkmark/error)
- Batch input option: textarea for multiple tracking numbers (one per line)
- "Validate All" button to check against FedEx API

**Sync Control Panel**:
- Google Sheets sync status indicator (last synced timestamp)
- Manual sync button with loading state
- Auto-refresh toggle and interval selector
- FedEx API quota usage indicator

### 4. Visualization Components

**Delivery Timeline Chart**:
- Horizontal bar chart showing shipments over next 7 days
- Daily groupings with shipment count
- Clickable bars to filter table view
- Height: h-64

**Status Distribution**:
- Donut chart or simple bar breakdown
- Show percentage and count for each status
- Size: square aspect ratio, max-w-sm

**Map View** (if included):
- Embedded map showing active shipment locations
- Clustered markers for multiple shipments
- Click marker to view shipment details in side panel

### 5. Detail Panel/Modal

**Shipment Detail View**:
- Slide-out panel (w-96) from right OR modal dialog
- Header: Large tracking number + status
- Timeline component showing tracking events (vertical stepper)
- Each event: timestamp, location, status description, icon
- Metadata section: Sender, recipient, service type, weight, dimensions
- Actions: Refresh tracking, copy link, export details

### 6. Utility Components

**Search & Filter Bar**:
- Search input (w-64) with search icon
- Filter dropdowns: Status, Date Range, Destination
- Clear filters button
- Active filter chips displayed below

**Loading States**:
- Table skeleton: animated pulse rows
- Card skeleton: shimmer effect
- Spinner for button actions
- Progress bar for batch operations

**Empty States**:
- Centered illustration + message
- For: No shipments, no search results, no exceptions
- Include primary CTA: "Import from Google Sheets" or "Add Tracking Number"

**Toast Notifications**:
- Fixed bottom-right position
- Types: Success (sync complete), Error (validation failed), Info (FedEx API update)
- Auto-dismiss after 5s with progress bar

---

## Interaction Patterns

**Table Interactions**:
- Click row to open detail panel
- Checkbox column for bulk actions
- Inline edit for certain fields (recipient name, notes)
- Drag column headers to reorder

**Real-time Updates**:
- Subtle pulse animation on data refresh
- Badge notification for new tracking updates
- Visual indicator when Google Sheets has new data

**Responsive Behavior**:
- Desktop (lg:): Full sidebar + table layout
- Tablet (md:): Collapsed sidebar (icons only) + table with fewer columns
- Mobile: Bottom tab navigation, card view instead of table, collapsible filters

---

## Accessibility

- ARIA labels on all icon-only buttons
- Keyboard navigation for table (arrow keys to navigate rows)
- Focus indicators on all interactive elements (ring-2 ring-offset-2)
- Status communicated via icons + text, not color alone
- Sufficient contrast ratios (WCAG AA minimum)
- Screen reader announcements for live data updates

---

## Performance Considerations

- Virtual scrolling for tables with 100+ rows
- Debounced search input
- Lazy load detail panels
- Cache FedEx API responses (5-minute refresh)
- Optimize Google Sheets polling interval

---

## No Images Required
This is a data dashboard - no hero images or marketing photography needed. Focus on iconography (Heroicons), status indicators, and data visualization charts.