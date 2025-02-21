chrome.runtime.onInstalled.addListener(() => {
    console.log("StreetEasy Importer installed!");
});

class SheetsSaver {
    static URL = "https://script.google.com/macros/s/AKfycbyPx05k5DH3JgVCqbE26NwEh7H-kUMOc54O5L-VbNZkvMmamdYnQxDn-FJ3Uq-dbvhjMA/exec"
    static async save(data) {
        try {
            const response = await fetch(this.URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            return await response.text();
        } catch (error) {
            console.error("Save failed:", error);
            throw error;
        }
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveToGoogleSheets") {
        SheetsSaver.save(request.data)
            .then(result => {
                console.log("✅ Data saved to Google Sheets:", result);
                sendResponse({ status: "success", message: result });
            })
            .catch(error => {
                console.error("❌ Error sending data:", error);
                sendResponse({ status: "error", message: error.toString() });
            });
        return true;
    }
});
