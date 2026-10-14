export function formatMoney(value: string | number, currency = "RUB") {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(date);
}

export function formatPeriod(value: string) {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
}
