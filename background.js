const browserAPI = typeof browser !== "undefined" ? browser : chrome;

browserAPI.browserAction.onClicked.addListener((tab, clickData) => {
    console.log("🟢 Extension clicked!", clickData);

    let action = "copyTitle"; // Default action

    if (clickData.modifiers.includes("Shift") && clickData.modifiers.includes("Alt")) {
        action = "copyMarkdown"; // Shift + Alt → Copy as Markdown
    } else if (clickData.modifiers.includes("Shift") && clickData.modifiers.includes("Ctrl")) {
        action = "copyRawTitle"; // Ctrl + Shift → Copy raw page title
    } else if (clickData.modifiers.includes("Shift")) {
        action = "copyTitleWithUrl"; // Shift → Copy Title + URL
    } else if (clickData.modifiers.includes("Ctrl")) {
        action = "copyUrl"; // Ctrl → Copy only URL
    }

    browserAPI.tabs.sendMessage(tab.id, { action: action });
});
