import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

type ContentSegment =
  | { type: "markdown"; content: string }
  | { type: "code"; language: string; content: string };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function splitContentSegments(value: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const regex = /```([\w+-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "markdown",
        content: value.slice(lastIndex, match.index),
      });
    }

    segments.push({
      type: "code",
      language: (match[1] || "text").toLowerCase(),
      content: match[2],
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < value.length) {
    segments.push({
      type: "markdown",
      content: value.slice(lastIndex),
    });
  }

  return segments;
}

function formatInlineMarkdown(value: string) {
  let html = escapeHtml(value);

  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer" class="text-blue-500 hover:text-blue-600 underline">$1</a>',
  );
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="px-1 py-0.5 rounded bg-muted text-foreground font-mono text-[0.9em]">$1</code>',
  );
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return html;
}

function highlightCode(code: string, language: string) {
  let html = escapeHtml(code);

  html = html.replace(/(&quot;.*?&quot;|&#39;.*?&#39;)/g, '<span class="text-emerald-300">$1</span>');
  html = html.replace(/\b(\d+)\b/g, '<span class="text-amber-300">$1</span>');
  html = html.replace(/(\/\/.*$)/gm, '<span class="text-zinc-500">$1</span>');
  html = html.replace(/(#.*$)/gm, '<span class="text-zinc-500">$1</span>');

  const keywordsByLanguage: Record<string, string[]> = {
    python: [
      "def",
      "class",
      "return",
      "if",
      "elif",
      "else",
      "for",
      "while",
      "in",
      "try",
      "except",
      "True",
      "False",
      "None",
      "import",
      "from",
      "with",
      "as",
      "lambda",
      "pass",
      "break",
      "continue",
    ],
    javascript: [
      "const",
      "let",
      "var",
      "function",
      "return",
      "if",
      "else",
      "for",
      "while",
      "import",
      "from",
      "export",
      "class",
      "new",
      "try",
      "catch",
      "async",
      "await",
      "null",
      "true",
      "false",
    ],
    typescript: [
      "const",
      "let",
      "var",
      "function",
      "return",
      "if",
      "else",
      "for",
      "while",
      "import",
      "from",
      "export",
      "class",
      "new",
      "try",
      "catch",
      "async",
      "await",
      "interface",
      "type",
      "null",
      "true",
      "false",
    ],
    java: [
      "class",
      "public",
      "private",
      "protected",
      "static",
      "void",
      "return",
      "if",
      "else",
      "for",
      "while",
      "new",
      "try",
      "catch",
      "null",
      "true",
      "false",
    ],
    cpp: [
      "int",
      "long",
      "double",
      "float",
      "bool",
      "class",
      "struct",
      "return",
      "if",
      "else",
      "for",
      "while",
      "namespace",
      "using",
      "const",
      "auto",
      "new",
      "delete",
      "true",
      "false",
    ],
  };

  const keywords = keywordsByLanguage[language] ?? keywordsByLanguage.typescript;
  const keywordsRegex = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
  html = html.replace(keywordsRegex, '<span class="text-sky-300">$1</span>');

  return html;
}

function renderMarkdownBlocks(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const blocks = trimmed.split(/\n{2,}/);

  return blocks.map((block, index) => {
    const lines = block.split("\n");

    if (lines.every((line) => /^-\s+/.test(line.trim()))) {
      return (
        <ul key={`list-${index}`} className="list-disc pl-5 space-y-1">
          {lines.map((line, lineIndex) => (
            <li
              key={`list-item-${index}-${lineIndex}`}
              dangerouslySetInnerHTML={{
                __html: formatInlineMarkdown(line.replace(/^-\s+/, "").trim()),
              }}
            />
          ))}
        </ul>
      );
    }

    const headingMatch = lines[0].match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingHtml = formatInlineMarkdown(headingMatch[2]);
      const headingClass = cn("font-semibold", level <= 2 ? "text-lg" : "text-base");
      const key = `heading-${index}`;

      if (level === 1) {
        return (
          <h1
            key={key}
            className={headingClass}
            dangerouslySetInnerHTML={{ __html: headingHtml }}
          />
        );
      }
      if (level === 2) {
        return (
          <h2
            key={key}
            className={headingClass}
            dangerouslySetInnerHTML={{ __html: headingHtml }}
          />
        );
      }
      if (level === 3) {
        return (
          <h3
            key={key}
            className={headingClass}
            dangerouslySetInnerHTML={{ __html: headingHtml }}
          />
        );
      }
      if (level === 4) {
        return (
          <h4
            key={key}
            className={headingClass}
            dangerouslySetInnerHTML={{ __html: headingHtml }}
          />
        );
      }
      if (level === 5) {
        return (
          <h5
            key={key}
            className={headingClass}
            dangerouslySetInnerHTML={{ __html: headingHtml }}
          />
        );
      }
      return (
        <h6
          key={key}
          className={headingClass}
          dangerouslySetInnerHTML={{ __html: headingHtml }}
        />
      );
    }

    return (
      <p
        key={`p-${index}`}
        className="leading-relaxed"
        dangerouslySetInnerHTML={{
          __html: formatInlineMarkdown(block).replace(/\n/g, "<br/>"),
        }}
      />
    );
  });
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const segments = splitContentSegments(content);

  return (
    <div className={cn("flex flex-col gap-3 text-sm text-foreground/90", className)}>
      {segments.map((segment, index) =>
        segment.type === "markdown" ? (
          <div key={`md-${index}`} className="flex flex-col gap-2">
            {renderMarkdownBlocks(segment.content)}
          </div>
        ) : (
          <div
            key={`code-${index}`}
            className="rounded-xl border border-border bg-muted/60 overflow-hidden"
          >
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border bg-background/80">
              {segment.language}
            </div>
            <pre className="p-4 overflow-x-auto">
              <code
                className="font-mono text-[13px] leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: highlightCode(segment.content, segment.language),
                }}
              />
            </pre>
          </div>
        ),
      )}
    </div>
  );
}
