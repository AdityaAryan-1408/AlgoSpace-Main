# How `dsa-cli` Works

This document explains the exact behavior of the script in [`Tools/dsa-cli/index.js`](./index.js). It is written against the current implementation in this repository, not an idealized version.

## 1. What this tool is

`dsa-cli` is a Node.js command-line tool that automates a personal DSA problem-solving workflow.

Its job is to:

1. remember where the DSA repository lives,
2. create new solution files with a metadata header,
3. open those files in VS Code,
4. optionally analyze previously solved problems,
5. search old solutions,
6. pick a random old solution for review,
7. commit and push a newly written solution.

It is published as a CLI command named `dsa` through the `bin` field in [`Tools/dsa-cli/package.json`](./package.json).

## 2. Files that matter

The important pieces are:

1. `Tools/dsa-cli/index.js`
   This is the full application. All command handling is in this one file.
2. `Tools/dsa-cli/package.json`
   Declares the package as an ES module and exposes the `dsa` command.
3. `Solutions/`
   This is the repository folder the script expects to exist. All `.cpp` files are read from or written to here.
4. `%USERPROFILE%\.dsa-cli-config.json`
   The tool stores the linked repository path in the current user's home directory. In this machine, the file currently contains:

```json
{
  "repoPath": "D:\\Aditya\\Code\\DSA-GIT\\DSA-GIT"
}
```

That means the CLI is user-level configured once, then reused from any terminal location.

## 3. Runtime requirements

For the script to work as intended, the machine needs all of the following:

1. Node.js with ES module support and top-level `await`.
2. The dependencies from `package.json`, mainly `@inquirer/prompts`.
3. Git installed and the target repository already initialized as a Git repository.
4. VS Code installed with the `code` command available in `PATH`.
5. A `Solutions` folder inside the configured repo.

If any of those pieces are missing, some flows fail.

## 4. High-level execution model

The file is not organized as exported functions. It is a direct-execution script.

When you run `dsa ...`, Node loads `index.js` and executes it top to bottom. The script then decides what to do by inspecting `process.argv[2]`.

The command routing is:

1. `dsa init`
2. `dsa stats`
3. `dsa open <query>`
4. `dsa review`
5. Any other case, including plain `dsa`, falls into the default "create a new solution" workflow.

There is no command parser library. The script uses direct `if (process.argv[2] === "...")` checks.

## 5. Startup behavior before any command logic

At the top, the script imports:

1. `input`, `select`, and `confirm` from `@inquirer/prompts` for interactive terminal prompts,
2. `execSync` from `child_process` to run shell commands,
3. `fs`, `path`, and `os` from Node core.

Then it creates this config path:

```js
const CONFIG_FILE = path.join(os.homedir(), ".dsa-cli-config.json");
```

This is important because the config file is not stored inside the repo. It is stored once per OS user.

## 6. `dsa init`

This mode is the repository-linking step.

### Exact flow

1. Prints `Welcome to DSA CLI Setup!`
2. Prompts:

```text
Enter the absolute path to your DSA repository:
```

3. Removes any single quotes or double quotes from the typed value and trims whitespace.
4. Checks whether the cleaned path exists using `fs.existsSync`.
5. If the path does not exist:
   prints an error and exits with code `1`.
6. If the path exists:
   writes JSON to `%USERPROFILE%\.dsa-cli-config.json` in this shape:

```json
{
  "repoPath": "ABSOLUTE_PATH_HERE"
}
```

7. Prints success messages and exits with code `0`.

### Important details

1. It does not verify that the path is a Git repo.
2. It does not verify that the repo contains a `Solutions` folder.
3. It does not normalize slashes beyond what the user typed.
4. It does not check read/write permissions.

It only checks that the path exists.

## 7. Config bootstrap for every non-`init` command

After the `init` block, every other mode follows the same setup sequence.

### Step 1: config file must exist

If `%USERPROFILE%\.dsa-cli-config.json` does not exist, the tool stops with:

```text
Configuration missing. Please run 'dsa init' first.
```

### Step 2: config file must contain valid JSON

It reads the file with `fs.readFileSync(..., "utf-8")` and passes it to `JSON.parse`.

If parsing fails, it prints:

