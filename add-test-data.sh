#!/bin/bash

echo "Adding test shipments to database..."

# Add multiple test shipments
curl -X POST http://localhost:5001/api/shipments \
  -H "Content-Type: application/json" \
  -d '{"trackingNumber":"TEST001","status":"pending","statusDescription":"Label Created","packageCount":1,"recipientName":"Alice Smith"}'

curl -X POST http://localhost:5001/api/shipments \
  -H "Content-Type: application/json" \
  -d '{"trackingNumber":"TEST002","status":"in_transit","statusDescription":"In Transit","packageCount":2,"recipientName":"Bob Johnson"}'

curl -X POST http://localhost:5001/api/shipments \
  -H "Content-Type: application/json" \
  -d '{"trackingNumber":"TEST003","status":"out_for_delivery","statusDescription":"Out for Delivery","packageCount":1,"recipientName":"Charlie Brown"}'

echo ""
echo "✅ Added 3 test shipments!"
echo "🌐 View them at: http://localhost:5001"