Remaining features: **11**

**Integrations (4)**
1. Import from NeetCode/Grind 75 (bulk import lists). Also add a lists feeature to the problem saving card, so that each problem has a list attached to it and in the dashboard can be filtered using that list.
2. Ditched, see below for newer implmentation
3. Chrome extension (port Firefox extension)
4. LeetCode contest tracker (auto-log contest problems)

**UX Polish (4)**
1. Keyboard shortcuts (`N`, `R`, `1/2/3/4`, etc.)
2. Bulk operations (multi-select + batch delete/tag)
3. Search & filter (title/difficulty/tag/status)
4. Export/backup (JSON/CSV download)
5. Instead of having 3 fields for 

**Motivation (3)**
1. Daily goal (e.g., review 5 cards/day with progress bar)
2. Achievement badges (milestones like first 100 cards, 30-day streak)
3. Problem count widget (easy/medium/hard solved counts)



---

### **The Pivot: Why We Are Ditching Gists**

Initially, GitHub Gists sound like a quick way to store code snippets. However, Gists are isolated, folder-less text fragments that float outside of your main GitHub profile.

Because you already have an established, beautifully organized repository (`DSA-GIT`), using Gists would actually be a downgrade. It would fragment your portfolio. By directly integrating with your existing repository, we achieve three things:

1. **Zero Context Switching:** You keep all your months of historical data and new automated data in one single, organized `/Solutions` folder.
2. **The "Green Squares" Effect:** Every flashcard saved automatically registers as a real commit on your main GitHub contribution graph.
3. **Future-Proofing:** If you ever want to bulk-download, analyze, or migrate your solutions, a standard Git repository is infinitely easier to manage than hundreds of disconnected Gists.

---

### **The Implementation Guide: Direct Repo Integration**

This setup moves the heavy lifting from a local PowerShell script to your Next.js backend. The browser extension scrapes the data, your Next.js frontend catches it, and your Next.js API acts as the Git client.

#### **1. The Prerequisites (Security & Access)**

Since your Next.js app needs permission to push code to your GitHub account on your behalf, you need a secure key.

* **Generate a PAT:** You will create a GitHub Personal Access Token (Fine-grained is best) with strictly `Contents: Write` access scoped *only* to the `DSA-GIT` repository.
* **Environment Variables:** You will store this token safely in your `.env.local` file (e.g., `GITHUB_ACCESS_TOKEN=github_pat_123...`).

#### **2. The Next.js API Flow (The Core Logic)**

When you hit "Submit" on a new flashcard in AlgoSpace, your Next.js frontend will send the problem title, platform, and your C++ code to a new backend route (e.g., `/api/github/sync`). Here is exactly what that route does:

* **Step A: Dynamic File Naming:** The backend will dynamically generate a file name that perfectly matches your existing convention. It will grab the current date, the platform, and format the scraped title.
* *Input:* Date: `Mar 8, 2026`, Platform: `LeetCode`, Title: `Two Sum`
* *Output Output:* `2026-03-08_LeetCode_Two_Sum.cpp`


* **Step B: Base64 Encoding:**
The GitHub REST API requires all file content to be converted into Base64 format before transmission. Your Next.js app will encode your C++ solution string into Base64.
* **Step C: The API PUT Request:**
Your backend will use the native `fetch` API (or the `@octokit/rest` package) to make a secure `PUT` request to GitHub's repository contents endpoint:
`PUT https://api.github.com/repos/AdityaAryan-1408/DSA-GIT/contents/Solutions/2026-03-08_LeetCode_Two_Sum.cpp`
* The payload will include the Base64 code, a commit message (e.g., `"Solved LeetCode: Two Sum [Array, Hash Table]"`), and your PAT in the authorization header.



#### **3. The Database Update (Supabase)**

Right now, your database is set up to store the entire code block inside the `back_content` column.

With this integration, GitHub takes over the storage. When the GitHub API successfully creates the file, it returns a JSON response containing the `download_url` (the raw URL to your code).

* Instead of saving a massive text string, your Next.js app simply saves that raw GitHub URL into your Supabase `cards` table.
* When you study a flashcard, AlgoSpace fetches that URL and renders the live, syntax-highlighted code directly from your repository.

---

This completely automates your current workflow. The extension scrapes the problem, you paste the solution, and hitting "Save" updates your database and pushes a commit to GitHub simultaneously.



### How to Implement AI_Agent code check (The Architecture)

To build this without breaking your current setup, you would add a new layer to your Next.js application:

**1. The Code Editor UI**
Instead of just showing the front of the card and a "Show Answer" button, the review screen would render a real code editor. You can easily drop in a library like `@monaco-editor/react` (which is the exact same engine that powers VS Code). It gives you syntax highlighting, auto-close brackets, and a professional feel right in your browser.

**2. The Evaluation API Route**
When you hit "Submit Attempt", your Next.js frontend sends a payload to a new API route (e.g., `/api/evaluate`). This payload contains:

* Your newly typed code.
* The "Back Content" (your saved, correct solution from the database).
* The problem description/title.

**3. The AI "Tutor" Prompt (The Brains)**
Your API route forwards that payload to an LLM (like Gemini, OpenAI, or Claude). The secret sauce here is the **System Prompt**. You don't just ask the AI if it's right; you instruct it to act as an interviewer.

* *Example Prompt logic:* "You are a strict technical interviewer. Compare the User's Code against the Optimal Code. Do not rewrite the code for them. Point out logical flaws, syntax errors, or missed edge cases. Finally, output a JSON object with a 'feedback' string and a 'suggested_rating' (AGAIN, HARD, GOOD, or EASY)."

**4. The Auto-Grading Handoff**
The AI responds with its critique. Your app displays this feedback to you. If the AI determines your code was perfectly optimal, it can automatically trigger the "EASY" or "GOOD" database update for your Spaced Repetition System (SRS), saving you from having to grade yourself.

---

### What Other Features It Should Have

If you are building an AI-powered code reviewer, you should absolutely take advantage of what the AI can see. Here are the features that would make this elite:

* **Language-Agnostic Comparison:** You might have saved the original solution in C++, but today you want to practice it in JavaScript. The AI doesn't care; it compares the *underlying algorithmic logic* (like checking if you successfully implemented the sliding window), not just the syntax.
* **Progressive Hint System:** If you are staring at a blank screen, you shouldn't have to look at the entire answer. You could add a "Get a Hint" button. It sends your *current* blank/partial code to the AI and asks for a nudge without revealing the whole solution.
* **Big-O Complexity Analysis:** The AI should explicitly tell you: *"Your logic is correct and will pass, but your approach is $O(N^2)$ because of the nested loop. The optimal solution saved in your database is $O(N)$ using a Hash Map."*
* **"Nitpick Mode" Toggle:** You could have a settings toggle for how strict the AI is.
* *Relaxed:* Accepts pseudocode or code with minor syntax errors as long as the logic is sound.
* *Strict:* Fails your attempt if you missed a semicolon or didn't handle a specific null-pointer edge case.
