// All DOM manipulation and data extraction
function extractListingDetails() {
    let address = document.querySelector("h1")?.innerText.trim() || "Enter address";

    // Ensure the page contains listing details before extracting
    if (!address || address === "Enter address") {
        return { error: "Not a listing page" };
    }

    let breadcrumbs = document.querySelectorAll(".breadcrumbs a, nav a");
    let neighborhood = breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2].innerText.trim() : "Enter neighborhood";

    // Extract square footage (ft²) properly
    let sqft = "No info";
    document.querySelectorAll("span").forEach(span => {
        if (span.innerText.includes("ft²")) {
            sqft = span.innerText.trim();
        }
    });

    // Improved price extraction with multiple fallbacks
    let price = "No price listed";
    const priceSelectors = [
        "[data-qa='price']",
        ".price",
        ".detail__info--price",
        "[data-qa='listing-price']",
        ".listings-price",
        ".price-section"
    ];

    for (let selector of priceSelectors) {
        const priceElement = document.querySelector(selector);
        if (priceElement) {
            const priceText = priceElement.innerText.trim();
            const priceMatch = priceText.match(/\$[0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{2})?/);
            if (priceMatch) {
                price = priceMatch[0];
                break;
            }
        }
    }

    let agent = document.querySelector(".seller-info a")?.innerText.trim() || 
                document.querySelector(".agent-name")?.innerText.trim() || 
                "No agent listed";

    let brokerage = document.querySelector(".seller-info")?.innerText.split("\n")[1]?.trim() ||
                    document.querySelector(".brokerage-name")?.innerText.trim() ||
                    "No brokerage listed";

    let subwayElement = document.querySelector(".transit-container li, .transit-station, .transit-info div");
    let subway = subwayElement?.innerText.match(/([A-Z0-9]+)\s+at\s+([\w\s]+)\b/)?.[0] || "No transit info";
    let distance = subwayElement?.innerText.match(/(under \d+ feet|\d+\.\d+ miles)/)?.[0] || "No distance info";

    // Add default values for new fields
    let highlights = "";
    let contacted = "No";

    return { 
        address, 
        neighborhood, 
        sqft, 
        price, 
        agent, 
        brokerage, 
        subway, 
        distance,
        highlights,  // New field
        contacted    // New field
    };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractData") {
        const data = extractListingDetails();
        sendResponse({ data });
    }
});


