/**
 * Copy Page Title — Firefox
 *
 * Background script for the Firefox version of the Copy Page Title
 * browser extension.
 *
 * Firefox-specific browser plumbing lives here. Page/title processing
 * remains in content.js, which is shared with Chrome.
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
    URL: "copy-url",
    RAW: "copy-raw",
    TITLE_URL: "copy-title-url",
    MARKDOWN: "copy-markdown",
    BBCODE: "copy-bbcode",
    HTML: "copy-html"
};

const customSite = {
    "amazon.": {
        title: "Copy Product Title       (Click Extension Icon)"
    },

    "mail.google.com": {
        title: "Copy Email Address       (Click Extension Icon)"
    },

    "instagram.com": {
        title: "Copy Instagram Username  (Click Extension Icon)"
    },

    "iptorrents.com": {
        title: "Copy Video Title         (Click Extension Icon)"
    },

    "mobygames.com": {
        title: "Copy Game Title          (Click Extension Icon)"
    },

    "theporndb.net": {
        title: "Copy Plex Filename       (Click Extension Icon)",
        url: "Copy Plex + Performer    (Shift+Ctrl+F)"
    },

    "proff.no": {
        title: "Copy Company + Orgnr.   (Click Extension Icon)"
    },

    "pornhub.com": {
        title: "Copy PornHub Title       (Click Extension Icon)"
    },

    "soliditet.no": {
        title: "Copy Company + Orgnr.   (Click Extension Icon)",
        url: "Copy Full Company Info   (Shift+Ctrl+F)"
    },

    "open.spotify.com": {
        title: "Copy Spotify Title       (Click Extension Icon)"
    },

    "twitch.tv": {
        title: "Copy Streamer Name   (Click Extension Icon)",
        url: "Copy Twitch Message  (Shift+Ctrl+F)"
    },

    "x.com": {
        title: "Copy X Username          (Click Extension Icon)"
    },

    "reddit.com": {
        title: "Copy Reddit Title        (Click Extension Icon)"
    },

    "retroachievements.org/user/": {
        title: "Copy User Achievement Points (Click Extension Icon)",
        url: "Copy User + Last Played   (Shift+Ctrl+F)"
    },

    "retroachievements.org/game/": {
        title: "Copy Game Title        (Click Extension Icon)",
        url: "Copy Achievement List   (Shift+Ctrl+F)"
    },

    "youtube.com": {
        title: "Copy YouTube Video Title  (Click Extension Icon)"
    }
};


function getSiteMenuConfig(url) {
    if (!url) {
        return null;
    }

    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        const fullUrl = `${hostname}${parsedUrl.pathname}`.toLowerCase();

        return (
            Object.entries(customSite).find(([site]) => {
                if (site.includes("/")) {
                    return fullUrl.startsWith(site);
                }

                return (
                    hostname === site ||
                    hostname.endsWith(`.${site}`)
                );
            })?.[1] || null
        );

    } catch (error) {
        return null;
    }
}


// ============================================================
// UPDATE MENU LABEL
// ============================================================

function updateContextMenuForTab(tab) {
    let titleText = "Copy Title          (Click Extension Icon)";
    let urlText = "Copy URL             (Shift+Ctrl+F)";

    const siteLabels = getSiteMenuConfig(tab?.url);

    if (siteLabels) {
        if (siteLabels.title) {
            titleText = siteLabels.title;
        }

        if (siteLabels.url) {
            urlText = siteLabels.url;
        }
    }

    browserAPI.contextMenus.update(
        MENU_IDS.TITLE,
        { title: titleText }
    ).catch(() => {});

    browserAPI.contextMenus.update(
        MENU_IDS.URL,
        { title: urlText }
    ).catch(() => {});
}


// ============================================================
// CREATE CONTEXT MENUS
// ============================================================

function createContextMenus() {
    browserAPI.contextMenus.removeAll()
        .then(() => {
            browserAPI.contextMenus.create({
                id: MENU_IDS.TITLE,
                title: "Copy Title (Click Extension Icon)",
                contexts: ["page"]
            });

            browserAPI.contextMenus.create({
                id: MENU_IDS.URL,
                title: "Copy URL (Shift+Ctrl+F)",
                contexts: ["page"]
            });

            browserAPI.contextMenus.create({
                id: MENU_IDS.RAW,
                title: "Copy Raw Title",
                contexts: ["page"]
            });

            browserAPI.contextMenus.create({
                id: MENU_IDS.TITLE_URL,
                title: "Copy Title + URL",
                contexts: ["page"]
            });

            browserAPI.contextMenus.create({
                id: MENU_IDS.MARKDOWN,
                title: "-- Markdown Link",
                contexts: ["page"]
            });

            browserAPI.contextMenus.create({
                id: MENU_IDS.BBCODE,
                title: "-- BBCode Link",
                contexts: ["page"]
            });

            browserAPI.contextMenus.create({
                id: MENU_IDS.HTML,
                title: "-- HTML Link",
                contexts: ["page"]
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
        .then((tab) => updateContextMenuForTab(tab))
        .catch(() => {});
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
    // content.js is declared as a Firefox content script in manifest.json,
    // so there is no need to inject it repeatedly.
    browserAPI.tabs.sendMessage(tabId, {
        action: action
    }).catch((error) => {
        console.error(
            "❌ Failed to send action to content.js:",
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

        case MENU_IDS.RAW:
            action = "copyRawTitle";
            break;

        case MENU_IDS.TITLE_URL:
            action = "copyTitleWithUrl";
            break;

        case MENU_IDS.MARKDOWN:
            action = "copyMarkdown";
            break;

        case MENU_IDS.BBCODE:
            action = "copyBBCode";
            break;

        case MENU_IDS.HTML:
            action = "copyHTML";
            break;

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

    let action;

    switch (command) {
        case "copy-title":
            action = "copyTitle";
            break;

        case "copy-url":
            action = "copyUrl";
            break;

        case "copy-raw":
            action = "copyRawTitle";
            break;

        case "copy-title-url":
            action = "copyTitleWithUrl";
            break;

        case "copy-markdown":
            action = "copyMarkdown";
            break;

        case "copy-bbcode":
            action = "copyBBCode";
            break;

        case "copy-html":
            action = "copyHTML";
            break;

        default:
            return;
    }

    runCopyCommand(tab.id, action);
});


// ============================================================
// TOOLBAR BUTTON
// ============================================================

browserAPI.browserAction.onClicked.addListener((tab) => {
    if (!tab?.id) {
        return;
    }

    runCopyCommand(tab.id, "copyTitle");
});


// ============================================================
// CLIPBOARD MESSAGE
// ============================================================

browserAPI.runtime.onMessage.addListener((message, sender) => {
    if (
        message.action !== "copyToClipboard" ||
        !sender.tab?.id ||
        typeof message.text !== "string"
    ) {
        return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = message.text;
    document.body.appendChild(textArea);
    textArea.select();

    try {
        if (!document.execCommand("copy")) {
            throw new Error("The browser rejected the clipboard copy command.");
        }

        console.log("✅ Successfully copied:", message.text);

        browserAPI.tabs.executeScript(sender.tab.id, {
            code: `console.log("✅ Successfully copied:", ${JSON.stringify(message.text)});`
        }).catch((error) => {
            console.error("❌ Failed to log copied text in the page console:", error);
        });
    } catch (error) {
        console.error("❌ Failed to copy to clipboard:", error);
    } finally {
        document.body.removeChild(textArea);
    }
});