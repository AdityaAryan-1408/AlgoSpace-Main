import { useState, useMemo } from "react";
import type { Flashcard } from "@/data";
import { CalendarDays } from "lucide-react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { updateCard } from "@/lib/client-api";
import { motion, AnimatePresence } from "motion/react";

interface CalendarViewProps {
  cards: Flashcard[];
  onRefresh?: () => Promise<void> | void;
}

export function CalendarView({ cards, onRefresh }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [customDateCardId, setCustomDateCardId] = useState<string | null>(null);
  const [customDaysValue, setCustomDaysValue] = useState<Record<string, string>>({});

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group cards by due date (YYYY-MM-DD)
  const cardsByDate = useMemo(() => {
    const map = new Map<string, Flashcard[]>();
    
    cards.forEach(card => {
      // Use nextReview or calculate from dueInDays if nextReview is invalid
      let date: Date;
      if (card.nextReview) {
        date = new Date(card.nextReview);
      } else {
        date = new Date();
        date.setDate(date.getDate() + (card.dueInDays || 0));
      }
      
      if (isNaN(date.getTime())) return;
      
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(card);
    });
    
    return map;
  }, [cards]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const renderDays = () => {
    const days = [];
    
    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 sm:h-32 border border-transparent"></div>);
    }
    
    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayCards = cardsByDate.get(dateStr) || [];
      const currentIterDate = new Date(year, month, d);
      currentIterDate.setHours(0, 0, 0, 0);
      
      const isPast = currentIterDate < today;
      const isToday = currentIterDate.getTime() === today.getTime();
      const isSelected = selectedDate && selectedDate.getTime() === currentIterDate.getTime();
      
      // Heatmap color logic based on workload
      let workloadColor = "bg-transparent";
      if (dayCards.length > 0 && !isPast) {
        if (dayCards.length > 20) workloadColor = "bg-red-500/20 text-red-500 border-red-500/30";
        else if (dayCards.length > 10) workloadColor = "bg-orange-500/20 text-orange-500 border-orange-500/30";
        else if (dayCards.length > 5) workloadColor = "bg-blue-500/20 text-blue-500 border-blue-500/30";
        else workloadColor = "bg-emerald-500/20 text-emerald-500 border-emerald-500/30";
      }

      days.push(
        <button
          key={`day-${d}`}
          onClick={() => setSelectedDate(new Date(year, month, d))}
          className={`h-24 sm:h-32 p-1 sm:p-2 border transition-all cursor-pointer flex flex-col relative
            ${isPast ? "bg-muted/10 opacity-50 border-border/50" : "bg-card hover:bg-muted/30 border-border"}
            ${isToday ? "ring-2 ring-primary ring-inset" : ""}
            ${isSelected ? "ring-2 ring-cyan-500 ring-inset bg-cyan-500/5" : ""}
          `}
        >
          <span className={`text-xs font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
            {d}
          </span>
          
          {!isPast && dayCards.length > 0 && (
            <div className={`mt-auto w-full rounded-md py-1 px-1 sm:px-2 flex items-center justify-between border ${workloadColor}`}>
              <span className="text-xs font-bold">{dayCards.length}</span>
              <span className="text-[10px] hidden sm:inline uppercase font-semibold">cards</span>
            </div>
          )}
        </button>
      );
    }
    
    return days;
  };

  const handleReschedule = async (card: Flashcard, daysOffset: number) => {
    if (isUpdating || !selectedDate) return;
    setIsUpdating(true);
    
    try {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + daysOffset);
      
      const diffTime = Math.abs(newDate.getTime() - today.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      await updateCard(card.id, {
        nextReview: newDate.toISOString(),
        dueInDays: newDate < today ? 0 : diffDays
      });
      
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Failed to reschedule:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRescheduleByDays = async (card: Flashcard, daysStr: string) => {
    const days = parseInt(daysStr);
    if (isUpdating || isNaN(days) || days < 1) return;
    setIsUpdating(true);
    setCustomDateCardId(null);
    setCustomDaysValue(prev => { const copy = { ...prev }; delete copy[card.id]; return copy; });

    try {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + days);
      newDate.setHours(0, 0, 0, 0);

      await updateCard(card.id, {
        nextReview: newDate.toISOString(),
        dueInDays: days,
      });

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Failed to reschedule:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const selectedDateStr = selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` : "";
  const selectedCards = selectedDate ? (cardsByDate.get(selectedDateStr) || []) : [];

  return (
    <div className="flex flex-col lg:flex-row h-full w-full max-w-7xl mx-auto">
      {/* Calendar Grid */}
      <div className="flex-1 p-4 md:p-8 flex flex-col min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-cyan-500" />
              Time Travel Calendar
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Visualize your future review workload and drag cards to lighter days.
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-card border border-border rounded-full p-1">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-full">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="font-semibold w-32 text-center text-sm">
              {monthNames[month]} {year}
            </span>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-full">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-xl overflow-hidden">
          {dayNames.map(day => (
            <div key={day} className="bg-muted p-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
          {renderDays()}
        </div>
      </div>

      {/* Sidebar for Selected Day */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-border bg-card/50 backdrop-blur-md h-full flex flex-col shrink-0"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedCards.length} cards scheduled
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedDate(null)} className="rounded-full">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {selectedCards.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Clock className="w-6 h-6 opacity-50" />
                  </div>
                  <p className="text-sm">No cards scheduled for this day.</p>
                  <p className="text-xs mt-1 opacity-70">Enjoy your free time!</p>
                </div>
              ) : (
                selectedCards.map(card => (
                  <div key={card.id} className="p-3 rounded-xl border border-border bg-background shadow-sm flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm line-clamp-1 flex-1" title={card.title}>
                        {card.title}
                      </span>
                      <Badge variant={card.difficulty} className="text-[10px] px-1.5 py-0 capitalize border-current bg-transparent text-current shrink-0">
                        {card.difficulty}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-border border-dashed">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Reschedule
                        </span>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-6 px-2 text-[10px]"
                            disabled={isUpdating}
                            onClick={() => handleReschedule(card, -1)}
                          >
                            -1d
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-6 px-2 text-[10px]"
                            disabled={isUpdating}
                            onClick={() => handleReschedule(card, 1)}
                          >
                            +1d <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-6 px-2 text-[10px] gap-1 ${customDateCardId === card.id ? "border-cyan-500 text-cyan-500" : ""}`}
                            disabled={isUpdating}
                            onClick={() => setCustomDateCardId(customDateCardId === card.id ? null : card.id)}
                          >
                            <CalendarDays className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {customDateCardId === card.id && (
                        <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                          <input
                            type="number"
                            min="1"
                            autoFocus
                            value={customDaysValue[card.id] || ""}
                            onChange={(e) => setCustomDaysValue(prev => ({ ...prev, [card.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") handleRescheduleByDays(card, customDaysValue[card.id] || ""); }}
                            placeholder="e.g. 5"
                            className="w-16 px-2 py-1 rounded-lg border border-border bg-background text-foreground text-[11px] focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors text-center"
                          />
                          <span className="text-[10px] text-muted-foreground">days</span>
                          <button
                            onClick={() => handleRescheduleByDays(card, customDaysValue[card.id] || "")}
                            disabled={!customDaysValue[card.id] || parseInt(customDaysValue[card.id]) < 1}
                            className="px-2 py-1 rounded-lg bg-cyan-500 text-white text-[10px] font-semibold hover:bg-cyan-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                          >
                            Go
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
