/**
 * Copy Page Title
 *
 * Content script for the Copy Page Title browser extension.
 *
 * The extension provides convenient ways to copy information from the
 * current web page to the clipboard. It supports copying page titles,
 * URLs, title-and-URL combinations, formatted Markdown links, and other
 * processed page information where appropriate. The content script
 * performs the page-level processing required to collect, format, and
 * return the requested information to the extension's background script.
 *
 * This content.js file is identical between the Firefox and Chrome
 * versions of the Copy Page Title extension. Keeping the content script
 * shared between both browser implementations ensures that page-level
 * copy behavior remains consistent across the two extensions.
 */

(function () {
    "use strict";

    console.log("🟡 Content script loaded!");

// Determines which function to use based on the website
const siteHandlers = {
    "amazon.": processAmazonTitle,
    "mail.google.com": processGmailTitle,
    "instagram.com": processInstagramTitle,
    "iptorrents.com": processTorrentsTitle,
    "mobygames.com": processMobygamesTitle,
    "theporndb.net": processAdultdbTitle,
    "proff.no": processProffTitle,
    "pornhub.com": processPHTitle,
    "reddit.com": processRedditTitle,
    "retroachievements.org": processRetroTitle,
    "soliditet.no": processSoliditetTitle,
    "open.spotify.com": processSpotifyTitle,
    "twitch.tv": processTwitchTitle,
    "x.com": processTwitterTitle,
    "youtube.com": processYouTubeTitle,
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

// Determines which function to use for site-specific URL commands
const siteUrlHandlers = {
    "theporndb.net": (title) => processAdultdbTitle(title, true),
    "retroachievements.org": processRetroAchivements,
    "soliditet.no": processSoliditetFull,
    "twitch.tv": processTwitchMessage,
};

function getSiteUrlHandler() {
    const siteURL = window.location.origin;

    for (let site in siteUrlHandlers) {
        if (siteURL.includes(site)) {
            return siteUrlHandlers[site];
        }
    }

    return null;
}

// Processes title for Amazon product pages
function processAmazonTitle(title) {
  console.log("🔵 Processing title for Amazon");

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

// Processes title for Gmail
function processGmailTitle(title) {
  console.log("🔵 Processing title for Gmail");

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

// Processes title for Instagram pages by extracting the username
function processInstagramTitle(title) {
    console.log("🔵 Processing title for Instagram");

    // Try to find the username in the specific span class
    let usernameElement = document.querySelector("span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft");

    if (usernameElement) {
        let username = usernameElement.innerText.trim();
        console.log("📋 Extracted Instagram username:", username);
        return `@${username}`; // Return the username prefixed with "@"
    }

    console.warn("⚠ Instagram username not found!");
    return "Instagram"; // Fallback if username cannot be found
}

// Processes title for Torrent sites
function processTorrentsTitle(rawTitle) {

  if (!looksLikeVideo(rawTitle))
    return processGenericTitle(rawTitle);

  let title = rawTitle;

  // ===============================
  // 1. Normalize
  // ===============================
  title = title
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Remove IPTorrents junk
  title = title.replace(/\s*-\s*Iptorrents.*$/i, "").trim();

  // Remove leading [group]
  title = title.replace(/^\[[^\]]+\]\s*/, "");

  // ===============================
  // 2. Hard cut at XXX
  // ===============================
  if (/\bXXX\b/i.test(title)) {
    title = title.split(/\bXXX\b/i)[0].trim();
  }

  // ===============================
  // 3. Fully bracketed anime
  // ===============================
  if (/^(\[[^\]]+\]){2,}/.test(rawTitle)) {

    let brackets = [...rawTitle.matchAll(/\[([^\]]+)\]/g)]
      .map(x => x[1]);

    let show = brackets.find(b =>
      b.length > 5 &&
      !looksLikeVideo(b) &&
      !/raw|dual|sub|aac|hevc|x26|bit|audio/i.test(b)
    );

    let ep = brackets.find(b => /^\d+$/.test(b));

    if (show && ep)
      return fixTitleCase(`${properTitleCase(show)} E${ep.padStart(2,"0")}`);
  }

  // Remove release group like -Mami
  title = title.replace(/-[A-Za-z0-9]+$/, "").trim();

  // ===============================
  // NEW: Cut title at first video identifier
  // ===============================
  title = cutAtFirstVideoTag(title);

  // Remove trailing brackets like [V2][English]
  title = title.replace(/(\s*\[[^\]]+\])+$/, "").trim();

  // ===============================
  // 4. TV Episode
  // ===============================
  let tvEp = title.match(/(.+?)\s*(S\d{2}[EDP]?\d{2,3})\s*(.*)/i);
  if (tvEp) {
    let show = properTitleCase(tvEp[1].trim());
    let ep = tvEp[2].toUpperCase().replace(/[DP]/, "E");
    let name = properTitleCase(tvEp[3].trim());
    return fixTitleCase(`${show} ${ep}${name ? " " + name : ""}`);
  }

  // ===============================
  // 5. Anime numeric episode
  // ===============================
  let animeEp = title.match(/(.+?)\s*-\s*(\d{2,4})$/);
  if (animeEp) {
    return fixTitleCase(`${properTitleCase(animeEp[1].trim())} E${animeEp[2]}`);
  }

  // ===============================
  // 6. TV Season
  // ===============================
  let tvSeason =
      title.match(/(.+?)\s*S(\d{2})\b/i) ||
      title.match(/(.+?)\s*Season\s*(\d+)/i);

  if (tvSeason && !/[EDP]\d{2}/i.test(title)) {
    let show = properTitleCase(tvSeason[1].trim());
    let season = parseInt(tvSeason[2]);
    return fixTitleCase(`${show} Season ${season}`);
  }

  // ===============================
  // 7. Porn
  // ===============================
  let porn = title.match(/^([A-Za-z0-9]+)\s+(\d{2,4})[- ](\d{2})[- ](\d{2})\s+(.*)/);

  if (porn) {
    let studio = properTitleCase(splitStudio(porn[1]));
    let year = porn[2].length === 2 ? "20" + porn[2] : porn[2];
    let month = porn[3];
    let day = porn[4];
    let rest = properTitleCase(porn[5].trim());
    return `${studio} ${year}-${month}-${day} ${rest}`;
  }

  // ===============================
  // 8. Movie
  // ===============================
  let movie = title.match(/(.+?)\s*\(?((19|20)\d{2})\)?/);
  if (movie) {
    let name = properTitleCase(movie[1].trim());
    return `${name} (${movie[2]})`;
  }

  return processGenericTitle(rawTitle);


  // ===================================================
  function cutAtFirstVideoTag(t) {
    let words = t.split(" ");

    for (let i = 0; i < words.length; i++) {
      if (videoIdentifiers.some(v =>
        new RegExp(`^${v}$`, "i").test(words[i])
      )) {
        return words.slice(0, i).join(" ").trim();
      }
    }
    return t.trim();
  }

  function splitStudio(name) {
    return name.replace(/([a-z])([A-Z])/g, "$1 $2");
  }

  function fixTitleCase(text) {
    return text.replace(/\bthe Anime\b/i, "The Anime");
  }
}

// Processes title for MobyGames
function processMobygamesTitle(title) {
    console.log("🔵 Processing title for MobyGames");

    const mobyPattern = /( box covers| cover or packaging material) - MobyGames$/;

    if (mobyPattern.test(title)) {
        let cleaned = title.replace(mobyPattern, "").trim();
        cleaned = cleaned.replace(/:/g, "_"); // Replace colons with underscores
        console.log("📋 Formatted MobyGames title:", cleaned);
        return cleaned;
    }

    console.warn("ℹ️ Not a MobyGames box/packaging page — using generic processing.");
    return processGenericTitle(title);
}

// Processes title for theporndb.net
function processAdultdbTitle(title, includePerformers = false) {
    console.log("🔵 Processing title for ThePornDB");

    function formatDate(month, day, year) {
        const months = {
            Jan: "01", Feb: "02", Mar: "03", Apr: "04",
            May: "05", Jun: "06", Jul: "07", Aug: "08",
            Sep: "09", Oct: "10", Nov: "11", Dec: "12"
        };

        return `${year}-${months[month]}-${day.padStart(2, "0")}`;
    }

    // Remove extra parts of the title
    title = title.split(/ :: /)[0].trim();

    const dateRegex = /\b([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})\b/;
    let dateMatch = null;

    // Possible sources for the date
    const sources = [
        document.body.innerText,
        document.body.innerHTML,
        document.querySelector("meta[property='article:published_time']")?.content,
        document.querySelector("meta[name='date']")?.content,
        ...Array.from(
            document.querySelectorAll("h1, h2, h3, p, span")
        ).map(el => el.innerText)
    ];

    // Try to find a date on the page
    for (const source of sources) {
        if (source && typeof source === "string") {
            const match = source.match(dateRegex);

            if (match) {
                dateMatch = match;
                break;
            }
        }
    }

    if (dateMatch) {
        const formattedDate = formatDate(
            dateMatch[1],
            dateMatch[2],
            dateMatch[3]
        );

        if (title.includes("/")) {
            title = title.replace(
                /\s*\/\s*/,
                ` ${formattedDate} `
            );
        }

        console.log(
            "✓ Found Date:",
            dateMatch[0],
            "➡ Reformatted as:",
            formattedDate
        );

    } else {
        console.warn("⚠ No date found on the page!");
    }

    // Replace colons with dashes
    title = title.replace(/:/g, " -");

    // Only add performers when explicitly requested
    if (includePerformers) {

        const performers = [
            ...document.querySelectorAll(
                ".grid.grid-cols-performer-site-card h2 a[title]"
            )
        ]
            .map(a => a.getAttribute("title").trim())
            .filter(
                (name, index, arr) =>
                    name && arr.indexOf(name) === index
            );

        if (performers.length) {
            title += ` (${performers.join(" - ")})`;
        }
    }

    return title;
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

// Processes title for Pornhub.com
function processPHTitle(title) {
    console.log("🔵 Processing title for PornHub");
    
    // Remove " - Pornhub.com" from the end
    let cleanedTitle = title.replace(/\s*-\s*Pornhub\.com$/i, "").trim();
    
	// Checks if ALL LETTERS are uppercase (ignoring numbers, symbols, whitespace)
	const isAllCaps = (str) => !/[a-z]/.test(str);

	// Apply properTitleCase only if letters are ALL CAPS
	if (isAllCaps(cleanedTitle)) {
		cleanedTitle = properTitleCase(cleanedTitle);
	}
    
    // Check for episode pattern
    const episodeMatch = cleanedTitle.match(/(.*?)\s*-\s*(.*?)\s*\((EPISODE\s*(\d+))\)/i);
    
    if (episodeMatch) {
        const titlePart = episodeMatch[1].trim();
        const seriesPart = episodeMatch[2].trim();
        const episodeNum = episodeMatch[4].trim();
        
        // Format as: {Series} S01E{Episode} - {Title}
        // Example: Luna's Journey - S01E54 - Sun and Wine
        return `${seriesPart} - S01E${episodeNum} - ${titlePart}`;
    }
    
    // If no episode found, return the cleaned title
    return cleanedTitle;
}

// Processes title for Reddit
function processRedditTitle(title) {
    console.log("🔵 Processing title for Reddit");

    // Remove flair (anything inside brackets at the beginning)
    title = title.replace(/^\[.*?\]\s*/, "");

    // Remove everything after and including " : "
    title = title.split(" : ")[0].trim();

    console.log("📋 Formatted Title:", title);
    return title;
}

// Processes title for RetroAchievements
function processRetroTitle(title) {
    console.log("🔵 Processing title for RetroAchievements");

    const pathname = window.location.pathname.toLowerCase();

    // ==========================================
    // RETROACHIEVEMENTS: GAME
    // ==========================================
    if (pathname.startsWith("/game/")) {
        console.log("🎮 RetroAchievements game page");

        // Remove " · RetroAchievements"
        title = title.replace(/ · RetroAchievements$/, "");

        // Remove console shown in parentheses at the end
        title = title.replace(/\s*\([^()]*\)\s*$/, "");

        // Move ~Hack~ to the end and convert it to [Hack]
        const isHack = /^~Hack~\s*/i.test(title);

        title = title.replace(/^~Hack~\s*/i, "");

        if (isHack) {
            title += " [Hack]";
        }

        return title;
    }

    // ==========================================
    // RETROACHIEVEMENTS: USER
    // ==========================================
    if (pathname.startsWith("/user/")) {
        console.log("👤 RetroAchievements user page");

        // Remove " · RetroAchievements"
        const username = title.replace(/ · RetroAchievements$/, "");

        // Find RetroAchievement Points
        const pointsElement = document.querySelector(
            'article p span span.TrueRatio'
        );

        let points = "";

        if (pointsElement) {
            const pointsContainer = pointsElement.parentElement;
            points = pointsContainer.firstChild.textContent.trim();
        }

        // Build result
        let result = username;

        if (points) {
            result += ` - ${points} RetroAchievement Points`;
        }

        return result;
    }

    // ==========================================
    // OTHER RETROACHIEVEMENTS PAGES
    // ==========================================

    return processGenericTitle(title);
}

// Processes RetroAchievements URL commands
function processRetroAchivements(title) {
    console.log("🟣 Processing URL alternative for RetroAchievements");

    const pathname = window.location.pathname.toLowerCase();

    // ==========================================
    // RETROACHIEVEMENTS: GAME
    // ==========================================
    if (pathname.startsWith("/game/")) {
        console.log("🎮 Processing RetroAchievements game");

        const unlocked = [];
        const locked = [];

        const achievementLinks = document.querySelectorAll(
            '#game-achievement-sets-container a[data-testid="link"][href*="/achievement/"]'
        );

        console.log(
            `🏆 Found ${achievementLinks.length} achievement links`
        );

        achievementLinks.forEach(link => {
            const achievementTitle = link.innerText.trim();

            if (!achievementTitle) {
                return;
            }

            const achievementContainer = link.closest("li");

            if (!achievementContainer) {
                return;
            }

            const isUnlocked = [...achievementContainer.querySelectorAll("p")]
                .some(p => /^Unlocked\b/i.test(p.innerText.trim()));

            if (isUnlocked) {
                unlocked.push(achievementTitle);
            } else {
                locked.push(achievementTitle);
            }
        });

        const result =
            `Unlocked: ${unlocked.join(", ")}; ` +
            `Locked: ${locked.join(", ")}`;

        return result;
    }

    // ==========================================
    // RETROACHIEVEMENTS: USER
    // ==========================================
    if (pathname.startsWith("/user/")) {
        console.log("👤 Processing RetroAchievements user");

        const username = title.replace(/ · RetroAchievements$/, "");

        // RetroAchievement Points
        const pointsElement = document.querySelector(
            'article p span span.TrueRatio'
        );

        let points = "";

        if (pointsElement) {
            const pointsContainer = pointsElement.parentElement;
            points = pointsContainer.firstChild.textContent.trim();
        }

        // Last Played game
        const gameElement = document.querySelector(
            'article > div:nth-child(2) > div:nth-child(2) > div > a > p'
        );

        let game = "";

        if (gameElement) {
            const gameClone = gameElement.cloneNode(true);
            const hackTag = gameClone.querySelector(".tag");

            if (hackTag) {
                hackTag.remove();
                game = `${gameClone.textContent.trim()} [Hack]`;
            } else {
                game = gameClone.textContent.trim();
            }
        }

        // Last Played progress
        const progressElement = document.querySelector(
            'article > div:nth-child(2) > div:nth-child(2) > p.text-2xs'
        );

        let progress = "";

        if (progressElement) {
            progress = progressElement.textContent.trim();
        }

        let result = username;

        if (points) {
            result += ` - ${points} RetroAchievement Points`;
        }

        if (game) {
            result += ` - Last Played: ${game}`;
        }

        if (progress) {
            result += ` - ${progress}`;
        }

        console.log("📋 RetroAchievements result:", result);

        return result;
    }

    // ==========================================
    // OTHER RETROACHIEVEMENTS PAGES
    // ==========================================

    return window.location.href;
}

// Processes title for soliditet.no
function processSoliditetTitle(title) {
    console.log("🔵 Processing title for soliditet.no");

    function findCompanyName() {
        console.log("🔍 Searching for company name...");

        // Select the h2 that contains a 9-digit number (organization number)
        let companyElement = Array.from(document.querySelectorAll("h2")).find(el => /\b\d{9}\b/.test(el.innerText));

        if (companyElement) {
            let companyName = companyElement.innerText.trim();
            console.log("✓ Found company name:", companyName);

            // Check if the URL ends with "/nordicCompanyReport.sp"
            if (window.location.pathname.endsWith("/nordicCompanyReport.sp")) {
                console.log("🌍 Non-Norwegian company detected, replacing D-U-N-S with correct organization number...");
                return replaceDUNSWithOrgNumber(companyName);
            }

            return formatCompanyName(companyName); // Apply formatting for Norwegian companies
        }

        console.warn("⚠ Company name not found! Setting up observer...");
        observeCompanyName();
        return title; // Fallback until observer finds the company name
    }

    function replaceDUNSWithOrgNumber(companyName) {
        let orgNumber = "";
        let dunsElement = Array.from(document.querySelectorAll("li")).find(el => el.innerText.includes("D-U-N-S:"));
        let correctElement = Array.from(document.querySelectorAll("li")).find(el =>
            el.innerText.includes("Regnr:") ||
            el.innerText.includes("CVR-nr:") ||
            el.innerText.includes("Y TUNNIS:")
        );

        if (correctElement) {
            let text = correctElement.innerText;
            let match = text.match(/\d+/); // Extract digits

            if (match) {
                orgNumber = match[0];

                // Special formatting for Swedish "Regnr:"
                if (text.includes("Regnr:") && orgNumber.length === 10) {
                    orgNumber = `${orgNumber.slice(0, 6)}-${orgNumber.slice(6)}`;
                }
            }
        }

        if (dunsElement && orgNumber) {
            console.log(`🔄 Replacing D-U-N-S: with ${orgNumber}`);
            return companyName.replace(/\b\d{9}\b/, orgNumber); // Replace the D-U-N-S number with the correct one
        }

        return companyName; // Return as-is if no replacement is found
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

		// Convert to Title Case
		let formattedName = properTitleCase(companyName);

		// Ensure company suffixes remain untouched
		formattedName = fixCompanySuffixes(formattedName);

		return formattedName + (orgNumber ? " " + orgNumber : "");
	}


    return findCompanyName();
}

// ===============================
// SOLIDITET: FULL
// ===============================
function processSoliditetFull(title) {
    console.log("🟣 Processing URL alternative for soliditet.no");

    // ===============================
    // COMPANY
    // ===============================
    let companyElement = Array.from(document.querySelectorAll("h2"))
        .find(el => /\b\d{9}\b/.test(el.innerText));

    if (!companyElement) {
        console.warn("⚠ Company not found");
        return title;
    }

    let raw = companyElement.innerText.trim();

    let orgMatch = raw.match(/\b\d{9}\b/);
    let org = orgMatch ? orgMatch[0] : "";

    let name = raw.replace(/\b\d{9}\b/, "").trim();

    name = properTitleCase(name);
    name = fixCompanySuffixes(name);

		// ===============================
		// BESØKSADRESSE
		// ===============================
		let adresse = "";

		let adresseCell = Array.from(document.querySelectorAll("td"))
				.find(td => td.innerText.trim().startsWith("Besøksadresse"));

		if (adresseCell && adresseCell.nextElementSibling) {
				let raw = adresseCell.nextElementSibling.innerText;

				// Clean nbsp + extra spaces
				adresse = raw.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
		}

		// ===============================
		// OMSETNING (Regnskapsår + Sum inntekter)
		// ===============================
		let omsetning = "";
		let dl = null;
		let year = "";

		let regnskapHeader = Array.from(document.querySelectorAll("h4"))
				.find(h => h.innerText.includes("Regnskapsår"));

		if (regnskapHeader) {
				let yearMatch = regnskapHeader.innerText.match(/\b(20\d{2})\b/);
				year = yearMatch ? yearMatch[1] : "";

				// Find nearest DL after this header
				dl = regnskapHeader.nextElementSibling;

				if (dl && dl.classList.contains("key-value-rows")) {
						let dts = dl.querySelectorAll("dt");

						let inntekterDT = Array.from(dts)
								.find(dt => dt.innerText.includes("Sum"));

						if (inntekterDT && inntekterDT.nextElementSibling) {
								let rawValue = inntekterDT.nextElementSibling.innerText;

								// Remove spaces & nbsp → 6592555
								let value = rawValue.replace(/\s|\u00A0/g, "");

								if (year && value) {
										omsetning = `Omsetning ${year} - ${value};`;
								}
						}
				}
		}

		// ===============================
		// ÅRSRESULTAT
		// ===============================
		let arsresultat = "";

		if (dl) {
				let arsresultatDT = Array.from(dl.querySelectorAll("dt"))
						.find(dt => dt.innerText.includes("Årsresultat"));

				if (arsresultatDT && arsresultatDT.nextElementSibling) {
						let arsresultatLink = arsresultatDT.nextElementSibling.querySelector("a");

						if (arsresultatLink) {
								arsresultat = arsresultatLink.innerText
										.replace(/\s|\u00A0/g, "")
										.trim();
						}
				}
		}

		// ===============================
		// EGENKAPITAL
		// ===============================
		let egenkapital = "";

		if (dl) {
				let egenkapitalDT = Array.from(dl.querySelectorAll("dt"))
						.find(dt => dt.innerText.includes("Sum egenkapital"));

				if (egenkapitalDT && egenkapitalDT.nextElementSibling) {
						let egenkapitalLink = egenkapitalDT.nextElementSibling.querySelector("a");

						if (egenkapitalLink) {
								egenkapital = egenkapitalLink.innerText
										.replace(/\s|\u00A0/g, "")
										.trim();
						}
				}
		}

		// ===============================
		// RATING
		// ===============================
		let rating = "";

		let ratingEl = document.querySelector("#ratingcode");

		if (ratingEl) {
				rating = ratingEl.innerText.trim();
		}

		// ===============================
		// ANTALL ANSATTE 
		// ===============================
		let ansatte = "";

		let ansatteCell = Array.from(document.querySelectorAll("td"))
				.find(td => td.innerText.includes("Antall ansatte"));

		if (ansatteCell && ansatteCell.nextElementSibling) {
				let rawLabel = ansatteCell.innerText.trim();   // "Antall ansatte 2026"
				let rawValue = ansatteCell.nextElementSibling.innerText.trim(); // "498"

				// Extract year
				let yearMatch = rawLabel.match(/\b(20\d{2})\b/);
				let year = yearMatch ? yearMatch[1] : "";

				let value = rawValue.replace(/\s+/g, "");

				if (year) {
						ansatte = `Antall ansatte ${year} - ${value};`;
				} else {
						ansatte = `Antall ansatte - ${value};`;
				}
		}

    // ===============================
    // REGISTRERINGSDATO
    // ===============================
    let regdato = "";

    let regCell = Array.from(document.querySelectorAll("td"))
        .find(td => td.innerText.trim() === "Registreringsdato");

    if (regCell && regCell.nextElementSibling) {
        let rawDate = regCell.nextElementSibling.innerText.trim();

        // Convert DD-MM-YYYY → YYYY-MM-DD
        if (/^\d{2}-\d{2}-\d{4}$/.test(rawDate)) {
            regdato = rawDate.replace(/(\d{2})-(\d{2})-(\d{4})/, "$3-$2-$1");
        } else {
            regdato = rawDate;
        }
    }

		// ===============================
		// FACTORINGAVTALE
		// ===============================
		let factoringavtale = "None";

		let betalingserfaring = document.querySelector("#betalingserfaring");

		if (betalingserfaring) {
				let factoringTD = Array.from(betalingserfaring.querySelectorAll("td"))
						.find(td => td.innerText.trim().toUpperCase() === "FACTORINGAVT.");

				if (factoringTD) {
						let row = factoringTD.closest("tr");
						let tds = row ? row.querySelectorAll("td") : [];

						if (tds.length > 6) {
								factoringavtale = tds[6].innerText
										.replace(/\s+/g, " ")
										.trim();
						}
				}
		}

		// ===============================
		// SOLIDITET: OWNER
		// ===============================
		function processSoliditetOwner(title) {

				function cap(str) {
						return str.toLocaleLowerCase("nb-NO")
								.replace(/(^|[\s-])\S/g, l => l.toLocaleUpperCase("nb-NO"));
				}

				const section = [...document.querySelectorAll(".section")]
						.find(s => s.querySelector("h1")?.innerText.includes("Aksjon"));

				if (!section) {
						console.warn("⚠ Aksjonærer not found");
						return title;
				}

				const rows = [...section.querySelectorAll("table tbody tr")];

				return rows.map(row => {
						const tds = row.querySelectorAll("td");
						if (tds.length < 4) return null;

						let id = tds[0].innerText.trim();
						let name = tds[1].innerText.trim();
						let place = tds[2].innerText.trim();
						let share = tds[3].innerText.trim();

						// Person (date)
						if (/^\d{2}-\d{2}-\d{4}$/.test(id)) {
								id = id.replace(/(\d{2})-(\d{2})-(\d{4})/, "$3-$2-$1");

								let parts = name.split(/\s+/);
								name = [...parts.slice(1), parts[0]].map(cap).join(" ");
						} else {
								name = cap(name);
								name = fixCompanySuffixes(name);
						}

						place = cap(place.replace(/\s*-\s*/, " "));
						share = share.replace(/\s+/g, "");

						return `${id} ${name} - ${place} - ${share}`;
				}).filter(Boolean).join("; ");
		}

		// ===============================
		// SOLIDITET: BOARD
		// ===============================
		function processSoliditetBoard(title) {
			
				function cap(str) {
						return str.toLocaleLowerCase("nb-NO")
								.replace(/(^|[\s-])\S/g, l => l.toLocaleUpperCase("nb-NO"));
				}

				const section = [...document.querySelectorAll(".section")]
						.find(s => s.querySelector("h1")?.innerText.includes("Styreinformasjon"));

				if (!section) {
						console.warn("⚠ Styreinformasjon not found");
						return title;
				}

				const rows = [...section.querySelectorAll("table tbody tr")];

				return rows.map(row => {
						const tds = row.querySelectorAll("td");
						if (tds.length < 5) return null;

						let date = tds[0].innerText.trim();
						if (!/^\d{2}-\d{2}-\d{4}$/.test(date)) return null;

						date = date.replace(/(\d{2})-(\d{2})-(\d{4})/, "$3-$2-$1");

						let nameParts = tds[1].innerText.trim().split(/\s+/);
						let name = [...nameParts.slice(1), nameParts[0]].map(cap).join(" ");

						let place = tds[3].innerText.trim(); // NEW (Poststed / country)
						let role = tds[4].innerText.trim();

						return `${date} ${name} - ${place} - ${role}`;

						return `${date} ${name} - ${role}`;
				}).filter(Boolean).join("; ");
		}

    // ===============================
    // BUILD OUTPUT
    // ===============================
		let parts = [];

		// Base
		parts.push(`${name}`);
		parts.push(`${org}`);
		
		// Besøksadresse
		if (adresse) {
				parts.push(`Besøksadresse: ${adresse}`);
		}
		
		// Omsetning
		if (omsetning) {
				// convert from "Omsetning 2024 - 6592555;" → new format
				let match = omsetning.match(/(\d{4}).*?(\d+)/);
				if (match) {
						parts.push(`Omsetning (${match[1]}): ${match[2]}`);
				}
		}

		// Årsresultat
		if (arsresultat) {
				parts.push(`Årsresultat (${year}): ${arsresultat}`);
		}

		// Egenkapital
		if (egenkapital) {
				parts.push(`Egenkapital (${year}): ${egenkapital}`);
		}
				
		// Rating
		if (rating) {
				parts.push(`Rating: ${rating}`);
		}

		// Ansatte
		if (ansatte) {
				// convert from "Antall ansatte 2026 - 498;"
				let match = ansatte.match(/(\d{4}).*?(\d+)/);
				if (match) {
						parts.push(`Antall ansatte (${match[1]}): ${match[2]}`);
				}
		}

		// Registreringsdato
		if (regdato) {
				parts.push(`Registreringsdato: ${regdato}`);
		}

		// Factoringavtale
		parts.push(`Factoringavtale: ${factoringavtale}`);

		// Aksjonærer
		let owners = processSoliditetOwner(title);
		if (owners && owners !== title) {
				parts.push(`Aksjonærer: ${owners}`);
		}

		// Styreinformasjon
		let board = processSoliditetBoard(title);
		if (board && board !== title) {
				parts.push(`Styreinformasjon: ${board}`);
		}

		// Join with semicolon + space
		let result = parts.join("; ") + ";";

		return result;
}


// Processes title for Spotify pages
function processSpotifyTitle(title) {
    console.log("🔵 Processing title for Spotify");

    // Remove trailing " | Spotify"
    title = title.replace(/\s*\|\s*Spotify$/, "").trim();

    // Remove "song and lyrics by " (case-insensitive)
    title = title.replace(/song and lyrics by /i, "");

    // Handle album formatting: "Album Title - Album by Artist" → "Artist – Album Title"
    const albumMatch = title.match(/^(.*?) - Album by (.*)$/i);
    if (albumMatch) {
        const album = albumMatch[1].trim();
        const artist = albumMatch[2].trim();
        title = `${artist} - ${album}`;
    }

    // Replace " • " with " - "
    title = title.replace(/ • /g, " - ");

    console.log("📋 Formatted Spotify title:", title);
    return title;
}

// Processes title for Twitch pages by extracting the streamer's username
function processTwitchTitle(title) {
    console.log("🔵 Processing title for Twitch");

    // Try to extract the streamer’s username from an <h1> element
    const h1 = document.querySelector("h1");
    if (h1 && h1.innerText.trim()) {
        const username = h1.innerText.trim();
        console.log("📋 Extracted Twitch username from <h1>:", username);
        return `${username}`;
    }

    console.warn("⚠ No <h1> username found on Twitch page.");
    return processGenericTitle(title); // Fallback if nothing is found
}

const TWITCH_MESSAGES = {
    "/xqc": "xqcLL I ENJOYED MY STAY xqcLL I ENJOYED MY STAY xqcLL I ENJOYED MY STAY xqcLL I ENJOYED MY STAY xqcLL",
    "/ludwig": "ludwigPRIMECHECK",
    "/squeex": "CUM Clap",
    "/maya": "peepoPog WOW",
    "/forsen": "forsenE",
    "/erobb221": "LMAOOOOOOOOOO",
    default: "peepoHappy",
};

// Placeholder for Twitch's custom URL command
function processTwitchMessage() {
    console.log("🟣 Processing URL alternative for Twitch");

    const pathname = window.location.pathname.toLowerCase();
    const matchingChannel = Object.keys(TWITCH_MESSAGES).find(
        channel => channel !== "default" && pathname.includes(channel)
    );

    return matchingChannel
        ? TWITCH_MESSAGES[matchingChannel]
        : TWITCH_MESSAGES.default;
}

// Processes title for Twitter pages
function processTwitterTitle(title) {
    console.log("🔵 Processing title for Twitter");

    // Check if the title contains an @username
    const usernameMatch = title.match(/@\w+/);
    if (usernameMatch) {
        console.log("📋 Extracted Twitter username:", usernameMatch[0]);
        return usernameMatch[0]; // Return the extracted @username
    }

    // If no @username is found, process as a generic title
    return processGenericTitle(title);
}

// Processes title for YouTube videos
function processYouTubeTitle(title) {
    console.log("🔵 Processing title for YouTube");

    // Remove notification count (e.g., "(1) Video Title - YouTube")
    title = title.replace(/^\(\d+\)\s*/, ""); // Removes "(X) " at the start

    // Remove "- YouTube" from the end
    title = title.replace(/ - YouTube$/, "").trim();

    // Remove anything after " (" or " [" (but not the entire title!)
    title = title.split(/ \[|\(/)[0].trim();

    // Apply proper title case
    let formattedTitle = properTitleCase(title);

    // Ensure capitalization of the first word after " - "
    formattedTitle = formattedTitle.replace(/ - (\w)/g, (_, firstLetter) => ` - ${firstLetter.toUpperCase()}`);

    console.log("📋 Formatted Title:", formattedTitle);
    return formattedTitle;
}

// Processes generic page titles (default behavior)
function processGenericTitle(title) {
    console.log("🔵 Processing generic title");

    // Remove notification count (e.g., "(1) Page Title")
    title = title.replace(/^\(\d+\)\s*/, ""); // Removes "(X) " at the start

    // Remove common separators
    let cleanTitle = title.split(/ - | – | — | : | :: | \| | · /)[0].trim();

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

    console.log("📋 Formatted Title:", cleanTitle);
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

// Video file identifiers
const videoIdentifiers = [
  // Resolution / Quality
  "2160p","1440p","1080p","1080i","720p","576p","480p","360p",
  "4K","8K","HDR","SDR","DV","DoVi","DolbyVision",
  "BluRay","BRRip","BDRip","BDREMUX","REMUX", "AMZN",
  "WEB-DL","WEBRip","HDTV","DVDRip","CAM","TS","TC","SCR","R5",

  // Codecs / Formats
  "x264","x265","H 264","H 265","HEVC","AVC","XviD","DivX","AV1",
  "MP4","MKV","AVI","AAC","AC3","DTS","TrueHD","Atmos","FLAC","DDP",
	"5 1", "7 1",
];

function looksLikeVideo(title) {
  return videoIdentifiers.some(id =>
    new RegExp(`\\b${id}\\b`, "i").test(title)
  );
}

// Utility function to fix company suffixes without altering the main company name
function fixCompanySuffixes(companyName) {
    const suffixes = new Set([
        "AS", "ASA", "DA", "ANS", "ENK", "NUF", "IKS", "KF", "STI", "EK", "BA", "SE", "PK",
        "AB", "HB", "KB", "A/S", "ApS", "IVS", "P/S", "K/S", "I/S", "FMBA", "SMBA", "OYJ",
        "AG", "GMBH", "SA", "SAS", "SARL", "SCA", "SCRL", "SNC", "SL", "UAB", "BV", "NV",
        "BHD", "PLC"
    ]);

    let words = companyName.split(" ");
    if (words.length > 1) {
        let lastWord = words[words.length - 1];

        // If the last word is a recognized suffix, ensure it is in uppercase
        if (suffixes.has(lastWord.toUpperCase())) {
            words[words.length - 1] = lastWord.toUpperCase();
            return words.join(" "); // Preserve original formatting of other words
        }
    }
    
    return companyName; // Return unchanged if no suffix is found
}

// ============================================================
// Converts text to Title Case
// ============================================================
function properTitleCase(text) {
    if (!text) {
        return text;
    }

    // ============================================================
    // Capitalization overrides
    // ============================================================

    const capitalizationOverrides = new Set([
        // Apple
        "iPhone", "iPad", "iPod", "iMac", "MacBook", "macOS", "iOS",
        "iPadOS", "watchOS", "tvOS", "AirPods", "AirTag", "CarPlay",
        "FaceTime", "iMessage", "ApplePay",

        // Microsoft / Google / Amazon
        "OneDrive", "OneNote", "PowerBI", "PowerShell", "MS-DOS",
        "YouTube", "ChromeOS", "Wear OS",

        // AI / software / development
        "OpenAI", "ChatGPT", "PyPI", "PyTorch", "TensorFlow", "NumPy",
        "SciPy", "pandas", "Matplotlib", "Jupyter", "JupyterLab",
        "IPython", "FastAPI", "Next.js", "Node.js", "Express.js",
        "Vue.js", "Nuxt.js", "TypeScript", "VBScript", "GitHub", "GitLab",

        // Services / platforms
        "eBay", "PayPal", "WhatsApp", "LinkedIn", "TikTok",

        // Technology
        "WiFi", "Wi-Fi", "AirPlay", "AirDrop", "USB-C", "WebGL",
        "WebGPU", "WebAssembly", "OpenGL", "OpenCL", "DirectX",
        "OpenVPN", "WireGuard", "CloudFront", "PostgreSQL", "MySQL",
        "MariaDB", "MongoDB", "SQLite", "Neo4j", "GraphQL",
        "WebSocket", "OAuth", "OpenID",

        // Video / media formats and codecs
        "DoVi", "DolbyVision", "BluRay", "BRRip", "BDRip", "WEB-DL",
        "WEBRip", "DVDRip", "TrueHD", "XviD", "DivX",

        // Video resolutions
        "144p", "240p", "360p", "480p", "576p", "720p", "900p",
        "1080p", "1080i", "1200p", "1440p", "1600p", "1800p",
        "2160p", "4320p",

        // Other mixed / irregular capitalization
        "McDonald's", "McCafe", "McFlurry", "eBook", "eBooks",
        "eCommerce", "eMail", "eLearning", "iCloud", "iTunes",
        "iWork", "iMovie", "iBooks", "QuickBooks", "QuickTime",
        "BitLocker", "TrueType", "OpenType", "FreeType", "GameBoy",
        "GameCube", "GamePass", "DualSense", "GeForce"
    ]);

    // ============================================================
    // Small words
    // ============================================================

    const smallWords = new Set([
        // English
        "a", "an", "the", "and", "but", "or", "nor", "for", "so", "yet",
        "at", "by", "in", "of", "on", "to", "up", "with", "as", "if",
        "is", "it", "than", "that", "via", "from", "over", "under",
        "into", "onto",

        // Norwegian / Danish / Swedish
        "og", "av", "til", "på", "med", "for", "om", "mot", "uten",
        "etter", "mellom", "under", "over", "ved", "fra", "inn",
        "ut", "som", "hvis",

        // German
        "und", "von", "zum", "zur", "im", "am", "an", "auf", "bei",
        "durch", "mit", "ohne", "über", "unter", "vor", "nach",
        "gegen", "aus", "zwischen",

        // French
        "et", "de", "du", "des", "le", "la", "les", "à", "au", "aux",
        "en", "sur", "dans", "par", "pour", "sans", "avec", "chez",
        "sous", "contre", "vers",

        // Spanish
        "y", "de", "del", "la", "las", "el", "los", "a", "al", "por",
        "para", "con", "sin", "sobre", "entre", "hacia", "según",
        "tras", "desde",

        // Dutch
        "en", "van", "het", "de", "een", "op", "aan", "uit", "bij",
        "tot", "om", "naar", "met", "over", "onder", "voor", "tussen"
    ]);

    // ============================================================
    // Known acronyms / uppercase words
    // ============================================================

    const bigWords = new Set([
        "ABBA", "AC/DC", "AI", "AMD", "AMZN", "ATM", "AV1", "AVC",
        "BBC", "BDREMUX", "BTS", "CAM", "CEO", "DNA", "DV", "ETA",
        "FBI", "GDP", "GPU", "HDR", "HDTV", "HEVC", "IBM", "IKEA",
        "IRS", "KFC", "LCD", "LOL", "NASA", "NBA", "NFL", "OMG",
        "PDF", "R5", "RAM", "REMUX", "RIP", "SDR", "SCR", "TC",
        "TS", "UN", "USA", "USB", "VIP", "VPN", "WTF"
    ]);

    // ============================================================
    // Company suffixes
    // ============================================================

    const companySuffixes = new Set([
        "AS", "ASA", "DA", "ANS", "ENK", "NUF", "IKS", "KF", "STI",
        "EK", "BA", "SE", "PK", "AB", "HB", "KB", "A/S", "ApS",
        "IVS", "P/S", "K/S", "I/S", "FMBA", "SMBA", "OYJ", "AG",
        "GMBH", "SA", "SAS", "SARL", "SCA", "SCRL", "SNC", "SL",
        "UAB", "BV", "NV", "BHD", "PLC"
    ]);

    // ============================================================
    // Build case-insensitive lookup tables
    // ============================================================

    const overrideLookup = new Map();

    for (const value of capitalizationOverrides) {
        overrideLookup.set(value.toLowerCase(), value);
    }

    const suffixLookup = new Map();

    for (const value of companySuffixes) {
        suffixLookup.set(value.toLowerCase(), value);
    }

    // ============================================================
    // Whole-text capitalization override
    // ============================================================

    const wholeOverride =
        overrideLookup.get(text.trim().toLowerCase());

    if (wholeOverride) {
        return wholeOverride;
    }

    // ============================================================
    // Tokenize without destroying punctuation or whitespace
    //
    // IMPORTANT:
    // Use Unicode property escapes instead of \W/\w so that
    // Norwegian characters such as Æ, Ø and Å remain part of
    // the same word.
    // ============================================================

    const tokens = text.match(
        /https?:\/\/\S+|www\.\S+|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|\s+|./gu
    ) || [];

    const result = [];
    let capitalizeNext = true;

    // ============================================================
    // Process tokens
    // ============================================================

    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
        const token = tokens[tokenIndex];

        // --------------------------------------------------------
        // Preserve whitespace exactly
        // --------------------------------------------------------

        if (/^\s+$/u.test(token)) {
            result.push(token);
            continue;
        }

        // --------------------------------------------------------
        // Preserve URLs while normalizing their case
        // --------------------------------------------------------

        if (/^https?:\/\/\S+$|^www\.\S+$/i.test(token)) {
            result.push(token.toLowerCase());
            capitalizeNext = false;
            continue;
        }

        // --------------------------------------------------------
        // Preserve email structure
        // --------------------------------------------------------

        if (/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(token)) {
            let [localPart, domainPart] = token.split("@");

            const localPartIsUpper =
                /[A-Z]/.test(localPart) &&
                !/[a-z]/.test(localPart);

            const localPartIsInitialUpperRestLower =
                /^[A-Z]/.test(localPart) &&
                /[a-z]/.test(localPart.slice(1)) &&
                localPart.slice(1) === localPart.slice(1).toLowerCase();

            if (
                localPartIsUpper ||
                localPartIsInitialUpperRestLower
            ) {
                localPart = localPart.toLowerCase();
            }

            result.push(
                localPart + "@" + domainPart.toLowerCase()
            );

            capitalizeNext = false;
            continue;
        }

        // --------------------------------------------------------
        // Preserve punctuation
        // --------------------------------------------------------

        if (!/[\p{L}\p{N}]/u.test(token)) {
            result.push(token);

            if (/^[-–—:;([<{#]$/.test(token)) {
                capitalizeNext = true;
            }

            continue;
        }

        const lookupValue = token.toLowerCase();

        // --------------------------------------------------------
        // Apply capitalization overrides
        // --------------------------------------------------------

        const overrideValue = overrideLookup.get(lookupValue);

        if (overrideValue) {
            result.push(overrideValue);
            capitalizeNext = false;
            continue;
        }

        // --------------------------------------------------------
        // Company suffix handling
        // --------------------------------------------------------

        const suffixValue = suffixLookup.get(lookupValue);

        if (suffixValue) {
            const followingTokens = tokens.slice(tokenIndex + 1);

            const suffixBeforeSemicolon =
                followingTokens.length >= 2 &&
                followingTokens[0] === ";" &&
                /^\s+$/u.test(followingTokens[1]);

            let suffixPrecedesNumber = false;

            if (!suffixBeforeSemicolon) {
                let i = 0;

                // Allow whitespace after suffix
                while (
                    i < followingTokens.length &&
                    /^\s+$/u.test(followingTokens[i])
                ) {
                    i++;
                }

                // Allow -, _, or / as separator
                if (
                    i < followingTokens.length &&
                    ["-", "_", "/"].includes(followingTokens[i])
                ) {
                    i++;

                    // Allow whitespace after separator
                    while (
                        i < followingTokens.length &&
                        /^\s+$/u.test(followingTokens[i])
                    ) {
                        i++;
                    }
                }

                // Require 6+ digits
                if (i < followingTokens.length) {
                    suffixPrecedesNumber =
                        /^\d{6,}$/.test(followingTokens[i]);
                }
            }

            if (
                suffixBeforeSemicolon ||
                suffixPrecedesNumber
            ) {
                result.push(suffixValue);
                capitalizeNext = false;
                continue;
            }
        }

        // --------------------------------------------------------
        // Preserve known acronyms
        // --------------------------------------------------------

        if (bigWords.has(token.toUpperCase())) {
            result.push(token.toUpperCase());
            capitalizeNext = false;
            continue;
        }

        // --------------------------------------------------------
        // Preserve numbers
        // --------------------------------------------------------

        if (/^\d+$/u.test(token)) {
            result.push(token);
            capitalizeNext = false;
            continue;
        }

        // --------------------------------------------------------
        // Preserve underscore-connected and period-connected values
        // --------------------------------------------------------

        if (/^[A-Za-z0-9]+(?:[_.][A-Za-z0-9]+)+$/.test(token)) {
            result.push(token.toLowerCase());
            capitalizeNext = false;
            continue;
        }

        // ========================================================
        // Format ordinary words and apostrophe-connected words
        // ========================================================

        const apostropheCharacter =
            token.includes("’") ? "’" : "'";

        const normalizedToken = token
            .replace(/’/g, apostropheCharacter)
            .replace(/'/g, apostropheCharacter);

        const apostropheParts =
            normalizedToken.split(apostropheCharacter);

        const formattedParts = [];

        for (
            let partIndex = 0;
            partIndex < apostropheParts.length;
            partIndex++
        ) {
            const part = apostropheParts[partIndex];

            if (!part) {
                formattedParts.push(part);
                continue;
            }

            const lowerPart = part.toLowerCase();

            const shouldCapitalize =
                capitalizeNext ||
                partIndex > 0 ||
                !smallWords.has(lowerPart);

            if (shouldCapitalize) {
                // Capitalize only the first Unicode alphabetic character.
                const formattedPart = lowerPart.replace(
                    /\p{L}/u,
                    match => match.toUpperCase()
                );

                formattedParts.push(formattedPart);
            } else {
                formattedParts.push(lowerPart);
            }
        }

        result.push(
            formattedParts.join(apostropheCharacter)
        );

        capitalizeNext = false;
    }

    return result.join("");
}

function getLinkTitle(title, formattedTitle) {
    if (window.location.hostname.includes("theporndb.net")) {
        return (
            title
                .split(/ :: /)[0]
                .split(/\s*\/\s*/)[1]
                ?.trim() || title
        );
    }

    return formattedTitle;
}

// Listen for message to copy the title
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

browserAPI.runtime.onMessage.addListener((message) => {
    console.log("📩 Message received in content.js:", message);

    const url = window.location.href;
    let copyText;

    if (message.action === "copyUrl") {
        const siteUrlHandler = getSiteUrlHandler();
        copyText = siteUrlHandler
            ? siteUrlHandler(document.title)
            : url;
    } else {
        const title = document.title;
        const siteHandler = getSiteHandler();
        const formattedTitle = siteHandler(title);

        // One shared title for all link-style outputs.
        const linkTitle = getLinkTitle(title, formattedTitle);
        copyText = formattedTitle;

        if (message.action === "copyTitle") {
            copyText = formattedTitle;
        } else if (message.action === "copyTitleWithUrl") {
            copyText = `${linkTitle} ${url}`;
        } else if (message.action === "copyMarkdown") {
            copyText = `[${linkTitle}](${url})`;
        } else if (message.action === "copyBBCode") {
            copyText = `[url=${url}]${linkTitle}[/url]`;
        } else if (message.action === "copyHTML") {
            const escapeHTML = (text) =>
                text
                    .replace(/&/g, "&amp;")
                    .replace(/"/g, "&quot;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");

            copyText =
                `<a href="${escapeHTML(url)}">${escapeHTML(linkTitle)}</a>`;
        } else if (message.action === "copyRawTitle") {
            copyText = title;
        }
    }

    try {
        browserAPI.runtime.sendMessage({
            action: "copyToClipboard",
            text: copyText
        });
    } catch (e) {
        console.error("❌ Failed to copy:", e);
        copyToClipboard(copyText);
    }
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
    chrome.runtime.sendMessage({ action: "copyToClipboard", text: formattedTitle });
  } catch (e) {
    console.error("❌ Failed to copy title:", e);
    copyToClipboard(formattedTitle);
  }
}
})();