```text
Error reading config file. Try running 'dsa init' again.
```

and exits.

### Step 3: change working directory into the configured repo

It runs:

```js
process.chdir(config.repoPath);
```

This is one of the most important design decisions in the script.

Because of this:

1. the CLI can be run from any folder in the terminal,
2. all later relative paths are resolved inside the configured repo,
3. `Solutions` is always expected at `<repoPath>/Solutions`.

If `process.chdir` fails, the tool exits with:

```text
Could not access the repository at: <repoPath>
```

## 8. The metadata parser: `getMetadata(filePath)`

This helper function powers `stats`, `open`, and `review`.

### What it does

1. Reads the whole target file as UTF-8 text.
2. Keeps only the first 20 lines.
3. Searches those first 20 lines for these keys:
   `Platform`, `Difficulty`, `Type`, `Date Solved`, `Topic`, `Problem Name`.
4. Returns an object:

```js
{
  platform,
  difficulty,
  type,
  date,
  topic,
  problemName,
  fullPath
}
```

5. If anything throws while reading or parsing, returns `null`.

### Why the first 20 lines matter

The script assumes the metadata comment block is near the top of every solution file. If a file moves the metadata below line 20, the parser will not find it.

### How extraction works

Each field is extracted with a regex like:

```js
new RegExp(`${key}\\s*:\\s*(.*)`, "i")
```

This means:

1. matching is case-insensitive,
2. the tool looks for `Key : value`,
3. the value is whatever remains on that same line,
4. if the key is missing, the value becomes `"Unknown"`.

### Practical implication

The metadata must stay one field per line. If a header is malformed, the parser can produce incorrect values rather than throwing.

That happens in this repository right now in [`Solutions/2026-01-04_GeeksForGeeks_Sort012s.cpp`](../../Solutions/2026-01-04_GeeksForGeeks_Sort012s.cpp), where the link, type, difficulty, and date were collapsed into broken lines. Because of that, `stats` currently records an invalid difficulty bucket:

```text
Medium Date Solved    : 2026-01-04
```

instead of a clean `Medium` value for that file.

## 9. `dsa stats`

This mode scans the `Solutions` directory and prints a summary report.

### Exact flow

1. Builds `solutionsDir = <repo>/Solutions`.
2. Verifies the folder exists.
3. Reads only files ending in `.cpp`.
4. Initializes counters:
   `totalSolved`, `platforms`, `difficulties`, `types`, `topics`, and `uniqueDates`.
5. For each `.cpp` file:
   reads metadata with `getMetadata`.
6. If metadata is available:
   increments totals and category counters.
7. For `topic`:
   splits by commas, trims each token, and counts each topic separately.
8. For `date`:
   adds non-`Unknown` dates to a set.
9. Sorts dates descending as strings.
10. Calculates the streak.
11. Prints the report.

### What the report includes

1. Current streak in days.
2. Total solved problems.
3. Count by platform.
4. Count by difficulty.
5. Top 5 topics by frequency.

### What the report does not include

1. The `types` count is computed but never printed.
2. It does not show per-day history.
3. It does not show total topics beyond the top five.
4. It does not validate duplicate filenames or duplicate problems.

### How the streak is calculated

This part is very specific.

1. The script converts "today" into a UTC date string using:

```js
new Date().toISOString().split("T")[0]
```

2. It also computes "yesterday" the same way.
3. If the most recent solved date is neither today nor yesterday, the streak is `0`.
4. If the most recent solved date is today or yesterday, streak starts at `1`.
5. Then it keeps walking backward one day at a time as long as the next solved date exactly matches the previous calendar day.

### Important timezone detail

The date uses UTC, not local time. That means the filename date and the streak date boundary are both based on UTC midnight, not necessarily the user's local midnight.

### What happened in this repo when the script was run

When `node Tools/dsa-cli/index.js stats` was executed against this repository on `2026-03-14`, the tool reported:

1. `Total Solved: 110`
2. `Current Streak: 0 Days`

That streak value makes sense because the latest valid solved date currently present is `2026-02-16`, which is neither `2026-03-14` nor `2026-03-13`.

## 10. `dsa open <query>`

This mode searches old solutions and opens one in VS Code.

### Exact flow

