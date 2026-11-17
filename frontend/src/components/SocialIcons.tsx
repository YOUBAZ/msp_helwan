import { Facebook, Instagram, Linkedin } from "./BrandIcons";
import { site } from "@/data/site";

export const socialLinks = [
  { href: site.socials.facebook, label: "Facebook", Icon: Facebook },
  { href: site.socials.instagram, label: "Instagram", Icon: Instagram },
  { href: site.socials.linkedin, label: "LinkedIn", Icon: Linkedin },
];

export default function SocialIcons({ className }: { className: string }) {
  return (
    <>
      {socialLinks.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          className={className}
        >
          <Icon size={20} />
        </a>
      ))}
    </>
  );
}
