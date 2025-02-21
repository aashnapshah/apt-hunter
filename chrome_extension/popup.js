document.addEventListener("DOMContentLoaded", initializePopup);

function initializePopup() {
    setupEventListeners();
    extractAndDisplayData();
}

function setupEventListeners() {
    document.getElementById("copyClipboard").addEventListener("click", () => handleCopy());
    document.getElementById("saveToSheets").addEventListener("click", () => handleSave());
}

function extractAndDisplayData() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs.length) {
            showError("Unable to access current tab.");
            return;
        }

        const currentUrl = tabs[0].url;
        
        if (!currentUrl.includes("streeteasy.com")) {
            showError("Please navigate to a StreetEasy listing page.");
            return;
        }

        // Execute the content script
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: extractListingDetails
        })
        .then(results => {
            if (!results || !results[0] || !results[0].result) {
                showError("Unable to extract listing details.");
                return;
            }

            const result = results[0].result;
            if (result.error) {
                showError(result.error);
                return;
            }

            const today = new Date().toISOString().split("T")[0];
            const data = [{
                link: currentUrl,
                ...result,
                date: today
            }];
            
            displayResults(data);
            window.listingData = data; // Store data for event handlers
        })
        .catch(error => showError(`Error: ${error.message}`));
    });
}

function showError(message) {
    document.getElementById("listings-container").innerHTML = 
        `<p style='color: red;'>${message}</p>`;
}

function handleCopy() {
    if (window.listingData) {
        copyToClipboard(window.listingData);
    }
}

function handleSave() {
    if (window.listingData) {
        chrome.runtime.sendMessage(
            { action: "saveToGoogleSheets", data: window.listingData[0] },
            handleSaveResponse
        );
    }
}

function handleSaveResponse(response) {
    if (response.status === "success") {
        showSuccessMessage("saveMessage");
    } else {
        console.error("Error saving to Google Sheets:", response.message);
    }
}

function showSuccessMessage(elementId) {
    const message = document.getElementById(elementId);
    message.style.display = "block";
    setTimeout(() => message.style.display = "none", 2000);
}

function displayResults(data) {
    let container = document.getElementById("listings-container");
    container.innerHTML = ""; // Clear previous results

    data.forEach(row => {
        let listingDiv = document.createElement("div");
        listingDiv.classList.add("listing-container");

        let createField = (label, value, isTextArea = false) => {
            let field = document.createElement("div");
            field.classList.add("field");

            let labelEl = document.createElement("label");
            labelEl.textContent = label;

            let inputEl;
            if (isTextArea) {
                inputEl = document.createElement("textarea");
                inputEl.rows = 3;
                inputEl.style.width = "55%";
                inputEl.value = value;
                inputEl.addEventListener('change', (e) => {
                    window.listingData[0][label.toLowerCase().replace(':', '')] = e.target.value;
                });
            } else if (label === "Contacted:") {
                inputEl = document.createElement("select");
                inputEl.style.width = "55%";
                ["No", "Yes", "Waiting for Response"].forEach(option => {
                    let opt = document.createElement("option");
                    opt.value = option;
                    opt.text = option;
                    opt.selected = option === value;
                    inputEl.appendChild(opt);
                });
                inputEl.addEventListener('change', (e) => {
                    window.listingData[0].contacted = e.target.value;
                });
            } else {
                inputEl = document.createElement("input");
                inputEl.type = "text";
                inputEl.value = value;
            }

            field.appendChild(labelEl);
            field.appendChild(inputEl);
            return field;
        };

        // Create link field
        let linkField = document.createElement("div");
        linkField.classList.add("field");
        let linkLabel = document.createElement("label");
        linkLabel.textContent = "Link:";
        let linkEl = document.createElement("a");
        linkEl.href = row.link;
        linkEl.textContent = "View Listing";
        linkEl.target = "_blank";
        linkField.appendChild(linkLabel);
        linkField.appendChild(linkEl);

        // Add all fields in new order
        listingDiv.appendChild(createField("Date:", row.date));
        listingDiv.appendChild(linkField);
        listingDiv.appendChild(createField("Address:", row.address));
        listingDiv.appendChild(createField("Neighborhood:", row.neighborhood));
        listingDiv.appendChild(createField("SqFt:", row.sqft));
        listingDiv.appendChild(createField("Price:", row.price));
        listingDiv.appendChild(createField("Agent:", row.agent));
        listingDiv.appendChild(createField("Brokerage:", row.brokerage));
        listingDiv.appendChild(createField("Closest Subway:", row.subway));
        listingDiv.appendChild(createField("Walking Distance:", row.distance));
        listingDiv.appendChild(createField("Highlights:", row.highlights || "", true));
        listingDiv.appendChild(createField("Contacted:", row.contacted || "No"));

        container.appendChild(listingDiv);
    });
}

function copyToClipboard(data) {
    let headers = [
        "Date", "Link", "Address", "Neighborhood", "SqFt", "Price", 
        "Agent", "Brokerage", "Closest Subway", "Walking Distance", 
        "Highlights", "Contacted"
    ];
    
    let rowData = data.map(row => [
        row.date,
        row.link,
        row.address,
        row.neighborhood,
        row.sqft,
        row.price,
        row.agent,
        row.brokerage,
        row.subway,
        row.distance,
        row.highlights || "",
        row.contacted || "No"
    ].map(value => (value.includes(",") ? `"${value}"` : value)).join(","));

    let csvText = headers.join(",") + "\n" + rowData.join("\n");

    navigator.clipboard.writeText(csvText).then(() => {
        showSuccessMessage("copyMessage");
    }).catch(err => console.error("Failed to copy: ", err));
}

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
            // Match price format: $X,XXX or $X,XXX.XX or $XXX,XXX or $X,XXX,XXX
            const priceMatch = priceText.match(/\$[0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{2})?/);
            if (priceMatch) {
                price = priceMatch[0];
                break;
            }
        }
    }

    // Fallback: Look for price in any element's text content
    if (price === "No price listed") {
        document.querySelectorAll('*').forEach(element => {
            if (element.childNodes.length === 1 && element.childNodes[0].nodeType === 3) {
                const text = element.innerText.trim();
                const priceMatch = text.match(/\$[0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{2})?/);
                if (priceMatch && !price.includes("$")) {
                    price = priceMatch[0];
                }
            }
        });
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

    return { address, neighborhood, sqft, price, agent, brokerage, subway, distance };
}