// Test script to verify bulk import parsing logic
const testData = `TRACKING NUMBER	STATUS	SCHEDULED DELIVERY DATE	SHIPPER NAME	SHIPPER COMPANY	RECIPIENT CONTACT NAME	RECIPIENT COMPANY	MASTER TRACKING NUMBER	NO. OF PACKAGES	PACKAGE TYPE	PKG WT (LBS)	TOTAL WT (LBS)	DIRECTION	SERVICE TYPE
886693202422	On the way	12/4/25	CTDI - TUVE	CTDI - TUVE	BRANDON IN	SCAL		1	Your Packaging	28	28	Inbound	FedEx Priority Overnight
886708234788	We have your package	12/4/25	CTDI - TUVE	CTDI - TUVE	BRANDON IN	SCAL	886708234788	5	Your Packaging	338	1690	Inbound	FedEx 1Day Freight
886708234799	We have your package	12/4/25	CTDI - TUVE	CTDI - TUVE	BRANDON IN	SCAL	886708234788	5	Your Packaging	338	338	Inbound	FedEx 1Day Freight
886708234803	We have your package	12/4/25	CTDI - TUVE	CTDI - TUVE	BRANDON IN	SCAL	886708234788	5	Your Packaging	338	338	Inbound	FedEx 1Day Freight
886708234814	We have your package	12/4/25	CTDI - TUVE	CTDI - TUVE	BRANDON IN	SCAL	886708234788	5	Your Packaging	338	338	Inbound	FedEx 1Day Freight`;

// Simulate the parsing logic from BulkImport.tsx
const parseLine = (line) => {
  if (line.includes('\t')) {
    return line.split('\t').map(part => part.trim());
  }
  return [];
};

const lines = testData.trim().split("\n");
const rawRows = [];

lines.forEach((line, index) => {
  if (!line.trim()) return;

  // Skip header row
  const upperLine = line.toUpperCase();
  if (index === 0 && (
    upperLine.includes("TRACKING NUMBER") ||
    upperLine.includes("TRACKING_NUMBER") ||
    upperLine.includes("MASTER TRACKING") ||
    upperLine.includes("NO. OF PACKAGES") ||
    upperLine.includes("SHIPPER NAME")
  )) {
    console.log(`⏭️  Skipping header row: ${line.substring(0, 50)}...`);
    return;
  }

  const parts = parseLine(line);
  const trackingNumber = parts[0]?.trim() || "";

  // Skip validation
  if (!trackingNumber) return;
  if (trackingNumber.toUpperCase().includes("TRACKING")) return;
  if (trackingNumber.toUpperCase().includes("NUMBER")) return;
  if (!/^\d+$/.test(trackingNumber)) return;

  const masterTrackingNumber = parts[7]?.trim() || undefined;

  console.log(`✅ Parsed row: tracking=${trackingNumber}, master=${masterTrackingNumber}`);

  rawRows.push({
    trackingNumber,
    status: parts[1]?.trim() || "Pending",
    masterTrackingNumber,
    packageCount: parseInt(parts[8]?.trim() || "1"),
  });
});

console.log(`\n📊 Total rows parsed: ${rawRows.length}`);

// Group by master tracking number
const groupedByMaster = new Map();
const standaloneShipments = [];

rawRows.forEach(row => {
  const master = row.masterTrackingNumber;

  if (master) {
    if (!groupedByMaster.has(master)) {
      groupedByMaster.set(master, []);
    }
    groupedByMaster.get(master).push(row);
  } else {
    standaloneShipments.push(row);
  }
});

console.log(`\n🔗 Grouped shipments: ${groupedByMaster.size}`);
console.log(`📦 Standalone shipments: ${standaloneShipments.length}`);

// Create final shipment records
const parsed = [];

groupedByMaster.forEach((rows, masterTrackingNumber) => {
  const masterRow = rows.find(r => r.trackingNumber === masterTrackingNumber) || rows[0];
  const childTrackingNumbers = rows.map(r => r.trackingNumber);

  console.log(`\n🎯 Master: ${masterTrackingNumber}`);
  console.log(`   Children (${childTrackingNumbers.length}):`, childTrackingNumbers);

  parsed.push({
    trackingNumber: masterTrackingNumber,
    status: masterRow.status,
    masterTrackingNumber: masterTrackingNumber,
    packageCount: masterRow.packageCount,
    childTrackingNumbers,
  });
});

standaloneShipments.forEach(row => {
  console.log(`\n📦 Standalone: ${row.trackingNumber}`);
  parsed.push({
    trackingNumber: row.trackingNumber,
    status: row.status,
    packageCount: row.packageCount,
  });
});

console.log(`\n\n📤 FINAL OUTPUT TO BE SENT TO API:`);
console.log(JSON.stringify(parsed, null, 2));
