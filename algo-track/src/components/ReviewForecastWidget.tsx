import { useMemo } from "react";
import { Calendar } from "lucide-react";
import type { Flashcard } from "@/data";

interface Props {
  cards: Flashcard[];
}

export function ReviewForecastWidget({ cards }: Props) {
  const forecast = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const today = new Date();
    
    cards.forEach(card => {
      // dueInDays represents how many days from *now* it is due.
      // <= 0 means today (or overdue).
      if (card.dueInDays <= 0) counts[0]++;
      else if (card.dueInDays < 7) counts[card.dueInDays]++;
    });

    const labels = ["Today"];
    for (let i = 1; i < 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    }

    return labels.map((label, i) => ({ label, count: counts[i] }));
  }, [cards]);

  const maxCount = Math.max(...forecast.map(f => f.count), 10); // at least 10 scale

  return (
    <div className="rounded-xl border border-border bg-background p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <Calendar className="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">7-Day Forecast</h3>
          <p className="text-xs text-muted-foreground">Upcoming review workload</p>
        </div>
      </div>

      <div className="flex items-end justify-between flex-1 gap-2 pt-4">
        {forecast.map((day, i) => (
          <div key={day.label} className="flex flex-col items-center gap-2 flex-1 group">
            <div className="text-xs font-medium text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              {day.count}
            </div>
            <div className="w-full bg-muted/30 rounded-t-sm relative flex items-end justify-center h-24 overflow-hidden">
              <div 
                className={`w-full rounded-t-sm transition-all duration-500 ${i === 0 ? 'bg-blue-500' : 'bg-blue-500/50 group-hover:bg-blue-400'}`}
                style={{ height: `${(day.count / maxCount) * 100}%` }}
              />
            </div>
            <div className={`text-[10px] font-medium ${i === 0 ? 'text-blue-500 font-bold' : 'text-muted-foreground'}`}>
              {day.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
