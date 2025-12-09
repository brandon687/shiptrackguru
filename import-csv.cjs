const fs = require('fs');
const csv = require('csv-parser');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuration
const API_URL = process.argv[2] === '--local'
  ? 'http://localhost:5001/api/shipments/bulk-import'
  : 'https://shiptrackguru-production.up.railway.app/api/shipments/bulk-import';

const CSV_FILE = process.argv[3] || process.argv[2] || 'shipments.csv';

if (!CSV_FILE || CSV_FILE === '--local') {
  console.error('Usage: node import-csv.js [--local] <csv-file>');
  console.error('Example: node import-csv.js shipments.csv');
  console.error('Example: node import-csv.js --local shipments.csv');
  process.exit(1);
}

console.log(`📁 Reading CSV file: ${CSV_FILE}`);
console.log(`🌐 Target API: ${API_URL}`);

const shipments = [];

// Helper function to parse dates
function parseDate(dateStr) {
  if (!dateStr || dateStr === 'Will be updated soon' || dateStr === '') {
    return null;
  }

  // Handle various date formats
  // Format: 12/9/25 or 12/09/2025
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    let [month, day, year] = parts;

    // Handle 2-digit year
    if (year.length === 2) {
      year = '20' + year;
    }

    // Ensure 2-digit month and day
    month = month.padStart(2, '0');
    day = day.padStart(2, '0');

    return `${year}-${month}-${day}T12:00:00Z`;
  }

  return null;
}

// Helper function to parse number
function parseNumber(str) {
  if (!str || str === '') return null;
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// Helper function to parse integer
function parseInteger(str) {
  if (!str || str === '') return 1;
  const num = parseInt(str);
  return isNaN(num) ? 1 : num;
}

// Read and parse CSV
fs.createReadStream(CSV_FILE)
  .pipe(csv())
  .on('data', (row) => {
    // Map CSV columns to database fields
    const shipment = {
      trackingNumber: row['TRACKING NUMBER']?.trim(),
      status: mapStatus(row['STATUS']?.trim()),
      statusDescription: row['STATUS']?.trim(),
      scheduledDelivery: parseDate(row['SCHEDULED DELIVERY DATE']?.trim()),
      shipperName: row['SHIPPER NAME']?.trim() || null,
      shipperCompany: row['SHIPPER COMPANY']?.trim() || null,
      recipientName: row['RECIPIENT CONTACT NAME']?.trim() || null,
      recipientCompany: row['RECIPIENT COMPANY']?.trim() || null,
      masterTrackingNumber: row['MASTER TRACKING NUMBER']?.trim() || row['TRACKING NUMBER']?.trim(),
      packageCount: parseInteger(row['NO. OF PACKAGES']),
      packageType: row['PACKAGE TYPE']?.trim() || null,
      packageWeight: row['PKG WT (LBS)']?.trim() || null,
      totalWeight: row['TOTAL WT (LBS)']?.trim() || null,
      direction: row['DIRECTION']?.trim() || null,
      serviceType: row['SERVICE TYPE']?.trim() || null,
    };

    // Only add if we have a tracking number
    if (shipment.trackingNumber) {
      shipments.push(shipment);
    }
  })
  .on('end', async () => {
    console.log(`✅ Parsed ${shipments.length} shipments from CSV`);

    if (shipments.length === 0) {
      console.error('❌ No valid shipments found in CSV');
      process.exit(1);
    }

    // Show sample of data to be imported
    console.log('\n📦 Sample of shipments to import:');
    shipments.slice(0, 3).forEach(s => {
      console.log(`  - ${s.trackingNumber}: ${s.statusDescription} (${s.packageCount} packages)`);
    });

    // Send to API
    console.log(`\n📤 Sending to API...`);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shipments }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✅ Successfully imported ${result.imported} shipments!`);
        if (result.errors && result.errors.length > 0) {
          console.log(`⚠️  ${result.errors.length} shipments had errors:`);
          result.errors.slice(0, 5).forEach(e => {
            console.log(`    - ${e.trackingNumber}: ${e.error}`);
          });
        }
      } else {
        console.error('❌ Import failed:', result.error || result);
      }
    } catch (error) {
      console.error('❌ Failed to connect to API:', error.message);
      console.error('   Make sure the server is running');
    }
  })
  .on('error', (error) => {
    console.error('❌ Error reading CSV:', error.message);
    process.exit(1);
  });

// Map status descriptions to standard statuses
function mapStatus(statusDesc) {
  if (!statusDesc) return 'pending';

  const desc = statusDesc.toLowerCase();

  if (desc.includes('delivered')) return 'delivered';
  if (desc.includes('on the way') || desc.includes('in transit')) return 'in_transit';
  if (desc.includes('out for delivery')) return 'out_for_delivery';
  if (desc.includes('picked up') || desc.includes('shipment picked up')) return 'in_transit';
  if (desc.includes('label created') || desc.includes('shipment information sent')) return 'pending';
  if (desc.includes('exception') || desc.includes('delay')) return 'exception';
  if (desc.includes('cancelled')) return 'cancelled';

  return 'pending';
}