1. Verifies `Solutions` exists.
2. Reads the search query from all CLI arguments after `open`.
3. Converts the query to lowercase.
4. If no query is provided, exits with an example message.
5. Reads all `.cpp` files from `Solutions`.
6. For each file, it checks two things:
   filename match,
   topic metadata match.
7. If no matches exist, prints a "No solutions found" message and exits.
8. If exactly one match exists, selects it automatically.
9. If multiple matches exist, shows an interactive selection prompt.
10. Opens the chosen file with:

```bash
code "FULL_PATH"
```

### What counts as a filename match

The filename is transformed like this before checking:

1. lowercase all characters,
2. replace underscores with spaces.

So a file named:

```text
2026-02-10_LeetCode_Two_Sum_2.cpp
```

becomes searchable as text similar to:

```text
2026-02-10 leetcode two sum 2.cpp
```

This is why a search like `two sum` works even though the actual file contains underscores.

### What counts as a topic match

The tool loads metadata and checks whether the lowercased `topic` string contains the lowercased query as a substring.

This is not true fuzzy search. It is simple substring matching.

### Important limitations

1. Search does not include `problemName`.
2. Search does not include `platform` or `difficulty`.
3. Search does not rank results by relevance.
4. Search does not sort matches before presenting them.
5. It depends on the `code` command being available.

## 11. `dsa review`

This mode is for spaced repetition by randomly surfacing one old solution.

### Exact flow

1. Verifies `Solutions` exists.
2. Reads all `.cpp` files.
3. If there are no solution files, prints a message and exits.
4. Picks one file uniformly at random with:

```js
files[Math.floor(Math.random() * files.length)]
```

5. Loads metadata for that file.
6. Prints:
   problem name,
   topic,
   platform,
   difficulty,
   solved date.
7. Prompts:

```text
Would you like to open this solution?
```

8. If the answer is yes, opens the file in VS Code.
9. Exits.

### Important details

1. The selection is purely random each run.
2. There is no weighting toward older or weaker topics.
3. There is no memory of past reviews.
4. If metadata is malformed, the displayed fields can be wrong or `Unknown`.

## 12. Default mode: create a new solution file

If the command is not `init`, `stats`, `open`, or `review`, execution falls into the default workflow. In practice this means plain `dsa`.

This is the main workflow of the app.

### Prompt sequence

The script asks for the following in order:

1. `Problem name:`
2. `Select platform:`
   choices are `LeetCode`, `Codeforces`, `GeeksForGeeks`, `CodeChef`, `Other`
3. `Problem link:`
4. `Topic(s) (e.g. Array, DP, Sorting):`
5. `Select type:`
   choices are `POTD`, `Contest`, `Practice`
6. `Select difficulty:`
   choices are `Easy`, `Medium`, `Hard`

After collecting the data, it logs:

```js
{ problemName, platform, topic, difficulty }
```

Notice that it does not echo `problemLink` or `problemType` in this summary, even though both were collected.

### Filename generation

The script builds the date as:

```js
new Date().toISOString().split("T")[0]
```

Again, this is a UTC date.

Then it sanitizes the problem name with:

```js
problemName.trim().replace(/[^a-zA-Z0-9]+/g, "_")
```

This means:

1. leading and trailing spaces are removed,
2. any run of non-alphanumeric characters becomes `_`,
3. punctuation is removed by replacement,
4. spaces also become `_`.

Example:

```text
Two Sum 2
```

becomes:

```text
Two_Sum_2
```

The final filename format is:

```text
YYYY-MM-DD_PLATFORM_SafeProblemName.cpp
```

Example:

```text
2026-02-10_LeetCode_Two_Sum_2.cpp
```

### File location

The output path is always:

```text
<configured repo>/Solutions/<generated filename>
```

### Header generation

Before the actual solution code, the CLI writes this C-style block comment:

```cpp
/*

Problem Name   : <problemName>
Platform       : <platform>
Topic          : <topic>
Problem Link   : <problemLink>
Type           : <problemType>
Difficulty     : <difficulty>
Date Solved    : <date>

*/
```

This header is the contract used later by `stats`, `open`, and `review`.

### Cursor positioning

The script counts the number of lines in the generated header and stores it in `cursorLine`.

