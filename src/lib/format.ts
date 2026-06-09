export const formatDate = (date?: Date | null) =>
  date ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "Не задан";

export const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
