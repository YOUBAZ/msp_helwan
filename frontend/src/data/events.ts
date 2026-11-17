const range = (folder: string, count: number) =>
  Array.from({ length: count }, (_, i) => `/images/events/${folder}/${i + 1}.jpg`);

export type Album = { title: string; images: string[]; category: string };

export const albums: Album[] = [
  { title: "Orientation Day 2025", images: range("orientation", 12), category: "Event" },
  { title: "AI Catalyst 2025", images: range("ai", 8), category: "Workshop" },
  {
    title: "Problem Solving Competition 2025",
    images: range("problem", 5),
    category: "Contest",
  },
  { title: "Best Heads & Members 2025", images: range("best", 12), category: "Awards" },
];

export const upcomingEvents = [
  {
    title: "Board Recruitment 2026",
    date: "Active Now",
    location: "Offline / Doki",
    desc: "Join the leadership team of MSP Helwan. We are looking for passionate Heads and Vices for both Technical and Non-Technical wings.",
    type: "Recruitment",
    isLive: true,
  },
  {
    title: "Season Orientation 2026",
    date: "March 1, 2026",
    location: "Main Hall, Helwan University",
    desc: "The official launch of our new season. Discover our tracks, meet the new board, and start your technical journey.",
    type: "Orientation",
    isLive: false,
  },
];

export const pastEvents = [
  {
    title: "AI Catalyst with Dotpy 2025",
    date: "August 22, 2025",
    desc: "A high-impact event focused on accelerating AI adoption and hands-on machine learning innovation.",
    achievement: "200+ Attendees",
  },
  {
    title: "Battery Tech with Schneider Electric 2025",
    date: "July 17, 2025",
    desc: "Exploring sustainable energy solutions and modern battery technologies with industry experts.",
    achievement: "Industry Certification",
  },
  {
    title: "Orientation Day 2025",
    date: "June 23, 2025",
    desc: "Welcoming the previous generation and introducing the Microsoft Student Partners community.",
    achievement: "Community Growth",
  },
];