Then it tries to open the file in VS Code at that exact line using:

```bash
code -g "FULL_PATH:LINE_NUMBER"
```

The intention is to place the cursor just after the metadata block so the user can immediately start writing code.

If that fails, it falls back to:

```bash
code "FULL_PATH"
```

### File creation behavior

Before writing, it only checks whether `Solutions` exists.

Then it writes the file with:

```js
fs.writeFileSync(filePath, header, { flag: "wx" });
```

The `wx` flag matters:

1. it creates a new file,
2. it fails if the file already exists,
3. it prevents silent overwrite.

However, there is no surrounding `try/catch` around this write. So if the file already exists or the write fails for another reason, Node will throw and terminate the process.

### What happens after the file opens

The script pauses and waits for the user to press Enter:

```text
Press Enter after you finish writing and saving the solution
```

This is only a manual checkpoint. The script does not verify:

1. that the file was actually edited,
2. that the file was saved,
3. that the code compiles,
4. that tests passed.

It trusts the user.

### Git automation

After the Enter confirmation, it runs these commands synchronously:

```bash
git add "FULL_PATH"
git commit -m "Solved <Platform>: <Problem Name> [<Topic>]"
git push
```

If all three succeed, it prints a success message.

If any of them fail, it prints:

```text
Git operation failed.
```

### Important Git behavior

1. `git add` stages only the new solution file.
2. `git commit` still includes any other already-staged changes in the repo.
3. The script does not inspect Git status first.
4. The script does not retry on push failure.
5. The script does not show which of the three Git steps failed.
6. Because the three commands are wrapped in one `try/catch`, all failures collapse into the same generic error.

## 13. What the current solution files tell us about intended usage

The files in `Solutions/` confirm the expected pattern:

1. one problem per `.cpp` file,
2. metadata comment block at the top,
3. filename includes solved date, platform, and problem name,
4. the CLI is designed around C++ solutions only.

Example real file:

```text
Solutions/2026-02-10_LeetCode_Two_Sum_2.cpp
```

with header:

```cpp
Problem Name   : Two Sum 2
Platform       : LeetCode
Topic          : Top Interview 150, Array
Problem Link   : https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/description/?envType=study-plan-v2&envId=top-interview-150
Type           : Practice
Difficulty     : Medium
Date Solved    : 2026-02-10
```

That is the exact shape the CLI expects to parse later.

## 14. Design strengths

The implementation is simple, but it is effective for a personal workflow because:

1. there is only one script to maintain,
2. the repo path is remembered globally,
3. metadata stays embedded inside each solution file,
4. later features reuse that same metadata contract,
5. the default path from "create file" to "push to remote" is automated end to end.

## 15. Important limitations and edge cases

These are not hypothetical. They follow directly from the current code.

1. The entire app assumes the configured repo contains a folder literally named `Solutions`.
2. Only `.cpp` files are included in search, stats, and review.
3. Metadata is only parsed from the first 20 lines.
4. Metadata parsing is line-format sensitive.
5. Dates are generated in UTC, not local time.
6. `stats` computes `types` counts but never shows them.
7. `open` uses substring matching, not fuzzy search.
8. `open` does not search by displayed problem name, only by filename and topic.
9. `review` is random but not adaptive.
10. New-file creation can crash if a duplicate filename already exists.
11. The script depends on the VS Code `code` command.
12. The script depends on Git authentication already being set up for `git push`.
13. There is no compile step, lint step, or test step.
14. The post-solve Git commit message includes raw topic text, so commas and spaces appear as typed.

## 16. Exact mental model of the app

The simplest correct way to understand this tool is:

1. `init` teaches the CLI where the DSA repo lives.
2. Every later run jumps into that repo automatically.
3. Plain `dsa` creates a new metadata-first C++ file and tries to push it after you finish coding.
4. `stats`, `open`, and `review` all work by reading the same metadata back out of existing solution headers.

So the real foundation of the whole app is not just the `Solutions` folder. It is the combination of:

1. a globally stored `repoPath`,
2. a fixed `Solutions` directory,
3. a strict top-of-file metadata header format,
4. shell access to `code`, `git add`, `git commit`, and `git push`.

If those four assumptions hold, the tool works as designed.
