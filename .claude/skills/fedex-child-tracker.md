# FedEx Child Tracking Number Discovery

This skill helps discover child tracking numbers for FedEx multi-package shipments (MPS) when the FedEx API doesn't expose them.

## When to Use This Skill

Use this skill when:
- A master tracking number shows `hasAssociatedShipments: true` but no child tracking numbers
- Package count > 1 but child tracking numbers are empty
- You need to manually find individual package tracking numbers for freight shipments

## Discovery Strategies

### Strategy 1: FedEx API (Automatic - COMPLIANT)
- Query FedEx Track API with STANDARD_MPS package identifier
- Check associatedshipments endpoint
- Extract from API response fields
- This uses official FedEx APIs and is fully compliant with their Terms of Service

### Strategy 2: Pattern Analysis (COMPLIANT)
- Analyze the master tracking number structure
- Look for sequential patterns (e.g., if master is 886708234788, children might be 886708234789, 886708234790, etc.)
- Validate discovered patterns against FedEx API
- This only uses official FedEx APIs for validation

### Strategy 3: Manual Input with Validation (COMPLIANT)
- User manually retrieves child tracking numbers from FedEx.com (logged in as authorized user)
- User provides the tracking numbers to the system
- System validates each tracking number against FedEx API
- Store validated tracking numbers
- This complies with FedEx Terms as the user is manually accessing their own shipment data

### ⚠️ PROHIBITED STRATEGY - DO NOT USE:
**Web Scraping/Automated FedEx.com Access**: FedEx Terms of Service explicitly prohibit "screen-scraping, auto-inquiring, or using crawlers or other automated tools to extract data." This includes automated fetching of tracking pages. Violating this can result in API access termination.

## Task Instructions

When this skill is invoked with a master tracking number:

1. **Fetch current data**:
   ```bash
   curl -s "https://shiptrackguru-production.up.railway.app/api/fedex/child-tracking/{masterTrackingNumber}"
   ```

2. **If API returns empty child tracking numbers, try pattern analysis (COMPLIANT)**:
   - Extract the numeric part of master tracking number
   - Try sequential numbers (±1 to ±10 from master)
   - For each potential child tracking number:
     ```bash
     curl -s "https://shiptrackguru-production.up.railway.app/api/fedex/child-tracking/{childTrackingNumber}"
     ```
   - Verify it's a valid FedEx tracking number
   - Confirm it's related to the same shipment (same origin, destination, dates)
   - Stop when you find valid related tracking numbers

3. **Report findings**:
   ```
   Master Tracking Number: {master}
   Package Count: {count}
   Child Tracking Numbers Found: {children.length}

   Children:
   - {child1}
   - {child2}
   - ...

   Discovery Method: [API | Web Scraping | Pattern Analysis | Manual]
   ```

4. **Update database if child tracking numbers found**:
   ```bash
   curl -X PATCH "https://shiptrackguru-production.up.railway.app/api/shipments/{masterTrackingNumber}/child-tracking-numbers" \
     -H "Content-Type: application/json" \
     -d '{"childTrackingNumbers": ["child1", "child2", ...]}'
   ```

## Example Usage

User: "Find child tracking numbers for 886708234788"

Agent:
1. Checks API endpoint - finds package count 5, but no children
2. Tries pattern analysis with sequential numbers (886708234789, 886708234790, etc.)
3. Validates any found tracking numbers against FedEx API
4. Reports all valid child tracking numbers found
5. Updates database with discovered children

Note: Pattern analysis only works if FedEx uses sequential numbering for that shipment type.

## Manual Fallback

If automated discovery fails, ask the user:

```
I couldn't automatically discover the child tracking numbers for {master}.

FedEx Terms of Service prohibit automated scraping, so I need your help:

Please manually visit: https://www.fedex.com/fedextrack/?trknbr={master}
(As an authorized user accessing your own shipment data, this is compliant)

Look for:
- Individual package tracking numbers listed on the page
- "View Details" or "Package Details" sections
- Any PRO numbers or BOL numbers for freight shipments
- Check shipping documentation or delivery receipts

Once you have the tracking numbers, provide them and I'll validate and store them using the official FedEx API.
```

## Notes

- FedEx Freight shipments may use PRO numbers instead of standard tracking numbers
- Some multi-package shipments only expose children while in transit, not after delivery
- Sequential tracking numbers are common for FedEx Express MPS but rare for Freight
- Always validate tracking numbers before storing to prevent errors
