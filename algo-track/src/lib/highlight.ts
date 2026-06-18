/**
 * Highlights occurrences of a case-insensitive query string in text nodes inside a container.
 * It recursively walks the DOM, wrapping matches in a <mark> element, and cleaning up old marks.
 */
export function highlightTextInDOM(container: HTMLElement, query: string) {
  // 1. Remove existing highlights created by this function
  const existingMarks = container.querySelectorAll('mark[data-highlight="true"]');
  existingMarks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      const textNode = document.createTextNode(mark.textContent || "");
      parent.replaceChild(textNode, mark);
      parent.normalize(); // Merge adjacent text nodes
    }
  });

  if (!query || !query.trim()) return;

  const normalizedQuery = query.toLowerCase().trim();

  // 2. Recursively traverse and highlight matching text nodes
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      const lowerText = text.toLowerCase();
      const index = lowerText.indexOf(normalizedQuery);

      if (index >= 0) {
        const parent = node.parentNode;
        if (
          parent &&
          parent.nodeName !== "SCRIPT" &&
          parent.nodeName !== "STYLE" &&
          parent.nodeName !== "TEXTAREA" &&
          parent.nodeName !== "INPUT"
        ) {
          const matchText = text.substring(index, index + normalizedQuery.length);
          const beforeText = text.substring(0, index);
          const afterText = text.substring(index + normalizedQuery.length);

          const mark = document.createElement("mark");
          mark.setAttribute("data-highlight", "true");
          // Match application aesthetics: golden/cyan amber glow matching standard cards theme
          mark.className =
            "bg-amber-500/35 text-amber-950 dark:bg-amber-500/40 dark:text-amber-100 font-medium px-0.5 rounded border border-amber-500/30 shadow-sm transition-colors duration-150 select-text";
          mark.textContent = matchText;

          const remainingNode = document.createTextNode(afterText);

          node.textContent = beforeText;
          if (node.nextSibling) {
            parent.insertBefore(mark, node.nextSibling);
            parent.insertBefore(remainingNode, mark.nextSibling);
          } else {
            parent.appendChild(mark);
            parent.appendChild(remainingNode);
          }

          // Continue walking on the remaining text part to catch multiple occurrences in the same text node
          walk(remainingNode);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      // Skip script/style/inputs/textareas/buttons, and ignore active blocknote editor instances
      if (
        element.tagName !== "SCRIPT" &&
        element.tagName !== "STYLE" &&
        element.tagName !== "TEXTAREA" &&
        element.tagName !== "INPUT" &&
        element.tagName !== "BUTTON" &&
        !element.classList.contains("rich-notes-blocknote") // Skip active blocknote editor container
      ) {
        const children = Array.from(node.childNodes);
        children.forEach((child) => walk(child));
      }
    }
  };

  walk(container);
}

/**
 * Recursively parses a BlockNote document JSON string and extracts visible plain text.
 */
export function extractTextFromRichNotes(richNotesJson: string): string {
  if (!richNotesJson) return "";
  try {
    const blocks = JSON.parse(richNotesJson);
    if (!Array.isArray(blocks)) return "";

    const extractText = (block: any): string => {
      let text = "";
      if (block.content) {
        if (Array.isArray(block.content)) {
          block.content.forEach((c: any) => {
            if (c.text) text += c.text + " ";
          });
        } else if (typeof block.content === "string") {
          text += block.content + " ";
        }
      }
      if (block.children && Array.isArray(block.children)) {
        block.children.forEach((child: any) => {
          text += extractText(child);
        });
      }
      return text;
    };

    return blocks.map(extractText).join("\n").trim();
  } catch {
    // Return the string as-is if it's not JSON
    return richNotesJson;
  }
}
