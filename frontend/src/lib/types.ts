export type RoleRef = { id: string; name: string };

export type Profile = {
  phone: string | null;
  birthday: string | null; // YYYY-MM-DD
  gender: "male" | "female" | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  portfolioUrl: string | null;
  /** Path relative to the API base, or null. */
  avatarUrl: string | null;
  complete: boolean;
};

export type Me = {
  id: string;
  email: string;
  name: string;
  isPresident: boolean;
  roles: RoleRef[];
  permissions: string[];
  profile: Profile;
};

export type Role = {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  memberCount: number;
};

export type PermissionDef = { key: string; group: string; label: string };

export type Member = {
  id: string;
  email: string;
  name: string;
  status: "active" | "disabled";
  createdAt: string;
  lastLoginAt: string | null;
  roles: RoleRef[];
  profile: Profile;
};

export type Invite = {
  id: string;
  email: string;
  name: string;
  roles: RoleRef[];
  invitedBy: string | null;
  expiresAt: string;
  createdAt: string;
};

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
};

export type Subscriber = { id: string; email: string; createdAt: string };

export type Season = {
  id: string;
  number: number;
  name: string;
  status: "draft" | "current" | "archived";
  publishedAt: string | null;
};

export type HierarchyMember = {
  id: string;
  userId: string | null;
  name: string;
  /** API-relative photo path (account holders). */
  avatarUrl: string | null;
  /** Site-relative photo path (people from before accounts existed). */
  imageUrl: string | null;
  linkedinUrl: string | null;
};

export type HierarchyPosition = {
  id: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
  members: HierarchyMember[];
};

export type HierarchyTree = { season: Season; positions: HierarchyPosition[] };

/** "site" = file served by the website; "api" = path relative to the API base. */
export type MediaPhoto = { full: string; small: string; origin: "site" | "api" };

export type MediaItem = {
  id: string;
  kind: "photo" | "video";
  photo?: MediaPhoto;
  video?: {
    provider: "youtube" | "facebook" | "drive";
    embedUrl: string;
    thumbnailUrl: string | null;
    sourceUrl: string;
  };
};

export type MediaAlbum = {
  id: string;
  title: string;
  category: string;
  eventDate: string | null; // YYYY-MM-DD
  published: boolean;
  items: MediaItem[];
};

export type PublicEvent = {
  id: string;
  title: string;
  category: string;
  description: string;
  venue: string;
  startsAt: string;
  endsAt: string | null;
  /** API-relative cover path, or null. */
  coverUrl: string | null;
  partners: string[];
  highlight: string | null;
  mediaAlbumId: string | null;
  phase: "upcoming" | "live" | "past";
  cancelled: boolean;
  capacity: number | null;
  confirmed: number;
  waitlisted: number;
  attendance: number | null;
  registration: "open" | "waitlist" | "closed";
};

export type AdminEvent = PublicEvent & {
  published: boolean;
  registrationOpen: boolean;
  registrationDeadline: string | null;
  manualAttendance: number | null;
  checkedIn: number;
};

export type EventLists = { upcoming: PublicEvent[]; live: PublicEvent[]; past: PublicEvent[] };

export type Ticket = {
  status: "confirmed" | "waitlisted" | "cancelled";
  position: number | null;
  name: string;
  qr: string | null;
  checkedInAt: string | null;
  event: PublicEvent;
};
