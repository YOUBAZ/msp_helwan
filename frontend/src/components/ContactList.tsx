import { Mail, MapPin, Phone } from "lucide-react";
import { site } from "@/data/site";

const items = [
  { label: "Email", value: site.email, Icon: Mail, breakAll: true },
  { label: "WhatsApp", value: site.whatsapp, Icon: Phone },
  { label: "Location", value: site.location, Icon: MapPin },
];

export default function ContactList({ compactEmail = false }: { compactEmail?: boolean }) {
  return (
    <ul className="space-y-6">
      {items.map(({ label, value, Icon, breakAll }) => (
        <li key={label} className="flex items-start gap-4">
          <div className="p-2 bg-white/5 rounded-lg text-orange-600">
            <Icon size={18} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">
              {label}
            </p>
            <p
              className={`${
                compactEmail && breakAll ? "text-xs lg:text-sm break-all" : "text-sm"
              } text-slate-300`}
            >
              {value}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
