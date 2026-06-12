'use client';

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { MermaidRenderer } from "@/components/MermaidRenderer";

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
  return escapeHtml(code);
}

function renderMarkdownBlocks(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const lines = trimmed.split("\n");
  const elements: React.ReactNode[] = [];
  
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushList = (key: string) => {
    if (!currentList) return null;
    const listType = currentList.type;
    const listItems = currentList.items;
    currentList = null;

    if (listType === "ul") {
      return (
        <ul key={key} className="list-disc pl-5 space-y-1 my-2">
          {listItems.map((item, itemIdx) => (
            <li
              key={`${key}-${itemIdx}`}
              dangerouslySetInnerHTML={{
                __html: formatInlineMarkdown(item),
              }}
            />
          ))}
        </ul>
      );
    } else {
      return (
        <ol key={key} className="list-decimal pl-5 space-y-1 my-2">
          {listItems.map((item, itemIdx) => (
            <li
              key={`${key}-${itemIdx}`}
              dangerouslySetInnerHTML={{
                __html: formatInlineMarkdown(item),
              }}
            />
          ))}
        </ol>
      );
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 1. Heading check
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const listEl = flushList(`list-before-h-${i}`);
      if (listEl) elements.push(listEl);

      const level = headingMatch[1].length;
      const headingHtml = formatInlineMarkdown(headingMatch[2]);
      const headingClass = cn(
        "font-semibold mt-4 mb-2 block text-foreground",
        level === 1 ? "text-xl" : level === 2 ? "text-lg" : "text-base"
      );
      
      const headingEl = (
        level === 1 ? <h1 key={`h-${i}`} className={headingClass} dangerouslySetInnerHTML={{ __html: headingHtml }} /> :
        level === 2 ? <h2 key={`h-${i}`} className={headingClass} dangerouslySetInnerHTML={{ __html: headingHtml }} /> :
        level === 3 ? <h3 key={`h-${i}`} className={headingClass} dangerouslySetInnerHTML={{ __html: headingHtml }} /> :
        level === 4 ? <h4 key={`h-${i}`} className={headingClass} dangerouslySetInnerHTML={{ __html: headingHtml }} /> :
        level === 5 ? <h5 key={`h-${i}`} className={headingClass} dangerouslySetInnerHTML={{ __html: headingHtml }} /> :
        <h6 key={`h-${i}`} className={headingClass} dangerouslySetInnerHTML={{ __html: headingHtml }} />
      );
      elements.push(headingEl);
      continue;
    }

    // 2. Bullet list check
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (bulletMatch) {
      if (currentList && currentList.type !== "ul") {
        const listEl = flushList(`list-flush-ol-${i}`);
        if (listEl) elements.push(listEl);
      }
      if (!currentList) {
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(bulletMatch[2]);
      continue;
    }

    // 3. Numbered list check
    const numberedMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (numberedMatch) {
      if (currentList && currentList.type !== "ol") {
        const listEl = flushList(`list-flush-ul-${i}`);
        if (listEl) elements.push(listEl);
      }
      if (!currentList) {
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(numberedMatch[2]);
      continue;
    }

    // 4. Blank line / paragraph
    if (trimmedLine === "") {
      const listEl = flushList(`list-flush-blank-${i}`);
      if (listEl) elements.push(listEl);
      continue;
    }

    // It's a regular paragraph line
    const listEl = flushList(`list-flush-p-${i}`);
    if (listEl) elements.push(listEl);

    elements.push(
      <p
        key={`p-${i}`}
        className="leading-relaxed my-1"
        dangerouslySetInnerHTML={{
          __html: formatInlineMarkdown(trimmedLine),
        }}
      />
    );
  }

  // Flush any final list
  const listEl = flushList(`list-final`);
  if (listEl) elements.push(listEl);

  return elements;
}

interface CodeBlockProps {
  language: string;
  content: string;
}

export function CodeBlock({ language, content }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border/80 bg-[#0b0f19] dark:bg-[#070a14] overflow-hidden my-4 shadow-md shadow-black/10 dark:shadow-black/25">
      {/* OS Editor Bar */}
      <div className="px-4 py-2 text-[10px] font-semibold text-muted-foreground border-b border-border/60 bg-muted/10 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Windows-style control dots */}
          <div className="flex items-center gap-1.5 shrink-0 select-none">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          {/* Active Tab */}
          <div className="flex items-center gap-1 bg-[#0b0f19] dark:bg-[#070a14] border-t border-x border-border/60 px-3 py-1 -mb-3 rounded-t-lg text-foreground font-mono text-[10px] select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            {language || "source"}
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center"
          title="Copy Code"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in-50" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto bg-transparent">
        <code
          className="font-mono text-[13px] leading-relaxed selectable text-foreground/90"
          dangerouslySetInnerHTML={{
            __html: escapeHtml(content),
          }}
        />
      </pre>
    </div>
  );
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
        ) : segment.language === "mermaid" ? (
          <MermaidRenderer
            key={`mermaid-${index}`}
            content={segment.content}
          />
        ) : (
          <CodeBlock
            key={`code-${index}`}
            language={segment.language}
            content={segment.content}
          />
        ),
      )}
    </div>
  );
}
