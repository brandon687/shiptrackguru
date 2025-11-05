# FedEx API Investigation

## Current Issue
- All requests are getting HTTP 429 (Rate Limit) errors
- Cannot see the actual API response structure to fix field mapping
- Rate limit appears to be imposed for extended period due to bulk refresh attempts

## Rate Limit Evidence
From logs:
```
Rate limit hit for tracking 885710260859 - will retry later
No tracking data returned from FedEx for: 885710260859
```

## FedEx API Response Structure (Expected)

Based on FedEx API documentation, the response structure should be:

```json
{
  "output": {
    "completeTrackResults": [
      {
        "trackingNumber": "885709790678",
        "trackResults": [
          {
            "latestStatusDetail": {
              "code": "DL",
              "description": "Delivered",
              "scanLocation": {
                "city": "IRVINE",
                "stateOrProvinceCode": "CA"
              }
            },
            "dateAndTimes": [
              {
                "type": "ESTIMATED_DELIVERY",
                "dateTime": "2025-11-04T00:00:00"
              },
              {
                "type": "ACTUAL_DELIVERY",
                "dateTime": "2025-11-04T09:55:00"
              }
            ],
            "scanEvents": [
              {
                "date": "2025-11-04T09:55:00",
                "eventDescription": "Delivered",
                "scanLocation": {
                  "city": "IRVINE",
                  "stateOrProvinceCode": "CA"
                }
              },
              {
                "date": "2025-11-04T07:34:00",
                "eventDescription": "At local FedEx facility",
                "scanLocation": {
                  "city": "IRVINE",
                  "stateOrProvinceCode": "CA"
                }
              },
              // ... more events
            ]
          }
        ]
      }
    ]
  }
}
```

## Current Code Mapping

The code in `server/services/fedex.ts` is already correctly mapping:
- `latestStatus?.scanEvents` - This should contain the array of tracking events
- `event.date` - Timestamp
- `event.eventDescription` - Event description
- `event.scanLocation?.city` - Location city
- `event.scanLocation?.stateOrProvinceCode` - Location state

## Hypothesis

The mapping code appears correct. The issue is:
1. Rate limiting prevents us from getting any data
2. Once rate limit clears, the code should work as-is
3. The UI already has the display code for events in `ShipmentDetailPanel.tsx`

## Recommendations

1. **Wait 30-60 minutes** for FedEx rate limit to fully reset
2. Try ONE single refresh request
3. If successful, we'll see the full API response in logs
4. If the mapping is incorrect, we can fix it based on the actual response

## Alternative: Manual Testing

If rate limits persist, we can:
1. Use FedEx's test/sandbox environment (if available)
2. Test with a single tracking number via their web interface
3. Manually construct a sample response based on documentation
