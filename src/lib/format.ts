const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function formatDateTime(iso: string): string {
  return `${DATE_TIME.format(new Date(iso))} UTC`;
}

export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Money is held in minor units everywhere; formatting is the only place it becomes a decimal. */
export function formatMoney(cents: number): string {
  return MONEY.format(cents / 100);
}

/** Whole months between a date and now, rendered as an account tenure. */
export function formatTenure(iso: string, now: Date = new Date()): string {
  const start = new Date(iso);
  const months =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - start.getUTCMonth());
  if (months < 1) return "Less than a month";
  if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return remainder === 0
    ? `${years} years`
    : `${years} years, ${remainder} month${remainder === 1 ? "" : "s"}`;
}
