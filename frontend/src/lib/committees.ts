import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  BrainCircuit,
  Briefcase,
  Calendar,
  Camera,
  CloudCog,
  Code,
  Cpu,
  Database,
  Gamepad2,
  Globe,
  HeartHandshake,
  Layout,
  Lock,
  Megaphone,
  Palette,
  PenTool,
  ShieldCheck,
  Smartphone,
  Star,
  TrendingUp,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { API_URL } from "@/lib/api";
import type { CommitteesView } from "@/lib/types";

/** Icon keys stored by the API, in the order the picker shows them. */
export const COMMITTEE_ICONS: Record<string, LucideIcon> = {
  brain: BrainCircuit,
  layout: Layout,
  database: Database,
  shield: ShieldCheck,
  smartphone: Smartphone,
  cloud: CloudCog,
  lock: Lock,
  zap: Zap,
  code: Code,
  cpu: Cpu,
  gamepad: Gamepad2,
  globe: Globe,
  users: Users,
  megaphone: Megaphone,
  trending: TrendingUp,
  video: Video,
  calendar: Calendar,
  briefcase: Briefcase,
  palette: Palette,
  pen: PenTool,
  camera: Camera,
  heart: HeartHandshake,
  book: BookOpen,
  star: Star,
};

export const committeeIcon = (key: string): LucideIcon => COMMITTEE_ICONS[key] ?? Users;

export const TRACK_LABEL = { technical: "Technical", non_technical: "Non-technical" } as const;

/** Public committees (cached for a minute like the Events page); null if the API is down. */
export async function fetchCommittees(season?: number): Promise<CommitteesView | null> {
  try {
    const q = season ? `?season=${season}` : "";
    const res = await fetch(`${API_URL}/committees${q}`, { next: { revalidate: 60 } });
    // A season that doesn't exist (or isn't public): show the default view.
    if (res.status === 404 && season) return fetchCommittees();
    if (!res.ok) return null;
    return (await res.json()) as CommitteesView;
  } catch {
    return null;
  }
}
