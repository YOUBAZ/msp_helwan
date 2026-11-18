import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { footerLinks } from "@/data/site";
import SocialIcons from "./SocialIcons";
import ContactList from "./ContactList";
import NewsletterForm from "./NewsletterForm";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0f172a] text-slate-300 pt-20 pb-10 border-t border-slate-800">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div className="space-y-6">
            <h3 className="text-3xl font-black text-white tracking-tighter italic">
              MSP <span className="text-orange-600">TECH CLUB</span>
            </h3>
            <p className="text-sm leading-relaxed opacity-70">
              Microsoft Student Partners at Capital University. A community dedicated to
              empowering students through technology, innovation, and leadership.
            </p>
            <div className="flex gap-4">
              <SocialIcons className="p-3 bg-white/5 rounded-xl hover:bg-orange-600 hover:text-white transition-all" />
            </div>
          </div>

          <div className="lg:pl-10">
            <h4 className="text-white font-black uppercase text-xs tracking-[0.2em] mb-8">
              Navigation
            </h4>
            <ul className="space-y-4">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex items-center gap-2 text-sm hover:text-orange-500 transition-colors group"
                  >
                    <ChevronRight
                      size={14}
                      className="text-orange-600 opacity-0 group-hover:opacity-100 transition-all"
                    />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-black uppercase text-xs tracking-[0.2em] mb-8">
              Contact Us
            </h4>
            <ContactList />
          </div>

          <div>
            <h4 className="text-white font-black uppercase text-xs tracking-[0.2em] mb-8">
              Join the Loop
            </h4>
            <p className="text-sm mb-6 opacity-70 italic font-medium">
              Subscribe for latest tech updates &amp; events.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          <p>© {year} MSP Tech Club - Capital University. All Rights Reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms of Use
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
