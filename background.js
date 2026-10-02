const browserAPI = typeof browser !== "undefined" ? browser : chrome;


// ============================================================
// MENU IDS
// ============================================================

const MENU_IDS = {
    TITLE: "copy-title",
    TITLE_URL: "copy-title-url",
    URL: "copy-url",
    MARKDOWN: "copy-markdown",
    RAW: "copy-raw",
    COMPANY_NAME_OPTIONS: "openCompanyNameOptions"
};


// ============================================================
// URL HELPERS
// ============================================================

function isPornDbUrl(url) {
    return typeof url === "string" &&
        /https?:\/\/(?:www\.)?theporndb\.net\//i.test(url);
}

function isSoliditetUrl(url) {
    return typeof url === "string" &&
        /https?:\/\/(?:www\.)?soliditet\.no\//i.test(url);
}


// ============================================================
// CREATE CONTEXT MENUS
// ============================================================

function createContextMenus() {
    // Remove old menu entries first.
    browserAPI.contextMenus.removeAll()
        .then(() => {

            browserAPI.contextMenus.create({
                id: MENU_IDS.TITLE,
                title: "Copy Title          (Click Extension Icon)",
                contexts: ["page"]
            });

            browserAPI.contextMenus.create({
                id: MENU_IDS.TITLE_URL,
                title: "Copy Title + URL      (Shift+Ctrl+F)",
                contexts: ["page"]
            });

            browserAPI.contextMenus.create({
                id: MENU_IDS.URL,
                title: "Copy URL",
                contexts: ["page"]
            });

            browserAPI.contextMenus.create({
                id: MENU_IDS.MARKDOWN,
                title: "Copy Markdown",
                contexts: ["page"]
            });

            browserAPI.contextMenus.create({
                id: MENU_IDS.RAW,
                title: "Copy RAW",
                contexts: ["page"]
            });

            browserAPI.contextMenus.create({
                id: MENU_IDS.COMPANY_NAME_OPTIONS,
                title: "Load Company Name Dictionary",
                contexts: ["browser_action"]
            });

        })
        .catch((error) => {
            console.error("❌ Failed to recreate context menus:", error);
        });
}

createContextMenus();


// ============================================================
// UPDATE CONTEXT MENU FOR CURRENT TAB
// ============================================================

function updateContextMenuForTab(tab) {
    let titleText;
    let titleUrlText;

    if (isPornDbUrl(tab?.url)) {
        titleText = "Copy Plex Filename  (Click Extension Icon)";
        titleUrlText = "Copy Plex+Perform  (Shift+Ctrl+F)";
    } else {
        titleText = "Copy Title          (Click Extension Icon)";

        titleUrlText = isSoliditetUrl(tab?.url)
            ? "Copy Company Info      (Shift+Ctrl+F)"
            : "Copy Title + URL      (Shift+Ctrl+F)";
    }

    browserAPI.contextMenus.update(MENU_IDS.TITLE, {
        title: titleText
    });

    browserAPI.contextMenus.update(MENU_IDS.TITLE_URL, {
        title: titleUrlText
    });
}


// ============================================================
// UPDATE MENU WHEN ACTIVE TAB CHANGES
// ============================================================

browserAPI.tabs.onActivated.addListener((activeInfo) => {
    browserAPI.tabs.get(activeInfo.tabId)
        .then((tab) => {
            updateContextMenuForTab(tab);
        })
        .catch((error) => {
            console.error("❌ Failed to get active tab:", error);
        });
});


// ============================================================
// UPDATE MENU WHEN TAB URL CHANGES
// ============================================================

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === "complete") {
        updateContextMenuForTab(tab);
    }
});


// ============================================================
// CONTEXT MENU ACTIONS
// ============================================================

browserAPI.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab || !tab.id) {
        return;
    }

    let action = null;

    switch (info.menuItemId) {

        case MENU_IDS.TITLE:
            action = "copyTitle";
            break;

        case MENU_IDS.TITLE_URL:
            if (isPornDbUrl(tab.url)) {
                action = "copyTitleWithUrl";
            } else if (isSoliditetUrl(tab.url)) {
                action = "copySoliditetFull";
            } else {
                action = "copyTitleWithUrl";
            }
            break;

        case MENU_IDS.URL:
            action = "copyUrl";
            break;

        case MENU_IDS.MARKDOWN:
            action = "copyMarkdown";
            break;

        case MENU_IDS.RAW:
            action = "copyRawTitle";
            break;

        case MENU_IDS.COMPANY_NAME_OPTIONS:
            browserAPI.tabs.create({
                url: browserAPI.runtime.getURL("file-picker.html")
            });
            return;
    }

    if (action) {
        browserAPI.tabs.sendMessage(tab.id, {
            action: action
        }).catch((error) => {
            console.error("❌ Failed to send context-menu action:", error);
        });
    }
});

// ============================================================
// KEYBOARD SHORTCUT
// ============================================================

browserAPI.commands.onCommand.addListener((command, tab) => {
    if (!tab || !tab.id) {
        return;
    }

    if (command !== "copy-title-url") {
        return;
    }

    const action = isSoliditetUrl(tab.url)
        ? "copySoliditetFull"
        : "copyTitleWithUrl";

    browserAPI.tabs.sendMessage(tab.id, {
        action: action
    }).catch((error) => {
        console.error("❌ Failed to send keyboard shortcut action:", error);
    });
});

// ============================================================
// EXTENSION ICON
// ============================================================

browserAPI.browserAction.onClicked.addListener((tab, clickData) => {
    console.log("🟢 Extension clicked!", clickData);

    let action = "copyTitle";

    if (
        clickData.modifiers.includes("Shift") &&
        clickData.modifiers.includes("Alt")
    ) {
        action = "copyMarkdown";

    } else if (
        clickData.modifiers.includes("Shift") &&
        clickData.modifiers.includes("Ctrl")
    ) {
        action = "copyRawTitle";

    } else if (clickData.modifiers.includes("Shift")) {
        if (isSoliditetUrl(tab.url)) {
            action = "copySoliditetFull";
        } else {
            action = "copyTitleWithUrl";
        }

    } else if (clickData.modifiers.includes("Ctrl")) {
        action = "copyUrl";
    }

    browserAPI.tabs.sendMessage(tab.id, {
        action: action
    }).catch((error) => {
        console.error("❌ Failed to send icon action:", error);
    });
});