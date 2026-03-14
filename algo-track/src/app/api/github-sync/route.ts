import { NextResponse } from "next/server";

interface SolutionInput {
  name: string;
  content: string;
}

interface SyncBody {
  title: string;
  platform: string;
  url?: string;
  difficulty: string;
  tags?: string[];
  solutions: SolutionInput[];
  timeComplexity?: string;
  spaceComplexity?: string;
  problemType?: string;
}

function sanitizeName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9]+/g, "_");
}

function stripCodeFences(code: string): string {
  // Remove markdown code fences like ```cpp ... ``` or ```python ... ```
  return code
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/^```\s*$/gm, "")
    .trim();
}

function buildMetadataHeader(
  meta: {
    problemName: string;
    platform: string;
    topic: string;
    link: string;
    type: string;
    difficulty: string;
    date: string;
    approach?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
  },
): string {
  let header = `/*

Problem Name   : ${meta.problemName}
Platform       : ${meta.platform}
Topic          : ${meta.topic}
Problem Link   : ${meta.link}
Type           : ${meta.type}
Difficulty     : ${meta.difficulty}
Date Solved    : ${meta.date}`;

  if (meta.approach) {
    header += `\nApproach       : ${meta.approach}`;
  }
  if (meta.timeComplexity) {
    header += `\nTime           : ${meta.timeComplexity}`;
  }
  if (meta.spaceComplexity) {
    header += `\nSpace          : ${meta.spaceComplexity}`;
  }

  header += `\n\n*/\n\n`;
  return header;
}

async function pushFileToGitHub(
  filePath: string,
  content: string,
  commitMessage: string,
  token: string,
  owner: string,
  repo: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const encoded = Buffer.from(content).toString("base64");

  // Check if file already exists (to get its SHA for update)
  let sha: string | undefined;
  const getRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  }

  const putRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: commitMessage,
        content: encoded,
        ...(sha ? { sha } : {}),
      }),
    },
  );

  if (!putRes.ok) {
    const err = await putRes.text();
    console.error("GitHub PUT failed:", putRes.status, err);
    return { success: false, error: `GitHub API ${putRes.status}` };
  }

  const data = await putRes.json();
  return { success: true, url: data.content?.html_url };
}

export async function POST(req: Request) {
  try {
    const body: SyncBody = await req.json();
    const { title, platform, url, difficulty, tags, solutions, timeComplexity, spaceComplexity, problemType } = body;

    const token = process.env.GITHUB_ACCESS_TOKEN;
    const owner = process.env.GITHUB_REPO_OWNER;
    const repo = process.env.GITHUB_REPO_NAME;

    if (!token || !owner || !repo) {
      return NextResponse.json(
        { error: "GitHub env vars not configured (GITHUB_ACCESS_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME)" },
        { status: 500 },
      );
    }

    if (!solutions || solutions.length === 0) {
      return NextResponse.json(
        { error: "No solutions to sync" },
        { status: 400 },
      );
    }

    const date = new Date().toISOString().split("T")[0];
    const safeName = sanitizeName(title);
    const topicStr = tags?.join(", ") || "General";
    const singleSolution = solutions.length === 1;

    const results: Array<{ file: string; success: boolean; url?: string; error?: string }> = [];

    for (const sol of solutions) {
      // Build approach suffix: "Brute Force" → "Brute_Force"
      const approachSuffix = singleSolution ? "" : `_${sanitizeName(sol.name)}`;
      const fileName = `${date}_${sanitizeName(platform)}_${safeName}${approachSuffix}.cpp`;
      const filePath = `Solutions/${fileName}`;

      const code = stripCodeFences(sol.content);

      const header = buildMetadataHeader({
        problemName: title,
        platform,
        topic: topicStr,
        link: url || "N/A",
        type: problemType || "Practice",
        difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
        date,
        approach: singleSolution ? undefined : sol.name,
        timeComplexity,
        spaceComplexity,
      });

      const fileContent = header + code + "\n";
      const commitMsg = `Solved ${platform}: ${title}${singleSolution ? "" : ` [${sol.name}]`} [${topicStr}]`;

      const result = await pushFileToGitHub(filePath, fileContent, commitMsg, token, owner, repo);
      results.push({ file: fileName, ...result });
    }

    const allSucceeded = results.every((r) => r.success);
    return NextResponse.json({
      synced: allSucceeded,
      files: results,
    });
  } catch (err) {
    console.error("GitHub sync error:", err);
    return NextResponse.json(
      { error: "GitHub sync failed" },
      { status: 500 },
    );
  }
}
