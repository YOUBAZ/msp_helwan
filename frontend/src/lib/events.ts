import { apiUrl } from "./api";
import type { PublicEvent } from "./types";

const TZ = "Africa/Cairo";

/** Dates and times are always shown in Cairo time. */
export function formatCairo(iso: string, style: "date" | "time" | "full" | "short" = "full") {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions =
    style === "date"
      ? { timeZone: TZ, weekday: "short", day: "numeric", month: "long", year: "numeric" }
      : style === "time"
        ? { timeZone: TZ, hour: "numeric", minute: "2-digit" }
        : style === "short"
          ? { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }
          : {
              timeZone: TZ,
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            };
  return new Intl.DateTimeFormat("en-GB", opts).format(d);
}

export const coverSrc = (e: Pick<PublicEvent, "coverUrl">) => (e.coverUrl ? apiUrl(e.coverUrl) : null);

/** Free seats, or null when there's no limit. */
export const seatsLeft = (e: PublicEvent) =>
  e.capacity === null ? null : Math.max(0, e.capacity - e.confirmed);

/** Short status label for an event's registration. */
export function registrationLabel(e: PublicEvent): string {
  if (e.cancelled) return "Cancelled";
  if (e.phase !== "upcoming") return e.phase === "live" ? "Happening now" : "Ended";
  if (e.registration === "open") return "Registration open";
  if (e.registration === "waitlist") return "Full: waiting list open";
  return "Registration closed";
}

/** Convert an ISO instant to a value for <input type="datetime-local"> in Cairo time. */
export function toCairoInput(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

/** Convert a Cairo "YYYY-MM-DDTHH:mm" input value to an ISO instant. */
export function fromCairoInput(value: string): string | null {
  if (!value) return null;
  // Guess the UTC instant, then correct by Cairo's offset at that moment.
  const guess = new Date(`${value}:00Z`);
  const shown = new Date(toCairoInput(guess.toISOString()) + ":00Z");
  return new Date(guess.getTime() - (shown.getTime() - guess.getTime())).toISOString();
}
