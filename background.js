const browserAPI = typeof browser !== "undefined" ? browser : chrome;

browserAPI.browserAction.onClicked.addListener((tab) => {
  console.log("🟢 Button clicked - Copying title");
  browserAPI.tabs.executeScript(tab.id, { file: "content.js" }, () => {
    browserAPI.tabs.sendMessage(tab.id, { action: "copyTitle" });
  });
});
