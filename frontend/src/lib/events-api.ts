import { API_URL } from "./api";
import type { EventLists, PublicEvent } from "./types";

/** Server-side fetch, cached for 60 s (pages never wait for the API to wake up). */
export async function fetchEvents(): Promise<EventLists | null> {
  try {
    const res = await fetch(`${API_URL}/events`, { next: { revalidate: 60 } });
    return res.ok ? ((await res.json()) as EventLists) : null;
  } catch {
    return null;
  }
}

export async function fetchEvent(id: string): Promise<PublicEvent | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const res = await fetch(`${API_URL}/events/${id}`, { next: { revalidate: 60 } });
    return res.ok ? ((await res.json()) as PublicEvent) : null;
  } catch {
    return null;
  }
}
