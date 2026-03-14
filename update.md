

---

## **Project Overview**

The goal is to build a Firefox browser extension that passively monitors a user's activity on `leetcode.com`. Upon detecting a successful problem submission ("Accepted"), the extension will automatically scrape the problem's metadata and seamlessly hand it off to the Algo-Track web application (Next.js) via URL parameters to which should show a popup on the page asking to save the probelm or not, when clicked on save, the problem shpuld be loaded into the add new card automatically and then saved into a Supabase database.

## **Tech Stack**

* **Browser Extension:** Vanilla JavaScript, HTML/CSS, Firefox WebExtensions API (Manifest V3). *Note: Vanilla JS is preferred here to avoid complex build steps (like Webpack) for a lightweight content script.*
* **Web Application:** Next.js (App Router), React, Tailwind CSS.
* **Database:** PostgreSQL (via Supabase).

---

## **Architecture & Data Flow**

The system is decoupled. The extension never communicates directly with the database or secure API routes. This prevents the need to manage authentication tokens inside the browser extension. Instead, the extension acts purely as a data formatter and forwards the user to the web app's authenticated environment.

### **Phase 1: The Observer (Firefox Extension)**

The extension relies on a Content Script injected into `https://leetcode.com/problems/*`.

1. **MutationObserver:** Because LeetCode is a Single Page Application (SPA), the page does not reload upon code submission. The content script initializes a `MutationObserver` to watch the DOM node where execution results render.
2. **Detection:** The observer specifically looks for the DOM update that injects the "Accepted" text with the associated green success styling.
3. **Debouncing:** To prevent multiple triggers from a single DOM repaint, the observer uses a debounce function so the scraping logic fires exactly once per successful submission.

### **Phase 2: The Scraper (Firefox Extension)**

Once triggered, the content script extracts the required data using standard DOM selectors.

* **URL:** Extracted via `window.location.href`.
* **Title:** Extracted by querying the main problem title `<h1>` or standard LeetCode header class (e.g., stripping the "1. " from "1. Two Sum").
* **Difficulty:** Extracted by querying the difficulty badge (filtering for text content "Easy", "Medium", or "Hard").
* **Tags:** Extracted by expanding the "Related Topics" accordion (if necessary via simulated click or direct DOM read) and mapping the text content of the tag pills into an array.

### **Phase 3: The User Prompt (Firefox Extension)**

The extension creates a custom HTML overlay and injects it into the LeetCode DOM.

1. **UI Injection:** A fixed, floating card appears in the bottom-right corner.
2. **Interaction:** It displays the scraped title and asks: *"Log to Algo-Track?"*
3. **Actions:**
* **Dismiss:** Removes the node from the DOM.
* **Save:** Triggers the Handoff protocol.



### **Phase 4: The Handoff (Communication Protocol)**

If the user clicks "Save", the extension packages the data and sends it to the Next.js app.

1. **Encoding:** The scraped data (Title, URL, Difficulty, Tags) is serialized into a URL Query String using `URLSearchParams`.
2. **Redirection:** The extension uses the `browser.tabs.create()` API to open a new tab pointing directly to the Algo-Track "Add Card" route.
* *Example Payload:* `https://algotrack.vercel.app/add?title=Two+Sum&url=leetcode.com/problems/two-sum&difficulty=Easy&tags=Array,Hash+Table`



### **Phase 5: The Receiver (Next.js Application)**

The web application handles the data ingestion, authentication, and database insertion.

1. **URL Parsing:** The `/add` page in Next.js uses the `useSearchParams` hook (from `next/navigation`) to read the incoming URL parameters on load.
2. **State Population:** The React component maps these search parameters to the `defaultValue` of the respective input fields in the "New Flashcard" form.
3. **User Verification:** The user sees the form pre-filled. They can append personal notes, adjust tags, or write a custom description.
4. **Database Push:** Upon submitting the form, the Next.js frontend sends a POST request to the internal `/api/cards` route, which handles the secure Supabase insertion using the active user's session ID.

---

## **Security & Edge Cases**

* **No Auth in Extension:** By passing data via URL to an authenticated Next.js route, the extension requires zero login logic. If an unauthenticated user triggers the extension, Next.js simply intercepts the request at the `/add` route, redirects them to the login page, and (ideally) preserves the callback URL so the data isn't lost post-login.
* **DOM Fragility:** LeetCode frequently updates its UI. The DOM selectors in Phase 2 are the most fragile part of the system. They should be isolated in a configuration object within the extension so they can be easily updated without rewriting core logic.

Would you like me to draft the actual `manifest.json` and the vanilla JavaScript `content_script.js` so you can load the local add-on into Firefox and test the LeetCode scraper right now?



---




