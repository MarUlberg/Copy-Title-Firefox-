/**
 * Copy Page Title — Firefox
 *
 * Background script for the Firefox version of the Copy Page Title
 * browser extension.
 *
 * This script manages the extension's background functionality, including
 * context menus, keyboard shortcuts, toolbar interactions, tab changes,
 * and communication with the content script. It coordinates user
 * actions from the browser interface and passes the appropriate copy
 * requests to content.js for page-level processing.
 *
 * This file contains the Firefox-specific background implementation of
 * the extension. The content.js file is shared unchanged between the
 * Chrome and Firefox versions.
 */

// ============================================================
// BROWSER API
// ============================================================

const browserAPI = typeof browser !== "undefined" ? browser : chrome;


// ============================================================
// CONTEXT MENU
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
// CHECK URL
// ============================================================

function isSoliditetUrl(url) {
    if (!url) {
        return false;
    }

    try {
        const hostname = new URL(url).hostname.toLowerCase();

        return (
            hostname === "soliditet.no" ||
            hostname.endsWith(".soliditet.no")
        );
    } catch (error) {
        return false;
    }
}


function isPornDbUrl(url) {
    if (!url) {
        return false;
    }

    try {
        const hostname = new URL(url).hostname.toLowerCase();

        return (
            hostname === "theporndb.net" ||
            hostname.endsWith(".theporndb.net")
        );
    } catch (error) {
        return false;
    }
}


// ============================================================
// UPDATE MENU LABEL
// ============================================================

function updateContextMenuForTab(tab) {
    let titleText;
    let titleUrlText;

    if (isPornDbUrl(tab?.url)) {
        titleText = "Copy Plex Filename  (Click Extension Icon)";
        titleUrlText = "Copy Plex + Performer  (Shift+Ctrl+F)";
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
// CREATE CONTEXT MENUS
// ============================================================

function createContextMenus() {
    // Remove old menu entries first so the order is recreated consistently.
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
            console.error(
                "❌ Failed to recreate context menus:",
                error
            );
        });
}

createContextMenus();


// ============================================================
// UPDATE MENU WHEN ACTIVE TAB CHANGES
// ============================================================

browserAPI.tabs.onActivated.addListener((activeInfo) => {
    browserAPI.tabs.get(activeInfo.tabId)
        .then((tab) => {
            updateContextMenuForTab(tab);
        })
        .catch((error) => {
            console.error(
                "❌ Failed to get active tab:",
                error
            );
        });
});


// ============================================================
// UPDATE MENU WHEN PAGE NAVIGATES
// ============================================================

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === "complete") {
        updateContextMenuForTab(tab);
    }
});


// ============================================================
// RUN CONTENT ACTION
// ============================================================

function runCopyCommand(tabId, action) {
    browserAPI.tabs.sendMessage(tabId, {
        action: action
    }).catch((error) => {
        console.error(
            "❌ Failed to send content action:",
            error
        );
    });
}


// ============================================================
// CONTEXT MENU CLICK
// ============================================================

browserAPI.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id) {
        return;
    }

    let action;

    switch (info.menuItemId) {
        case MENU_IDS.TITLE:
            action = "copyTitle";
            break;

        case MENU_IDS.URL:
            action = "copyUrl";
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

        default:
            return;
    }

    runCopyCommand(tab.id, action);
});


// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

browserAPI.commands.onCommand.addListener((command, tab) => {
    if (!tab?.id) {
        return;
    }

    switch (command) {
        case "copy-title-url":
            runCopyCommand(
                tab.id,
                isSoliditetUrl(tab.url)
                    ? "copySoliditetFull"
                    : "copyTitleWithUrl"
            );
            break;

        default:
            return;
    }
});


// ============================================================
// TOOLBAR BUTTON
// ============================================================

browserAPI.browserAction.onClicked.addListener((tab, clickData) => {
    if (!tab?.id) {
        return;
    }

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

    runCopyCommand(tab.id, action);
});