// priority.js - handles login handshake and fetches alerts to avoid token expiry issues

const userProfile = {
    email: "pandalapraneeth.23.cse@anits.edu.in",
    name: "Pandala Praneeth",
    rollNo: "A23126510169",
    accessCode: "MTqxar",
    clientID: "3de3df34-edf9-4cd9-8c72-011e8f0f3118",
    clientSecret: "nNbhSEqAQvYNsbdT"
};

const rankingRules = {
    'Placement': 3,
    'Result': 2,
    'Event': 1
};

async function fetchAndSortAlerts() {
    try {
        console.log("Sending login request to auth endpoint...");
        const loginResponse = await fetch('http://4.224.186.213/evaluation-service/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userProfile)
        });

        if (!loginResponse.ok) {
            throw new Error(`Login failed with status code: ${loginResponse.status}`);
        }

        const authJSON = await loginResponse.json();
        const activeToken = authJSON.access_token;
        console.log("Auth token acquired successfully.");

        console.log("Requesting raw notification feed...");
        const apiResponse = await fetch('http://4.224.186.213/evaluation-service/notifications', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${activeToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!apiResponse.ok) {
            throw new Error(`Data fetch failed with status code: ${apiResponse.status}`);
        }

        const responseData = await apiResponse.json();
        const alertsList = responseData.notifications || [];

        // Sort records by weight logic first, then by date as a fallback tie-breaker
        const processedList = alertsList.sort((itemX, itemY) => {
            const weightX = rankingRules[itemX.Type] || 0;
            const weightY = rankingRules[itemY.Type] || 0;

            if (weightY !== weightX) {
                return weightY - weightX;
            }

            // FIXED: Corrected reference here from weightY to itemY
            return new Date(itemY.Timestamp.replace(' ', 'T')) - new Date(itemX.Timestamp.replace(' ', 'T'));
        });

        // isolate the top 10 positions
        const topTenAlerts = processedList.slice(0, 10);

        console.log("\n=== STAGE 6: TOP 10 PRIORITY ALERTS DATA ===");
        console.table(topTenAlerts.map(row => ({
            ID: row.ID.substring(0, 8) + "...",
            Type: row.Type,
            Message: row.Message,
            Timestamp: row.Timestamp
        })));
        
        console.log("\nRaw Result Payload Array:\n", JSON.stringify(topTenAlerts, null, 2));

    } catch (err) {
        console.error("Process interrupted:", err.message);
    }
}

fetchAndSortAlerts();