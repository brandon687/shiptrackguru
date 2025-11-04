import axios from "axios";

// Test FedEx API directly
async function testFedExAPI() {
  const apiKey = process.env.FEDEX_API_KEY;
  const apiSecret = process.env.FEDEX_SECRET_KEY || process.env.FEDEX_API_SECRET;
  const baseUrl = "https://apis.fedex.com";

  // Test tracking number from the screenshot
  const testTrackingNumber = "885710260859";

  console.log("=== FedEx API Test ===");
  console.log(`API Key: ${apiKey ? "✓ Set" : "✗ Not set"}`);
  console.log(`API Secret: ${apiSecret ? "✓ Set" : "✗ Not set"}`);
  console.log(`Test Tracking Number: ${testTrackingNumber}`);
  console.log("");

  if (!apiKey || !apiSecret) {
    console.error("❌ FedEx credentials not configured");
    process.exit(1);
  }

  try {
    // Step 1: Get OAuth token
    console.log("Step 1: Getting OAuth token...");
    const tokenResponse = await axios.post(
      `${baseUrl}/oauth/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: apiKey,
        client_secret: apiSecret,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    console.log("✓ OAuth token obtained successfully");
    console.log(`Token expires in: ${tokenResponse.data.expires_in} seconds`);
    console.log("");

    // Step 2: Get tracking information
    console.log("Step 2: Fetching tracking information...");
    const trackingResponse = await axios.post(
      `${baseUrl}/track/v1/trackingnumbers`,
      {
        trackingInfo: [
          {
            trackingNumberInfo: {
              trackingNumber: testTrackingNumber,
            },
          },
        ],
        includeDetailedScans: true,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✓ Tracking data retrieved successfully");
    console.log("");
    console.log("=== RAW API RESPONSE ===");
    console.log(JSON.stringify(trackingResponse.data, null, 2));
    console.log("");

    // Parse the response
    const trackingResult = trackingResponse.data.output?.completeTrackResults?.[0];
    if (!trackingResult) {
      console.error("❌ No tracking results in response");
      process.exit(1);
    }

    const latestStatus = trackingResult.trackResults?.[0];

    console.log("=== PARSED DATA ===");
    console.log(`Status Code: ${latestStatus?.latestStatusDetail?.code}`);
    console.log(`Status Description: ${latestStatus?.latestStatusDetail?.description}`);
    console.log(`Location: ${latestStatus?.latestStatusDetail?.scanLocation?.city}, ${latestStatus?.latestStatusDetail?.scanLocation?.stateOrProvinceCode}`);
    console.log(`Estimated Delivery: ${latestStatus?.dateAndTimes?.find((d: any) => d.type === "ESTIMATED_DELIVERY")?.dateTime}`);
    console.log(`Actual Delivery: ${latestStatus?.dateAndTimes?.find((d: any) => d.type === "ACTUAL_DELIVERY")?.dateTime}`);
    console.log(`Number of Scan Events: ${latestStatus?.scanEvents?.length || 0}`);
    console.log("");

    if (latestStatus?.scanEvents && latestStatus.scanEvents.length > 0) {
      console.log("=== SCAN EVENTS ===");
      latestStatus.scanEvents.forEach((event: any, index: number) => {
        console.log(`Event ${index + 1}:`);
        console.log(`  Date: ${event.date}`);
        console.log(`  Description: ${event.eventDescription}`);
        console.log(`  Location: ${event.scanLocation?.city || "N/A"}, ${event.scanLocation?.stateOrProvinceCode || "N/A"}`);
        console.log("");
      });
    }

    console.log("✅ Test completed successfully!");

  } catch (error: any) {
    console.error("❌ Error during API test:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Status Text: ${error.response.statusText}`);
      console.error(`Response Data:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

testFedExAPI();
