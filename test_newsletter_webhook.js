// Test script to verify newsletter webhook is working
const testData = {
  title: "Test Newsletter Article from n8n",
  link: "https://example.com/test-article",
  source: "Test Newsletter",
  published_at: new Date().toISOString(),
  matched_keyword: "test",
  summary: "This is a test article to verify the webhook is working"
};

async function testWebhook() {
  console.log("Testing newsletter webhook...\n");
  console.log("Sending data:", JSON.stringify(testData, null, 2));

  try {
    const response = await fetch('https://tara-dashboard.vercel.app/api/newsletter_webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();

    console.log("\n✅ Response Status:", response.status);
    console.log("Response Body:", JSON.stringify(result, null, 2));

    if (response.ok && result.ok) {
      console.log("\n✅ SUCCESS! Newsletter webhook is working correctly.");
      console.log("The article should appear in the dashboard under 'Newsletters'");
    } else {
      console.log("\n❌ FAILED! Webhook returned an error.");
    }
  } catch (error) {
    console.error("\n❌ ERROR calling webhook:", error.message);
  }
}

testWebhook();
