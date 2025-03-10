console.log("🟡 Content script loaded!");

function copyToClipboard(text) {
  if (!navigator.clipboard) {
    console.warn("⚠ Clipboard API not available, using fallback.");
    fallbackCopyText(text);
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => console.log("📋 Successfully copied:", text))
    .catch((err) => {
      console.error("❌ Failed to copy using Clipboard API:", err);
      fallbackCopyText(text);
    });
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (document.execCommand("copy")) {
      console.log("📋 Copied using fallback method:", text);
    } else {
      console.error("❌ execCommand copy failed.");
    }
  } catch (e) {
    console.error("❌ execCommand error:", e);
  }
  document.body.removeChild(textarea);
}

function processPageTitle() {
  function processAdultdbTitle(title) {
    function formatDate(month, day, year) {
      const months = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
      return `${year}-${months[month]}-${day.padStart(2, '0')}`;
    }

    title = title.split(/ :: /)[0].trim();
    let dateRegex = /\b([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})\b/;
    let dateMatch = null;

    let sources = [
      document.body.innerText,
      document.body.innerHTML,
      document.querySelector("meta[property='article:published_time']")?.content,
      document.querySelector("meta[name='date']")?.content,
      ...Array.from(document.querySelectorAll("h1, h2, h3, p, span")).map(el => el.innerText)
    ];

    for (let source of sources) {
      if (source && typeof source === "string") {
        let match = source.match(dateRegex);
        if (match) {
          dateMatch = match;
          break;
        }
      }
    }

    if (dateMatch) {
      let formattedDate = formatDate(dateMatch[1], dateMatch[2], dateMatch[3]);
      if (title.includes("/")) {
        title = title.replace(/\s*\/\s*/, ` ${formattedDate} `);
      }
      console.log("✅ Found Date:", dateMatch[0], "➡ Reformatted as:", formattedDate);
    } else {
      console.warn("⚠ No date found on the page!");
    }

    title = title.replace(/:/g, " -");
    return title;
  }

  let title = document.title;
  const siteURL = window.location.origin;

  if (siteURL === "https://theporndb.net") {
    title = processAdultdbTitle(title);
  } else {
    title = title.split(/ - | :: | — /)[0].trim();
  }

  try {
    navigator.clipboard.writeText(title)
      .then(() => console.log("📋 Copied title:", title))
      .catch((err) => {
        console.warn("⚠ Clipboard API blocked, using fallback method.");
        copyToClipboard(title);
      });
  } catch (e) {
    console.error("❌ Failed to copy title:", e);
    copyToClipboard(title);
  }
}

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

browserAPI.runtime.onMessage.addListener((message) => {
  console.log("📩 Message received in content.js:", message);
  if (message.action === "copyTitle") {
    processPageTitle();
  }
});
