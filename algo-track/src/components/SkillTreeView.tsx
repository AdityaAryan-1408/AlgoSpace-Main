'use client';

import { useState, useEffect } from "react";
import { Loader2, Lock, Star, Activity, CheckCircle, Award } from "lucide-react";
import { fetchSkillTreeProgress } from "@/lib/client-api";
import type { SkillNodeProgress } from "@/lib/analytics-engine";
import { getTopologicalOrder, SKILL_TREE, SkillTreeNode, SkillTreeDomain } from "@/data/skill-tree";
import { Badge } from "@/components/ui/Badge";

// Helper to determine depth
function computeNodeDepths(): Record<string, number> {
  const depths: Record<string, number> = {};
  const sorted = getTopologicalOrder();

  for (const node of sorted) {
    if (node.prerequisiteNodeIds.length === 0) {
      depths[node.id] = 0;
    } else {
      let maxPrereqDepth = 0;
      for (const pId of node.prerequisiteNodeIds) {
        maxPrereqDepth = Math.max(maxPrereqDepth, depths[pId] ?? 0);
      }
      depths[node.id] = maxPrereqDepth + 1;
    }
  }
  return depths;
}

const ICONS = {
  locked: Lock,
  available: Star,
  active: Activity,
  weak: Activity,
  stable: CheckCircle,
  mastered: Award,
};

const COLORS = {
  locked: "bg-muted/30 border-muted text-muted-foreground opacity-60",
  available: "bg-blue-500/10 border-blue-500/30 text-blue-500",
  active: "bg-amber-500/10 border-amber-500/30 text-amber-500",
  weak: "bg-red-500/10 border-red-500/30 text-red-500",
  stable: "bg-emerald-500/10 border-emerald-500/50 text-emerald-500",
  mastered: "bg-purple-500/20 border-purple-500 text-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]",
};

export function SkillTreeView() {
  const [nodes, setNodes] = useState<SkillNodeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState<SkillTreeDomain>("dsa");

  const depths = computeNodeDepths();

  useEffect(() => {
    fetchSkillTreeProgress()
      .then((res) => setNodes(res.nodes))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Filter nodes to domain
  const domainNodes = nodes.filter((n) => n.domain === domainFilter);
  const maxDepth = Math.max(...domainNodes.map((n) => depths[n.nodeId] ?? 0), 0);
  
  // Group by level
  const layers: SkillNodeProgress[][] = [];
  for (let i = 0; i <= maxDepth; i++) {
    layers.push(domainNodes.filter((n) => (depths[n.nodeId] ?? 0) === i));
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skill Trees</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your progression across fundamental concepts. Unlocking root concepts unlocks advancing topics.
          </p>
        </div>

        <div className="flex p-1 bg-muted/30 border border-border rounded-lg self-start">
          <button
            onClick={() => setDomainFilter("dsa")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              domainFilter === "dsa" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            DSA
          </button>
          <button
            onClick={() => setDomainFilter("cs")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              domainFilter === "cs" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            CS Theory
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-8 custom-scrollbar relative">
        <div className="flex min-w-max gap-8 px-2 py-4">
          {layers.map((layer, levelIdx) => (
            <div key={levelIdx} className="flex flex-col gap-6 relative z-10 w-64 shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center mb-2">
                Level {levelIdx + 1}
              </h3>
              
              {layer.map((n) => {
                const Icon = ICONS[n.state];
                const baseNodeDef = SKILL_TREE.find(t => t.id === n.nodeId);
                
                return (
                  <div
                    key={n.nodeId}
                    className={`relative p-4 rounded-2xl border-2 transition-all group ${COLORS[n.state]}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="p-2 rounded-lg bg-background/50 backdrop-blur-sm">
                        <Icon className="w-5 h-5" />
                      </div>
                      <Badge variant="secondary" className="uppercase text-[10px] bg-background/50">
                        {n.state}
                      </Badge>
                    </div>
                    
                    <h4 className="font-bold text-sm mb-1">{n.label}</h4>
                    <p className="text-[10px] leading-tight opacity-80 line-clamp-2">
                      {baseNodeDef?.description ?? "Core concept module"}
                    </p>

                    {n.state !== "locked" && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between text-[10px] font-semibold">
                          <span>Progress</span>
                          <span>{n.reviewedCount} / {n.cardCount} reviewed</span>
                        </div>
                        <div className="h-1.5 w-full bg-background/50 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-current transition-all duration-1000 ease-out"
                            style={{ width: `${n.avgMastery}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
