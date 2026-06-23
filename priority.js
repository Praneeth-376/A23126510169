// priority.js - Fully Automated with Self-Authentication to prevent 401 errors

const credentials = {
    email: "pandalapraneeth.23.cse@anits.edu.in",
    name: "pandala praneeth",
    rollNo: "a23126510169",
    accessCode: "MTqxar",
    clientID: "3de3df34-edf9-4cd9-8c72-011e8f0f3118",
    clientSecret: "nNbhSEqAQvYNsbdT"
};

const TYPE_WEIGHTS = {
    'Placement': 3,
    'Result': 2,
    'Event': 1
};

async function generatePriorityInbox() {
    try {
        console.log("🔒 Requesting a fresh Authorization Token from server...");
        const authResponse = await fetch('http://4.224.186.213/evaluation-service/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });

        if (!authResponse.ok) {
            throw new Error(`Authentication handshake failed with status: ${authResponse.status}`);
        }

        const authData = await authResponse.json();
        const token = authData.access_token;
        console.log("✅ Token successfully retrieved and authenticated.");

        console.log("🌐 Fetching live records from evaluation server...");
        const response = await fetch('http://4.224.186.213/evaluation-service/notifications', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP network failure status code: ${response.status}`);
        }

        const data = await response.json();
        const rawNotifications = data.notifications || [];

        // Apply strict sorting rules (Placement > Result > Event)
        const sortedNotifications = rawNotifications.sort((a, b) => {
            const weightA = TYPE_WEIGHTS[a.Type] || 0;
            const weightB = TYPE_WEIGHTS[b.Type] || 0;

            // Rule 1: Sort by Category Weight (Higher weight first)
            if (weightB !== weightA) {
                return weightB - weightA;
            }

            // Rule 2: If weights match, sort by Recency (Latest timestamp first)
            return new Date(b.Timestamp.replace(' ', 'T')) - new Date(a.Timestamp.replace(' ', 'T'));
        });

        // Isolate the top 10 rows
        const top10PriorityInbox = sortedNotifications.slice(0, 10);

        console.log("\n=== 🚨 STAGE 6: LIVE TOP 10 PRIORITY INBOX OUTPUT ===");
        console.table(top10PriorityInbox.map(item => ({
            ID: item.ID.substring(0, 8) + "...",
            Type: item.Type,
            Message: item.Message,
            Timestamp: item.Timestamp
        })));
        
        console.log("\nFull Raw JSON Deliverable Array Object:\n", JSON.stringify(top10PriorityInbox, null, 2));

    } catch (error) {
        console.error("❌ Execution breakdown:", error.message);
    }
}

generatePriorityInbox();