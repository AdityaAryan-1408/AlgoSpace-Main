const humanDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatHumanDate(input: string | Date | null | undefined) {
  if (!input) return "Never";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return humanDateFormatter.format(date);
}

export function daysFromToday(input: string | Date) {
  const target = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(target.getTime())) return 0;

  const now = new Date();
  const startToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const startTarget = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
  const diff = Math.ceil((startTarget - startToday) / 86_400_000);
  return diff;
}

export function isDueToday(input: string | Date) {
  return daysFromToday(input) <= 0;
}
