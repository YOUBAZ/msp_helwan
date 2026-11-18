import { Mail, MapPin, Phone } from "lucide-react";
import { site } from "@/data/site";

const items = [
  { label: "Email", value: site.email, href: `mailto:${site.email}`, Icon: Mail, breakAll: true },
  {
    label: "WhatsApp",
    value: site.whatsapp,
    href: `https://wa.me/${site.whatsappDigits}`,
    Icon: Phone,
  },
  { label: "Location", value: site.location, Icon: MapPin },
];

export default function ContactList({ compactEmail = false }: { compactEmail?: boolean }) {
  return (
    <ul className="space-y-6">
      {items.map(({ label, value, href, Icon, breakAll }) => {
        const cls = `${
          compactEmail && breakAll ? "text-xs lg:text-sm break-all" : "text-sm"
        } text-slate-300`;
        return (
          <li key={label} className="flex items-start gap-4">
            <div className="p-2 bg-white/5 rounded-lg text-orange-600">
              <Icon size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">
                {label}
              </p>
              {href ? (
                <a
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noreferrer" : undefined}
                  className={`${cls} hover:text-orange-500 transition-colors`}
                >
                  {value}
                </a>
              ) : (
                <p className={cls}>{value}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
