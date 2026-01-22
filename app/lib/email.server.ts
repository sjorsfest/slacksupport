import { Resend } from "resend";
import fs from "node:fs";
import path from "node:path";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendVerificationEmailParams {
  email: string;
  name: string;
  url: string;
}

export async function sendVerificationEmail({
  email,
  name,
  url,
}: SendVerificationEmailParams) {
  const firstName = name?.split(" ")[0] || "there";
  const donkeyImagePath = path.join(process.cwd(), "public", "static", "donkey.png");
  const donkeyImageContent = fs.readFileSync(donkeyImagePath).toString("base64");
  const donkeySupportLogoPath = path.join(
    process.cwd(),
    "public",
    "static",
    "donkey-support.png"
  );
  const donkeySupportLogoContent = fs
    .readFileSync(donkeySupportLogoPath)
    .toString("base64");
  const domain = process.env.NODE_ENV === "production" ? "resend.com" : "resend.dev";

  const res = await resend.emails.send({
    from: `Donkey Support <onboarding@${domain}>`,
    to: email,
    subject: "Verify your email - Donkey Support",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@400;600;700&display=swap');
          </style>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Nunito', 'Segoe UI', sans-serif; background-color: #ffd641;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffd641; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 24px; border: 2px solid #1a1a1a; box-shadow: 4px 4px 0px 0px #1a1a1a;">
                  <!-- Header with Logo -->
                  <tr>
                    <td style="padding: 28px 32px 20px; border-bottom: 1px solid #e2e8f0;">
                      <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                        <tr>
                          <td style="vertical-align: middle; padding-right: 8px;">
                            <img src="cid:donkey-logo" alt="Donkey" width="56" height="56" style="display: block; width: 56px; height: 56px; object-fit: contain;" />
                          </td>
                          <td style="vertical-align: middle;">
                            <img src="cid:donkey-support-logo" alt="Donkey Support" width="220" style="display: block; width: 220px; height: auto;" />
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 32px;">
                      <h2 style="margin: 0 0 16px; font-family: 'Fredoka', 'Nunito', sans-serif; font-size: 24px; font-weight: 600; color: #1f2937;">
                        Hey ${firstName}!
                      </h2>
                      <p style="margin: 0 0 24px; font-size: 16px; line-height: 26px; color: #475569;">
                        Thanks for signing up for Donkey Support! Please verify your email address by clicking the button below.
                      </p>

                      <!-- Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 8px 0 28px;">
                            <a href="${url}" style="display: inline-block; padding: 14px 36px; background-color: #FF4FA3; color: #ffffff; font-family: 'Nunito', sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 12px; border: 2px solid #1a1a1a; box-shadow: 3px 3px 0px 0px #1a1a1a;">
                              Verify Email
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 0 0 16px; font-size: 14px; line-height: 22px; color: #64748b;">
                        If you didn't create an account, you can safely ignore this email.
                      </p>

                      <p style="margin: 0; font-size: 12px; color: #94a3b8; word-break: break-all;">
                        Or copy and paste this link:<br>
                        <a href="${url}" style="color: #FF4FA3;">${url}</a>
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; background-color: #fef9e7; border-radius: 0 0 22px 22px;">
                      <p style="margin: 0; font-size: 13px; color: #6b7280; font-weight: 500;">
                        Support so simple you'll enjoy it
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    attachments: [
      {
        content: donkeyImageContent,
        filename: "donkey.png",
        contentId: "donkey-logo",
        contentType: "image/png",
      },
      {
        content: donkeySupportLogoContent,
        filename: "donkey-support.png",
        contentId: "donkey-support-logo",
        contentType: "image/png",
      },
    ],
  });
  const { error } = res;
  if (error) {
    console.error("Failed to send verification email:", error);
    throw new Error("Failed to send verification email");
  }
}
