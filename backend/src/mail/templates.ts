import type { Mail } from './mail.service';

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Simple, email-client-safe layout in the club colours. */
export function layout(opts: {
  heading: string;
  paragraphs: string[]; // already-escaped HTML
  button?: { label: string; url: string };
  footnote?: string;
}) {
  const button = opts.button
    ? `<p style="margin:28px 0"><a href="${esc(opts.button.url)}" style="background:#ea580c;color:#ffffff;text-decoration:none;font-weight:800;letter-spacing:1px;text-transform:uppercase;font-size:13px;padding:14px 26px;border-radius:12px;display:inline-block">${esc(opts.button.label)}</a></p>
       <p style="font-size:12px;color:#64748b;word-break:break-all">If the button doesn't work, copy this link into your browser:<br><a href="${esc(opts.button.url)}" style="color:#1e3a8a">${esc(opts.button.url)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:#1e3a8a;padding:22px 32px;color:#ffffff;font-weight:900;font-size:20px;letter-spacing:-0.5px">MSP <span style="color:#f97316">TECH CLUB</span></td></tr>
<tr><td style="height:4px;background:#ea580c"></td></tr>
<tr><td style="padding:32px">
<h1 style="margin:0 0 16px;font-size:22px;color:#1e3a8a">${esc(opts.heading)}</h1>
${opts.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155">${p}</p>`).join('')}
${button}
${opts.footnote ? `<p style="margin-top:24px;font-size:12px;color:#94a3b8">${opts.footnote}</p>` : ''}
</td></tr>
<tr><td style="padding:18px 32px;background:#0f172a;color:#64748b;font-size:11px;letter-spacing:1px;text-transform:uppercase">MSP Tech Club · Capital University</td></tr>
</table></td></tr></table></body></html>`;
}

export function inviteEmail(p: {
  to: string;
  name: string;
  invitedBy: string;
  roles: string[];
  link: string;
}): Mail {
  const roles = p.roles.length ? p.roles.join(', ') : 'Member';
  return {
    to: p.to,
    subject: 'You are invited to join MSP Tech Club',
    html: layout({
      heading: `Welcome to the squad, ${p.name.split(' ')[0]}!`,
      paragraphs: [
        `<b>${esc(p.invitedBy)}</b> invited you to the MSP Tech Club dashboard as <b>${esc(roles)}</b>.`,
        'Click the button below, choose a password, and your account is ready.',
      ],
      button: { label: 'Accept invitation', url: p.link },
      footnote:
        "This link works once and expires in 7 days. If you weren't expecting this, you can ignore this email.",
    }),
    text: `Hi ${p.name},\n\n${p.invitedBy} invited you to the MSP Tech Club dashboard as ${roles}.\nOpen this link, choose a password, and your account is ready:\n\n${p.link}\n\nThe link works once and expires in 7 days.`,
  };
}

export function resetEmail(p: {
  to: string;
  name: string;
  link: string;
}): Mail {
  return {
    to: p.to,
    subject: 'Reset your MSP Tech Club password',
    html: layout({
      heading: 'Reset your password',
      paragraphs: [
        `Hi ${esc(p.name.split(' ')[0])}, use the button below to choose a new password for your MSP Tech Club account.`,
      ],
      button: { label: 'Choose a new password', url: p.link },
      footnote:
        "This link works once and expires in 24 hours. If you didn't ask for this, ignore this email: your password stays the same.",
    }),
    text: `Hi ${p.name},\n\nOpen this link to choose a new password for your MSP Tech Club account:\n\n${p.link}\n\nIt works once and expires in 24 hours. If you didn't ask for this, ignore this email.`,
  };
}

export function contactNotificationEmail(p: {
  to: string;
  name: string;
  email: string;
  message: string;
  dashboardUrl: string;
}): Mail {
  return {
    to: p.to,
    replyTo: `${p.name.replace(/[<>"]/g, '')} <${p.email}>`,
    subject: `New message from ${p.name} (website contact form)`,
    html: layout({
      heading: 'New contact-form message',
      paragraphs: [
        `<b>From:</b> ${esc(p.name)} &lt;${esc(p.email)}&gt;`,
        `<span style="white-space:pre-wrap">${esc(p.message)}</span>`,
        'Reply to this email to answer them directly.',
      ],
      button: { label: 'Open the inbox', url: p.dashboardUrl },
    }),
    text: `New message from ${p.name} <${p.email}>:\n\n${p.message}\n\nReply to this email to answer them directly.\nInbox: ${p.dashboardUrl}`,
  };
}
