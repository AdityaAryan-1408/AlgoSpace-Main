import { Zap, Timer, LayoutGrid, Bug, ShuffleIcon, Languages, FileJson, GraduationCap, Compass, Network, MessageSquare } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const CATEGORIES = [
  {
    title: "Core Practice",
    features: [
      { id: "stress-mode", title: "Stress Drill", description: "High-pressure timed mode with strict penalties.", icon: <Zap className="w-6 h-6 text-red-500" />, color: "bg-red-500/10 border-red-500/20 hover:border-red-500/50" },
      { id: "cram-mode", title: "Cram Mode", description: "Review as many cards as possible ignoring SRS intervals.", icon: <LayoutGrid className="w-6 h-6 text-rose-500" />, color: "bg-rose-500/10 border-rose-500/20 hover:border-rose-500/50" },
      { id: "speedrun", title: "Speedruns", description: "Race against the clock to type solutions flawlessly.", icon: <Timer className="w-6 h-6 text-amber-500" />, color: "bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50" },
    ]
  },
  {
    title: "Analysis Tools",
    features: [
      { id: "anti-patterns", title: "Anti-Patterns", description: "AI breaks down your common mistakes.", icon: <Bug className="w-6 h-6 text-red-500" />, color: "bg-red-500/10 border-red-500/20 hover:border-red-500/50" },
      { id: "skill-tree", title: "Skill Tree", description: "Visualize your mastery progression across topics.", icon: <Network className="w-6 h-6 text-cyan-500" />, color: "bg-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/50" },
      { id: "coach", title: "AI Coach", description: "Personalized advice and recovery plans.", icon: <GraduationCap className="w-6 h-6 text-purple-500" />, color: "bg-purple-500/10 border-purple-500/20 hover:border-purple-500/50" },
    ]
  },
  {
    title: "Challenges",
    features: [
      { id: "vague-interviewer", title: "Vague Interviewer", description: "Decode real-world business scenarios into computer science algorithms.", icon: <MessageSquare className="w-6 h-6 text-indigo-500" />, color: "bg-indigo-500/10 border-indigo-500/20 hover:border-indigo-500/50" },
      { id: "bigo-drill", title: "Big-O Drills", description: "Rapid-fire time and space complexity quiz.", icon: <Timer className="w-6 h-6 text-amber-500" />, color: "bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50" },
      { id: "pattern-quiz", title: "Pattern Quiz", description: "Identify the correct algorithm pattern from descriptions.", icon: <FileJson className="w-6 h-6 text-violet-500" />, color: "bg-violet-500/10 border-violet-500/20 hover:border-violet-500/50" },
      { id: "obfuscation", title: "Obfuscation", description: "Fix poorly named variables and refactor bad code.", icon: <ShuffleIcon className="w-6 h-6 text-violet-500" />, color: "bg-violet-500/10 border-violet-500/20 hover:border-violet-500/50" },
      { id: "cross-language", title: "Cross-Language", description: "Translate solutions between Python, Java, and C++.", icon: <Languages className="w-6 h-6 text-sky-500" />, color: "bg-sky-500/10 border-sky-500/20 hover:border-sky-500/50" },
    ]
  }
];

export function TrainingHub({ onNavigate }: { onNavigate: (view: string) => void }) {
  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Compass className="w-8 h-8 text-cyan-500" />
          Training Hub
        </h1>
        <p className="text-muted-foreground text-lg">
          Master your skills with specialized practice modes, analytics, and challenges.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        {CATEGORIES.map((category, idx) => (
          <motion.section 
            key={category.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border/50">
              {category.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {category.features.map(feature => (
                <button
                  key={feature.id}
                  onClick={() => onNavigate(feature.id)}
                  className={`flex flex-col items-start text-left p-5 rounded-2xl border transition-all duration-200 cursor-pointer group bg-card ${feature.color}`}
                >
                  <div className="mb-4 p-3 rounded-xl bg-background/50 border border-border/50 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-cyan-500 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {feature.description}
                  </p>
                </button>
              ))}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  );
}
