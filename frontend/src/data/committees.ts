import type { LucideIcon } from "lucide-react";
import {
  BrainCircuit,
  Briefcase,
  Calendar,
  CloudCog,
  Database,
  Layout,
  Lock,
  Megaphone,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Users,
  Video,
  Zap,
} from "lucide-react";

export type Committee = {
  name: string;
  icon: LucideIcon;
  description: string;
  tasks: string[];
};

export const technicalCommittees: Committee[] = [
  {
    name: "AI & Data Science",
    icon: BrainCircuit,
    description:
      "Harnessing the power of data and machine learning to build intelligent systems.",
    tasks: [
      "Machine Learning Models",
      "Deep Learning",
      "Data Analysis",
      "Neural Networks",
    ],
  },
  {
    name: "Front End & UI/UX",
    icon: Layout,
    description:
      "Designing and building responsive, high-performance user interfaces with seamless UX.",
    tasks: [
      "React.js Development",
      "UI/UX Design Principles",
      "Responsive Design",
      "API Integration",
    ],
  },
  {
    name: "Back End",
    icon: Database,
    description:
      "Powering applications with secure server-side logic and scalable databases.",
    tasks: [
      "Server-side Logic",
      "Database Management",
      "API Security",
      "Microservices Architecture",
    ],
  },
  {
    name: "Software Testing",
    icon: ShieldCheck,
    description:
      "Ensuring the highest software quality through automated and manual testing.",
    tasks: [
      "Unit & Integration Testing",
      "Bug Tracking",
      "Performance Testing",
      "QA Automation",
    ],
  },
  {
    name: "Native Mobile (Swift/Kotlin)",
    icon: Smartphone,
    description:
      "Developing high-quality native iOS and Android apps using modern languages.",
    tasks: [
      "Swift (iOS Development)",
      "Kotlin (Android Development)",
      "Mobile Architecture",
      "Platform Integration",
    ],
  },
  {
    name: "DevOps & Cloud",
    icon: CloudCog,
    description:
      "Optimizing development lifecycles with cloud infrastructure and automation.",
    tasks: [
      "CI/CD Pipelines",
      "Docker & Kubernetes",
      "Cloud Infrastructure",
      "Automation Scripts",
    ],
  },
  {
    name: "Network & Cyber Security",
    icon: Lock,
    description:
      "Securing digital infrastructures and defending against cyber threats.",
    tasks: [
      "Network Security",
      "Ethical Hacking",
      "Vulnerability Assessment",
      "Data Encryption",
    ],
  },
  {
    name: "Problem Solving",
    icon: Zap,
    description:
      "Developing advanced algorithmic thinking and competitive programming skills.",
    tasks: [
      "Data Structures",
      "Competitive Programming",
      "Complex Algorithms",
      "Logical Reasoning",
    ],
  },
];

export const nonTechnicalCommittees: Committee[] = [
  {
    name: "HR (Human Resources)",
    icon: Users,
    description:
      "Managing human capital and fostering a healthy organizational culture within MSP.",
    tasks: [
      "Recruitment & Onboarding",
      "Evaluation & Probation",
      "Attendance & Discipline",
      "Performance Reviews",
    ],
  },
  {
    name: "PR (Public Relations)",
    icon: Megaphone,
    description:
      "Managing MSP’s reputation, official communication, and representing MSP professionally.",
    tasks: [
      "Image Management",
      "External Communication",
      "CSR Initiatives",
      "Internal Bonding Events",
    ],
  },
  {
    name: "Marketing",
    icon: TrendingUp,
    description:
      "Executing strategies to promote MSP’s brand and events, focusing on growth and engagement.",
    tasks: [
      "Campaign Strategies",
      "Event Promotion",
      "Audience Research",
      "Social Media Growth",
    ],
  },
  {
    name: "Media",
    icon: Video,
    description:
      "Responsible for MSP’s visual identity and producing all visual and digital content.",
    tasks: [
      "Graphic Design",
      "Video Editing",
      "Photography Coverage",
      "Brand Consistency",
    ],
  },
  {
    name: "Event Management",
    icon: Calendar,
    description:
      "Planning, organizing, and executing events from concept to professional completion.",
    tasks: [
      "Logistics & Venue",
      "On-ground Operations",
      "Committee Coordination",
      "Post-event Evaluation",
    ],
  },
  {
    name: "BD (Business Development)",
    icon: Briefcase,
    description:
      "Growing MSP through strategic partnerships and securing financial or in-kind support.",
    tasks: [
      "Sponsors & Partners",
      "Negotiation & Deals",
      "Budget Planning",
      "Partner Relationships",
    ],
  },
];
