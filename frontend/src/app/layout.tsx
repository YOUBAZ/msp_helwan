import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "MSP Helwan",
    template: "%s | MSP Helwan",
  },
  description:
    "MSP Helwan Tech Club at Helwan University. A community dedicated to empowering students through technology, innovation, and leadership.",
  icons: { icon: "/images/logo.jpeg" },
  openGraph: {
    title: "MSP Helwan Tech Club",
    description:
      "We don't just teach technology; we build the next generation of leaders and innovators at Helwan University.",
    images: ["/images/hero-bg.jpeg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
