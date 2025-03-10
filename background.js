const browserAPI = typeof browser !== "undefined" ? browser : chrome;

browserAPI.browserAction.onClicked.addListener((tab) => {
  console.log("🟢 Button clicked - sending message to content script");
  browserAPI.tabs.sendMessage(tab.id, { action: "copyTitle" }, (response) => {
    if (browserAPI.runtime.lastError) {
      console.error("❌ Error sending message:", browserAPI.runtime.lastError);
    } else {
      console.log("📩 Message sent to content.js - Response:", response);
    }
  });
});
