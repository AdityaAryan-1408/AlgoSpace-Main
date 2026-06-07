'use client';

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

interface MermaidRendererProps {
  content: string;
}

export function MermaidRenderer({ content }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgCode, setSvgCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const renderDiagram = async () => {
      setLoading(true);
      setError(null);
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          themeVariables: {
            background: "#1a1a2e",
            primaryColor: "#3b82f6",
            primaryTextColor: "#f8fafc",
            lineColor: "#94a3b8",
          }
        });

        // Unique ID for mermaid render container
        const elementId = `mermaid-render-${Math.random().toString(36).substring(2, 9)}`;
        
        // Clean dynamic parsing and rendering
        const cleanContent = content.trim();
        const { svg } = await mermaid.render(elementId, cleanContent);
        
        if (active) {
          setSvgCode(svg);
          setError(null);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Mermaid Render Error:", err);
        if (active) {
          setError(err.message || "Failed to render Mermaid diagram. Please check syntax.");
          setLoading(false);
        }
        
        // Cleanup syntax error elements that mermaid appends to document body
        const badEl = document.getElementById("dmermaid");
        if (badEl) badEl.remove();
      }
    };

    renderDiagram();

    return () => {
      active = false;
    };
  }, [content]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 bg-[#1a1a2e] rounded-xl border border-border/50 min-h-[150px]">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-500 mr-2" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest animate-pulse">Rendering Diagram...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-hard-bg border border-hard/30 rounded-xl flex flex-col gap-2 my-2 text-left">
        <div className="flex items-center gap-2 text-hard font-semibold text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Diagram Render Error</span>
        </div>
        <p className="text-xs text-muted-foreground font-mono bg-background/50 p-2 rounded whitespace-pre-wrap select-all">
          {error}
        </p>
        <pre className="text-xs text-foreground/80 bg-background/30 p-2 rounded border border-border/50 font-mono mt-1 whitespace-pre overflow-x-auto select-all">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="p-4 bg-[#1a1a2e] rounded-xl border border-border/50 overflow-x-auto flex items-center justify-center shadow-inner my-2 select-none"
      dangerouslySetInnerHTML={{ __html: svgCode }}
    />
  );
}
