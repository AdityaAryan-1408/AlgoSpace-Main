'use client';

import { useEffect, useMemo, useState } from "react";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

interface RichNotesEditorProps {
  initialContent?: string;       // JSON string of BlockNote document
  fallbackMarkdown?: string;     // Plain markdown to render if no richNotes
  onChange?: (content: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

export function RichNotesEditor({
  initialContent,
  fallbackMarkdown,
  onChange,
  readOnly = false,
  placeholder = "Type '/' for commands. Add notes, diagrams, code blocks...",
}: RichNotesEditorProps) {
  const [isReady, setIsReady] = useState(false);

  const parsedInitialContent = useMemo(() => {
    if (initialContent) {
      try {
        return JSON.parse(initialContent) as PartialBlock[];
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, [initialContent]);

  const editor = useCreateBlockNote({
    initialContent: parsedInitialContent || undefined,
    domAttributes: {
      editor: {
        class: "rich-notes-blocknote",
      },
    },
  });

  // If we have fallback markdown and no rich content, convert it
  useEffect(() => {
    if (!parsedInitialContent && fallbackMarkdown && editor) {
      const loadMarkdown = async () => {
        try {
          const blocks = await editor.tryParseMarkdownToBlocks(fallbackMarkdown);
          editor.replaceBlocks(editor.document, blocks);
        } catch {
          // Fallback: just leave the editor empty
        }
      };
      loadMarkdown();
    }
    setIsReady(true);
  }, [editor, fallbackMarkdown, parsedInitialContent]);

  // Subscribe to changes
  useEffect(() => {
    if (!editor || !onChange || readOnly) return;

    const handler = () => {
      const content = JSON.stringify(editor.document);
      onChange(content);
    };

    // BlockNote uses onChange callback on the view, so we use setInterval as a workaround
    // since the editor's onChange fires on the view component
    return undefined;
  }, [editor, onChange, readOnly]);

  if (!isReady) {
    return (
      <div className="w-full min-h-[120px] rounded-xl border border-border bg-muted/20 animate-pulse" />
    );
  }

  return (
    <div className={`rich-notes-wrapper rounded-xl border border-border overflow-hidden ${readOnly ? 'rich-notes-readonly' : ''}`}>
      <BlockNoteView
        editor={editor}
        editable={!readOnly}
        theme="dark"
        onChange={() => {
          if (onChange && !readOnly) {
            const content = JSON.stringify(editor.document);
            onChange(content);
          }
        }}
        data-placeholder={placeholder}
      />
    </div>
  );
}
