import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

/**
 * Thin Nodemailer wrapper.
 *
 * Required env vars:
 *   EMAIL_HOST     – SMTP host  (e.g. smtp.gmail.com)
 *   EMAIL_PORT     – SMTP port  (587 for STARTTLS, 465 for SSL)
 *   EMAIL_USER     – SMTP login
 *   EMAIL_PASS     – SMTP password / app-password
 *   EMAIL_FROM     – "From" address shown to the recipient
 *   FRONTEND_URL   – Base URL of the React app (used to build reset links)
 */
export class EmailService {
  private static readonly transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT ?? 587),
    secure: Number(process.env.EMAIL_PORT ?? 587) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      // Allows SMTP servers that present a self-signed or
      // intermediary certificate (common with Gmail on port 587)
      rejectUnauthorized: false,
    },
  });

  /**
   * Verify the SMTP connection on startup (optional – called from server.ts if desired).
   */
  static async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('EmailService: SMTP connection verified');
    } catch (error) {
      logger.error('EmailService: SMTP verification failed', error);
    }
  }

  /**
   * Send a password-reset email containing a time-limited link.
   *
   * @param email      Recipient address
   * @param username   Displayed in the email body
   * @param resetUrl   Full URL including the raw token as a query param
   */
  static async sendPasswordResetEmail(
    email: string,
    username: string,
    resetUrl: string,
  ): Promise<void> {
    const fromAddress =
      process.env.EMAIL_FROM ?? `CampusLive <noreply@pau.edu.ng>`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reset your CampusLive password</title>
      </head>
      <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
          <tr>
            <td align="center">
              <table width="520" cellpadding="0" cellspacing="0"
                style="background:#ffffff;border-radius:16px;overflow:hidden;
                       box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#2563eb,#0d9488);
                             padding:36px 40px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;
                               letter-spacing:-0.5px;">
                      CampusLive
                    </h1>
                    <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
                      Pan-Atlantic University
                    </p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px 40px 32px;">
                    <h2 style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:600;">
                      Password reset request
                    </h2>
                    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
                      Hi <strong>${username}</strong>,
                    </p>
                    <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">
                      We received a request to reset the password for your CampusLive account.
                      Click the button below to choose a new password. This link is valid for
                      <strong>1 hour</strong>.
                    </p>

                    <!-- CTA Button -->
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding-bottom:28px;">
                          <a href="${resetUrl}"
                            style="display:inline-block;padding:14px 36px;
                                   background:linear-gradient(135deg,#2563eb,#0d9488);
                                   color:#ffffff;font-size:15px;font-weight:600;
                                   text-decoration:none;border-radius:10px;
                                   letter-spacing:0.2px;">
                            Reset my password
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.5;">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:0 0 28px;word-break:break-all;">
                      <a href="${resetUrl}"
                        style="color:#2563eb;font-size:13px;">${resetUrl}</a>
                    </p>

                    <!-- Divider -->
                    <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;" />

                    <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                      If you didn't request a password reset, you can safely ignore this email.
                      Your password will not change.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f8fafc;padding:20px 40px;text-align:center;
                             border-top:1px solid #e2e8f0;">
                    <p style="margin:0;color:#94a3b8;font-size:12px;">
                      © ${new Date().getFullYear()} CampusLive · Pan-Atlantic University ·
                      Km 52 Lekki–Epe Expressway, Lagos
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const text = `
CampusLive – Password Reset

Hi ${username},

We received a request to reset your CampusLive password.
Use the link below to set a new password (valid for 1 hour):

${resetUrl}

If you did not request this, please ignore this email.

— The CampusLive Team
    `.trim();

    await this.transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: 'Reset your CampusLive password',
      text,
      html,
    });

    logger.info(`EmailService: password-reset email sent to ${email}`);
  }
}