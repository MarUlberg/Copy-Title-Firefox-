console.log("🟡 Content script loaded!");

// Determines which function to use based on the website
const siteHandlers = {
    "amazon.": processAmazonTitle,
    "youtube.com": processYouTubeTitle,
    "proff.no": processProffTitle,
    "theporndb.net": processAdultdbTitle,
    "mail.google.com": processGmailTitle,
    "soliditet.no": processSoliditetTitle,
    "reddit.com": processRedditTitle
};

function getSiteHandler() {
  const siteURL = window.location.origin;
  for (let site in siteHandlers) {
    if (siteURL.includes(site)) {
      return siteHandlers[site];
    }
  }
  return processGenericTitle;
}


// Processes title for Soliditet
function processSoliditetTitle(title) {
    console.log("🔵 Processing title for Soliditet");
    
    function findCompanyName() {
        console.log("🔍 Searching for company name...");
        
        // Select the h2 that contains a 9-digit number (organization number)
        let companyElement = Array.from(document.querySelectorAll("h2")).find(el => /\b\d{9}\b/.test(el.innerText));
        
        if (companyElement) {
            let companyName = companyElement.innerText.trim();
            console.log("✅ Found company name:", companyName);
            
            // Check if the URL ends with "/nordicCompanyReport.sp"
            if (window.location.pathname.endsWith("/nordicCompanyReport.sp")) {
                console.log("🌍 Non-Norwegian company detected, skipping formatting.");
                return companyName; // Return as-is for non-Norwegian companies
            }

            return formatCompanyName(companyName); // Apply formatting for Norwegian companies
        }
        
        console.warn("⚠ Company name not found! Setting up observer...");
        observeCompanyName();
        return title; // Fallback until observer finds the company name
    }
    
    function observeCompanyName() {
        const observer = new MutationObserver((mutations, obs) => {
            let companyElement = Array.from(document.querySelectorAll("h2")).find(el => /\b\d{9}\b/.test(el.innerText));
            
            if (companyElement) {
                let companyName = companyElement.innerText.trim();
                console.log("🔍 Observer detected company name:", companyName);
                obs.disconnect();
                processPageTitle(); // Retry title copy
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }
    
    function formatCompanyName(companyName) {
        // Extract the organization number
        let orgNumberMatch = companyName.match(/\b\d{9}\b/);
        let orgNumber = orgNumberMatch ? orgNumberMatch[0] : "";
        
        // Remove the organization number from the string
        companyName = companyName.replace(/\b\d{9}\b/, "").trim();
        
        // Apply formatting for suffixes and domains
        companyName = fixCompanySuffixes(companyName);
        companyName = fixDomainCase(companyName);

        return companyName + (orgNumber ? " " + orgNumber : "");
    }
    
    return findCompanyName();
}

// Processes title for Reddit
function processRedditTitle(title) {
    console.log("🔴 Processing title for Reddit");

    // Remove flair (anything inside brackets at the beginning)
    title = title.replace(/^\[.*?\]\s*/, "");

    // Remove everything after and including " : "
    title = title.split(" : ")[0].trim();

    console.log("📋 Formatted Title:", title);
    return title;
}

// Processes title for Gmail
function processGmailTitle(title) {
  console.log("📧 Processing title for Gmail");

  let parts = title.split(" - ");
  
  for (let part of parts) {
    if (part.includes("@")) {
      console.log("📋 Extracted Email:", part);
      return part; // Return the email address
    }
  }
  console.warn("⚠ No email found in Gmail title!");
  return title; // Fallback in case no email is found
}

// Processes title for Amazon product pages
function processAmazonTitle(title) {
  console.log("🛒 Processing title for Amazon");

  // Remove "Amazon: " or "Amazon.com: " from the beginning if present
  title = title.replace(/^Amazon(\.com)?:\s*/i, "");

  // Find the first occurrence of ",", " - ", or " – " and trim at that point
  let stopChars = [",", " - ", " – "];
  let minIndex = title.length; // Start with the full length of the title

  for (let char of stopChars) {
    let index = title.indexOf(char);
    if (index !== -1 && index < minIndex) {
      minIndex = index;
    }
  }

  // Trim title at the first separator found
  let trimmedTitle = title.substring(0, minIndex).trim();

  console.log("📋 Formatted Title:", trimmedTitle);
  return trimmedTitle;
}

// Processes title for YouTube videos
function processYouTubeTitle(title) {
    console.log("🎬 Processing title for YouTube");

    // Remove " - YouTube" at the end
	title = title.replace(/ - YouTube$/, "").trim();

    // Remove anything after and including " [" or " ("
    title = title.split(" [")[0].split(" (")[0].trim();

    // Apply title case formatting while preserving big words
    let formattedTitle = properTitleCase(title);

    console.log("📋 Formatted Title:", formattedTitle);
    return formattedTitle;
}

// Processes title for proff.no
function processProffTitle(title) {
  console.log("🔵 Processing title for proff.no");

  let parts = title.split(" - ");

  if (parts.length >= 3) {
    // Remove all spaces in the second part before joining
    let formattedTitle = parts[0] + " " + parts[1].replace(/\s+/g, "");

    console.log("📋 Formatted Title:", formattedTitle);
    return formattedTitle;
  }
  return title;
}

// Processes title for theporndb.net
function processAdultdbTitle(title) {
  console.log("🔴 Processing title for ThePornDB");

  function formatDate(month, day, year) {
    const months = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
      Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12"
    };
    return `${year}-${months[month]}-${day.padStart(2, '0')}`;
  }

  // Remove extra parts of the title
  title = title.split(/ :: /)[0].trim();

  let dateRegex = /\b([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})\b/;
  let dateMatch = null;

  // Possible sources for the date
  let sources = [
    document.body.innerText,
    document.body.innerHTML,
    document.querySelector("meta[property='article:published_time']")?.content,
    document.querySelector("meta[name='date']")?.content,
    ...Array.from(document.querySelectorAll("h1, h2, h3, p, span")).map(el => el.innerText)
  ];

  // Try to find a date on the page
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

  // Replace colons with dashes
  title = title.replace(/:/g, " -");

  return title;
}

// Processes generic page titles (default behavior)
function processGenericTitle(title) {
    // Remove common separators like " - ", " :: ", " — ", " | "
    let cleanTitle = title.split(/ - | :: | — | \| | : /)[0].trim();

    // Check if the title contains a dash and a question
    let dashParts = title.split(" - ");
    if (dashParts.length > 1 && dashParts[1].includes("?")) {
        let firstPart = dashParts[0].trim();
        let secondPart = dashParts.slice(1).join(" - ").trim(); // Keep the full second part

        // If the first part is a single word, remove it
        if (!firstPart.includes(" ")) {
            cleanTitle = secondPart;
        }
    }

    // Check if "?" is followed by unwanted text (like " - Site Name")
    let questionIndex = cleanTitle.indexOf("?");
    if (questionIndex !== -1) {
        let afterQuestion = cleanTitle.substring(questionIndex + 1).trim();

        // If there's unwanted text after "?", keep only up to the "?"
        if (afterQuestion.length === 0 || afterQuestion.match(/^(by |at |on |-|\|)/i)) {
            cleanTitle = cleanTitle.substring(0, questionIndex + 1).trim();
        }
    }

    return cleanTitle;
}



// Utility function to get company name from external site
function fetchCompanyName(orgNumber, callback) {
    console.log(`🌐 Fetching company name for Org#: ${orgNumber}`);
    
    // Placeholder: Replace this with an actual API request later
    setTimeout(() => {
        console.error("❌ Not found.");
        callback(null);
    }, 1000);
}

// Utility function to fix company suffixes
function fixCompanySuffixes(companyName) {
    const suffixes = new Set([
        "AS", "ASA", "DA", "ANS", "ENK", "BA", "SE", "NUF", "KF", "IKS", "STI", 
        "AB", "HB", "KB", "EF", "EK", "A/S", "ApS", "IVS", "P/S", "K/S", "I/S", 
        "FMBA", "SMBA"
    ]);

    let words = companyName.split(" ");
    if (words.length > 1) {
        let lastWord = words[words.length - 1];
        if (suffixes.has(lastWord.toUpperCase())) {
            let baseName = words.slice(0, -1).join(" ");
            return properTitleCase(baseName) + " " + lastWord.toUpperCase();
        }
    }
    return properTitleCase(companyName);
}

// Utility function to process domain names
function fixDomainCase(text) {
    const domainPattern = /\b((?:[a-zA-Z0-9-]+)\.([a-zA-Z]{2,}))\b/g;
    return text.replace(domainPattern, (match, domainName, tld) => {
        return domainName.replace(new RegExp("\\." + tld + "$"), "." + tld.toLowerCase());
    });
}

// Converts text to Title Case, preserving acronyms in `bigWords`
function properTitleCase(text) {
    const smallWords = new Set([
	    "a", "an", "the", "and", "but", "or", "nor", "for", "so", "yet",
		"at", "by", "in", "of", "on", "to", "up", "with", "as", "if", "is", 
		"it", "than", "that", "via"
]);
    
	const bigWords = new Set([
		"ABBA", "AC", "AC/DC", "ADIDAS", "AFK", "AI", "AMD", "A$AP", "AWOLNATION", 
		"BBL", "BFF", "BLK", "JKS", "BRB", "BTS", "BTW", "CBGB", "CHIPS", "CHVRCHES", 
		"CNR", "CQ", "DAFT PUNK", "DC", "DEBS", "DMT", "DM", "DNA", "DOA", "DUI", "DURRY", 
		"DWNTWN", "DYWTYLM", "EDM", "EOD", "ETA", "FARTBARF", "FIDLAR", "FIST", "FIZZ", 
		"FML", "FOD", "FTW", "FUBAR", "FYI", "GATTACA", "GG", "GIFT", "GMO", "GNR", "GOAT", 
		"GTFO", "GWAR", "HAIM", "HBD", "HBU", "HEALTH", "HMU", "HOTS", "HSBF", "IAMDYNAMITE", 
		"IAMX", "IBM", "IDC", "IDGAF", "IFHY", "IKR", "ILY", "IMO", "INXS", "IKEA", "IRL", 
		"JK", "JPNSGRLS", "KISS", "LCD", "SOUNDSYSTEM", "LFG", "LIT", "LMAO", "LMK", "LOL", 
		"MEST", "MGMT", "MIA", "MIB", "MILF", "MNDR", "MSTRKRFT", "MY BABY", "NASA", "NBD", 
		"NFT", "NFWMB", "NIB", "NOFX", "NSFW", "NSU", "OFC", "OFF!", "OMG", "OK", "OU", "PCU", 
		"PROF", "PTA", "PUP", "PWR", "BTTM", "RBG", "RCA", "RED", "RIP", "RKO", "RNB", "ROFL", 
		"RV", "RVIVR", "SBTRKT", "SHC", "SIMP", "SKAAL", "SMD", "SMH", "SOL", "SONY", "SOS", 
		"STRFKR", "SWLABR", "TBA", "TBH", "TGIF", "THT", "THX", "TMI", "TMNT", "TNT", "TOOL", 
		"TOPS", "TTD", "TTNG", "TTYL", "TV", "UFO", "UHF", "UTFO", "VFW", "VIP", "VPN", 
		"WAP", "WIFI", "WHY?", "WTCHS", "WTF", "WTFIGO", "WUSA", "WYD", "XS", "XXX", 
		"YMCA", "YOLO", "ZEKE"
	]);

    return text
        .split(/\s+/) // Split on spaces while handling multiple spaces
        .map((word, index) => {
            let isBigWord = bigWords.has(word.toUpperCase());

            // Convert fully uppercase words (not in bigWords) to title case
            if (!isBigWord && word === word.toUpperCase()) {
                word = word.toLowerCase();
            }

            // Preserve words from bigWords only if they were already capitalized
            if (isBigWord && word === word.toUpperCase()) {
                return word.toUpperCase();
            }

            // Keep small words lowercase unless they're the first word
            if (index !== 0 && smallWords.has(word.toLowerCase())) {
                return word.toLowerCase();
            }

            // Handle apostrophes correctly (e.g., "He's" should remain "He's", not "He'S")
            return word.replace(/\b\w/g, char => char.toUpperCase()).replace(/'([A-Z])/g, match => match.toLowerCase());
        })
        .join(" ");
}

// Listen for message to copy the title
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

browserAPI.runtime.onMessage.addListener((message) => {
    console.log("📩 Message received in content.js:", message);

    let title = document.title;
    let siteHandler = getSiteHandler();
    let formattedTitle = siteHandler(title);
    let url = window.location.href;

    let copyText = formattedTitle; // Default action

    if (message.action === "copyTitleWithUrl") {
        copyText += `\n${url}`; // Title + URL
    } else if (message.action === "copyMarkdown") {
        copyText = `[${formattedTitle}](${url})`; // Markdown format
    } else if (message.action === "copyRawTitle") {
        copyText = title; // Unmodified raw page title
    } else if (message.action === "copyUrl") {
        copyText = url; // Only the URL
    }

    copyToClipboard(copyText);
});


// Function to copy text to clipboard
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

// Main function to process page title
function processPageTitle() {
  let title = document.title;
  let siteHandler = getSiteHandler();

  let formattedTitle = siteHandler(title);

  try {
    navigator.clipboard.writeText(formattedTitle)
      .then(() => console.log("📋 Copied title:", formattedTitle))
      .catch((err) => {
        console.warn("⚠ Clipboard API blocked, using fallback method.");
        copyToClipboard(formattedTitle);
      });
  } catch (e) {
    console.error("❌ Failed to copy title:", e);
    copyToClipboard(formattedTitle);
  }
}