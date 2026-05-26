'use client';

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle, 
  HelpCircle, 
  X, 
  ExternalLink, 
  Brain, 
  Zap, 
  Shield, 
  Target,
  BookOpen
} from "lucide-react";

// ============================================================================
// CONFIGURATION: Edit this when you deploy your public clone app!
// ============================================================================
const MAIN_CLONE_APP_URL = ""; // e.g. "https://algotrack-public.vercel.app"

interface LockScreenProps {
  onUnlock: (password: string) => Promise<boolean>;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isVerifying) return;

    setIsVerifying(true);
    setError(null);

    const success = await onUnlock(password.trim());

    if (success) {
      setUnlocked(true);
    } else {
      setShake(true);
      setError("Incorrect password. Try again.");
      setIsVerifying(false);
      setTimeout(() => setShake(false), 600);
      inputRef.current?.select();
    }
  };

  return (
    <AnimatePresence mode="wait">
      {unlocked ? (
        <motion.div
          key="unlocked"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0, scale: 1.05, filter: "blur(12px)" }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
        />
      ) : (
        <motion.div
          key="locked"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: "blur(12px)" }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background p-4"
        >
          {/* Subtle animated background orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              className="absolute w-[500px] h-[500px] rounded-full opacity-[0.07] bg-primary"
              style={{ top: "5%", left: "10%", filter: "blur(120px)" }}
              animate={{
                x: [0, 30, -20, 0],
                y: [0, -20, 15, 0],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute w-[400px] h-[400px] rounded-full opacity-[0.05] bg-tag"
              style={{ bottom: "10%", right: "5%", filter: "blur(120px)" }}
              animate={{
                x: [0, -25, 15, 0],
                y: [0, 20, -25, 0],
              }}
              transition={{
                duration: 25,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>

          {/* Lock card */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.5,
              delay: 0.15,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative w-full max-w-sm"
          >
            {/* Card using theme variables */}
            <div className="relative rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
              {/* Top glow accent line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[2px] rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

              {/* Help button in top-right */}
              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className="absolute top-4 right-4 p-2 text-muted-foreground/60 hover:text-primary hover:bg-muted/50 rounded-full transition-all duration-200 cursor-pointer"
                title="About AlgoTrack"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

              <div className="px-8 pt-10 pb-8 flex flex-col items-center gap-6">
                {/* Lock icon */}
                <motion.div
                  animate={shake ? {
                    x: [-12, 12, -8, 8, -4, 4, 0],
                    transition: { duration: 0.5 },
                  } : {}}
                  className="relative"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Lock className="w-7 h-7 text-primary" />
                  </div>
                  {/* Pulse ring */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl border border-primary/30"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </motion.div>

                {/* Title */}
                <div className="text-center">
                  <h1 className="text-xl font-bold text-foreground tracking-tight">
                    AlgoTrack
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your passcode to continue
                  </p>
                </div>

                {/* Password form */}
                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
                  <div className="relative group">
                    <input
                      ref={inputRef}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Enter password"
                      autoComplete="current-password"
                      className="w-full h-12 px-4 pr-20 rounded-xl text-sm font-medium bg-background text-foreground placeholder:text-muted-foreground/50 transition-all duration-200 outline-none border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                    />
                    {/* Eye toggle */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    {/* Submit arrow */}
                    <button
                      type="submit"
                      disabled={!password.trim() || isVerifying}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 flex items-center justify-center transition-all duration-200"
                      tabIndex={-1}
                    >
                      {isVerifying ? (
                        <motion.div
                          className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Error message */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -5, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -5, height: 0 }}
                        className="flex items-center gap-2 text-hard text-xs font-medium"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit button */}
                  <motion.button
                    type="submit"
                    disabled={!password.trim() || isVerifying}
                    className="w-full h-11 rounded-xl text-sm font-semibold bg-primary text-primary-foreground transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90"
                    whileHover={password.trim() && !isVerifying ? { scale: 1.02 } : {}}
                    whileTap={password.trim() && !isVerifying ? { scale: 0.98 } : {}}
                  >
                    {isVerifying ? (
                      <>
                        <motion.div
                          className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Unlock
                      </>
                    )}
                  </motion.button>
                </form>

                {/* Hint */}
                <p className="text-[11px] text-muted-foreground/40 text-center leading-relaxed">
                  This app is password-protected.
                  <br />
                  Contact the owner for access.
                </p>
              </div>
            </div>
          </motion.div>

          {/* About / Info Modal (Overlay) */}
          <AnimatePresence>
            {showHelp && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 overflow-y-auto"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
                >
                  {/* Top glow accent line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/10 shrink-0">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-primary" />
                      <h2 className="text-base font-bold text-foreground">About AlgoTrack Study Hub</h2>
                    </div>
                    <button
                      onClick={() => setShowHelp(false)}
                      className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Close info panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                    {/* Welcome Intro */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" /> What is AlgoTrack?
                      </h3>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        AlgoTrack is an <strong>offline-first Personal Study companion</strong> built to help computer science students and engineers master Data Structures, Algorithms, and Core CS Concepts. It organizes flashcards and study tracks directly inside your browser so you can learn on the go, even entirely offline.
                      </p>
                    </div>

                    {/* Benefit of SRS */}
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-2">
                      <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
                        <Brain className="w-4 h-4" /> The Power of Spaced Repetition (SRS)
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Scientific memory research proves that our brains forget newly acquired skills exponentially. 
                        AlgoTrack uses a specialized **Spaced Repetition Algorithm** that computes exactly when you should review a coding problem based on your history:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc leading-relaxed">
                        <li>Tracks difficulty ratings (Again, Hard, Good, Easy) for custom intervals.</li>
                        <li>Triggers reviews at the absolute peak of your forgetting curve.</li>
                        <li>Drastically minimizes study time while building permanent, long-term conceptual recall.</li>
                      </ul>
                    </div>

                    {/* Core Features & Modules */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-4 h-4" /> Specialized Training Modules
                      </h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl border border-border bg-background space-y-1">
                          <p className="text-xs font-bold text-foreground">🎤 Feynman Recorder</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Explain a technical concept out loud, auto-transcribe it, and let AI evaluate the accuracy of your explanation.
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl border border-border bg-background space-y-1">
                          <p className="text-xs font-bold text-foreground">⏱️ Stress Mode</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Simulate high-pressure technical interviews. Solve questions against strict countdown clocks and penalty scores.
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl border border-border bg-background space-y-1">
                          <p className="text-xs font-bold text-foreground">🛡️ Recovery Mode</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Fell behind? Avoid burnout with a calculated daily cap on reviews to help you smoothly catch up to your study streak.
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl border border-border bg-background space-y-1">
                          <p className="text-xs font-bold text-foreground">🧠 Tracing & Drills</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Test your cognitive abilities with Mental Tracing, Obfuscation puzzles, Spot the Bug, and Constraint Shifters.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Offline First & Sync */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-4 h-4" /> Secure, Local, and Offline-First
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        This instance runs securely offline using highly efficient local database caches. All your flashcards, scores, and active review lists remain in local storage, fully accessible even if you lose network connectivity.
                      </p>
                    </div>

                    {/* Clone App Redirect (Editable Link) */}
                    <div className="pt-4 border-t border-border space-y-3 shrink-0">
                      {MAIN_CLONE_APP_URL ? (
                        <a
                          href={MAIN_CLONE_APP_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full h-11 rounded-xl text-sm font-semibold bg-primary text-primary-foreground flex items-center justify-center gap-2 hover:opacity-90 transition-all duration-200"
                        >
                          Access Main Public App Clone
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-muted/40 border border-dashed border-border text-center">
                          <p className="text-xs font-semibold text-foreground">🚀 Looking to share or sync across devices?</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            The public clone of this app is currently in development. It will support Google/Email OAuth, full multi-device synchronization, progress boards, and interactive review rooms!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
