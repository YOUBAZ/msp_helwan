import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

/**
 * Sends email over SMTP (Gmail, Brevo, Resend, Mailpit...). If SMTP_HOST is
 * not set, email is simply disabled and callers fall back to showing links.
 * Sending never throws: it returns false and logs the error, so a mail
 * problem can't break an invitation or a contact-form submission.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  private readonly transport?: Transporter;
  private readonly from: string;
  /** Club inbox that receives contact-form notifications. */
  readonly notifyTo?: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    this.from =
      config.get<string>('MAIL_FROM') ??
      (user ? `MSP Helwan <${user}>` : 'MSP Helwan <no-reply@localhost>');
    this.notifyTo = config.get<string>('CONTACT_NOTIFY_TO') ?? user;
    if (!host) {
      this.log.warn(
        'SMTP_HOST not set: emails are disabled (links are shown on screen instead).',
      );
      return;
    }
    const port = Number(config.get<string>('SMTP_PORT') ?? 465);
    this.transport = createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass: config.get<string>('SMTP_PASS') } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  get enabled() {
    return !!this.transport;
  }

  async send(mail: Mail): Promise<boolean> {
    if (!this.transport) return false;
    try {
      await this.transport.sendMail({ from: this.from, ...mail });
      this.log.log(`Sent "${mail.subject}" to ${mail.to}`);
      return true;
    } catch (err) {
      this.log.error(
        `Could not send "${mail.subject}" to ${mail.to}: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
