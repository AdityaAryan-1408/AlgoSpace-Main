/* ============================================================
   AlgoTrack — LeetCode Capture Extension
   Content script injected on https://leetcode.com/problems/*
   ============================================================ */

// ── Configuration ────────────────────────────────────────────
// Change this to your production URL when deployed.
const ALGOTRACK_BASE_URL = "https://algo-space-main.vercel.app";

// DOM selectors — update these if LeetCode changes their UI.
const SELECTORS = {
    // The container where submission results appear
    resultContainer: '[data-e2e-locator="submission-result"]',
    // Problem title: link to the problem within the description panel
    titleLink: 'a[href*="/problems/"]',
    // Difficulty badge classes used by LeetCode
    difficultyEasy: 'div.text-difficulty-easy',
    difficultyMedium: 'div.text-difficulty-medium',
    difficultyHard: 'div.text-difficulty-hard',
    // Tags: links to /tag/* pages
    tagLinks: 'a[href^="/tag/"]',
};

// ── State ────────────────────────────────────────────────────
let promptVisible = false;
const promptedUrls = new Set(); // Track URLs already prompted to prevent re-showing

// ── Main: MutationObserver ───────────────────────────────────
function init() {
    // Observe the entire body for deep DOM changes (LeetCode is an SPA)
    const observer = new MutationObserver(debounce(onDomChange, 1000));
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
    });
    console.log("[AlgoTrack] Content script loaded. Observing for submissions…");
}

function onDomChange() {
    if (promptVisible) return;

    // Only trigger once per problem URL
    const currentUrl = window.location.href.split("?")[0];
    if (promptedUrls.has(currentUrl)) return;

    // Look for "Accepted" in the submission result area
    const resultEl = document.querySelector(SELECTORS.resultContainer);
    if (!resultEl) return;

    const text = resultEl.textContent || "";
    if (!text.includes("Accepted")) return;

    // Mark this URL as prompted so it won't trigger again
    promptedUrls.add(currentUrl);
    console.log("[AlgoTrack] Accepted submission detected!");

    // Scrape and prompt
    const data = scrapeData();
    showPrompt(data);
}

// ── Scraper ──────────────────────────────────────────────────
function scrapeData() {
    const url = window.location.href.split("?")[0]; // Clean URL without query params
    const title = scrapeTitle();
    const difficulty = scrapeDifficulty();
    const tags = scrapeTags();

    console.log("[AlgoTrack] Scraped:", { title, url, difficulty, tags });
    return { title, url, difficulty, tags };
}

function scrapeTitle() {
    // Extract the problem slug from the URL (most reliable source)
    const pathParts = window.location.pathname.split("/problems/");
    const rawSlug = pathParts[1] || "";
    const slug = rawSlug.replace(/\/.*$/, ""); // "koko-eating-bananas"

    // Try to find the numbered title from the page by looking for links
    // pointing specifically to THIS problem (not any /problems/ link)
    if (slug) {
        const links = document.querySelectorAll(`a[href*="/problems/${slug}"]`);
        for (const link of links) {
            const text = (link.textContent || "").trim();
            // Match "875. Koko Eating Bananas" pattern — number + dot + title
            if (/^\d+\.\s+\S/.test(text) && text.length < 200) {
                return text; // Keep the full title with number, e.g. "875. Koko Eating Bananas"
            }
        }

        // Fallback: convert slug to title case
        return slug
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
    }

    return "Unknown Problem";
}

function scrapeDifficulty() {
    // Check for LeetCode's specific difficulty classes
    if (document.querySelector(SELECTORS.difficultyEasy)) return "easy";
    if (document.querySelector(SELECTORS.difficultyMedium)) return "medium";
    if (document.querySelector(SELECTORS.difficultyHard)) return "hard";
    return "medium"; // Default
}

function scrapeTags() {
    const tags = [];
    const tagLinks = document.querySelectorAll(SELECTORS.tagLinks);

    for (const link of tagLinks) {
        const text = (link.textContent || "").trim();
        if (text && !tags.includes(text) && text.length < 50) {
            tags.push(text);
        }
    }

    return tags;
}

// ── Prompt UI ────────────────────────────────────────────────
function showPrompt(data) {
    promptVisible = true;

    // Create overlay container
    const overlay = document.createElement("div");
    overlay.id = "algotrack-prompt";
    overlay.innerHTML = `
    <div class="algotrack-card">
      <div class="algotrack-header">
        <div class="algotrack-logo">A</div>
        <span class="algotrack-brand">AlgoTrack</span>
      </div>
      <div class="algotrack-body">
        <p class="algotrack-title-label">Problem Accepted ✓</p>
        <p class="algotrack-problem-name">${escapeHtml(data.title)}</p>
        <p class="algotrack-difficulty ${data.difficulty}">${capitalize(data.difficulty)}</p>
        ${data.tags.length > 0 ? `<p class="algotrack-tags">${data.tags.map((t) => `<span class="algotrack-tag">${escapeHtml(t)}</span>`).join("")}</p>` : ""}
        <p class="algotrack-question">Log to AlgoTrack?</p>
      </div>
      <div class="algotrack-actions">
        <button class="algotrack-btn algotrack-btn-dismiss" id="algotrack-dismiss">Dismiss</button>
        <button class="algotrack-btn algotrack-btn-save" id="algotrack-save">Save →</button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    // Event handlers
    document
        .getElementById("algotrack-dismiss")
        .addEventListener("click", () => {
            overlay.remove();
            promptVisible = false;
        });

    document.getElementById("algotrack-save").addEventListener("click", () => {
        const params = new URLSearchParams({
            title: data.title,
            url: data.url,
            difficulty: data.difficulty,
            tags: data.tags.join(","),
        });

        const targetUrl = `${ALGOTRACK_BASE_URL}/add?${params.toString()}`;
        window.open(targetUrl, "_blank");

        overlay.remove();
        promptVisible = false;
    });

    // Auto-dismiss after 30 seconds
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.remove();
            promptVisible = false;
        }
    }, 30000);
}

// ── Utilities ────────────────────────────────────────────────
function debounce(fn, ms) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Initialize ───────────────────────────────────────────────
init();
