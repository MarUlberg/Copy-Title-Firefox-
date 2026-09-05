const browserAPI = typeof browser !== "undefined" ? browser : chrome;


// ============================================================
// EXTENSION ICON
// ============================================================

browserAPI.browserAction.onClicked.addListener((tab, clickData) => {
    console.log("🟢 Extension clicked!", clickData);

    let action = "copyTitle"; // Default action

    if (clickData.modifiers.includes("Shift") && clickData.modifiers.includes("Alt")) {
        action = "copyMarkdown"; // Shift + Alt → Copy as Markdown

    } else if (clickData.modifiers.includes("Shift") && clickData.modifiers.includes("Ctrl")) {
        action = "copyRawTitle"; // Ctrl + Shift → ALWAYS raw title

    } else if (clickData.modifiers.includes("Shift")) {
        if (tab.url.includes("https://soliditet.no/")) {
            action = "copySoliditetFull"; // Shift → Full Company Info
        } else {
            action = "copyTitleWithUrl"; // Default Shift → Copy Title + URL
        }

    } else if (clickData.modifiers.includes("Ctrl")) {
        action = "copyUrl"; // Ctrl → ALWAYS URL
    }

    browserAPI.tabs.sendMessage(tab.id, { action: action });
});


// ============================================================
// OPTIONS
// ============================================================

browserAPI.contextMenus.create({
    id: "openCompanyNameOptions",
    title: "Load Company Name Dictionary",
    contexts: ["browser_action"]
});

browserAPI.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === "openCompanyNameOptions") {
        browserAPI.tabs.create({
            url: browserAPI.runtime.getURL("file-picker.html")
        });
    }
});