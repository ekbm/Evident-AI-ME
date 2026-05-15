import { Resend } from 'resend';

const REPLY_TO_EMAIL = 'mosesekbote@yahoo.com';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

export async function getResendClientForAlerts() {
  const { apiKey } = await getCredentials();
  const fromEmail = 'Evident Alerts <founder@evident-ai.net>';
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

async function getResendClient() {
  const { apiKey } = await getCredentials();
  // Use verified evident-ai.net domain with founder address
  const fromEmail = 'Moses Ekbote <founder@evident-ai.net>';
  console.log('[Email] Using from address:', fromEmail);
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetLink: string,
  firstName?: string | null
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const greeting = firstName ? `Hi ${firstName}` : 'Hi';
    
    const { data, error } = await client.emails.send({
      from: fromEmail || 'Evident <onboarding@resend.dev>',
      replyTo: REPLY_TO_EMAIL,
      to: toEmail,
      subject: 'Reset Your Evident Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Evident</h1>
          </div>
          
          <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #1e293b;">Password Reset Request</h2>
            
            <p>${greeting},</p>
            
            <p>We received a request to reset your password for your Evident account. Click the button below to set a new password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a>
            </div>
            
            <p style="color: #64748b; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
            
            <p style="color: #64748b; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          </div>
          
          <div style="text-align: center; color: #94a3b8; font-size: 12px;">
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #64748b;">${resetLink}</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
            <p>Evident - Evidence-Based Assistant</p>
          </div>
        </body>
        </html>
      `,
      text: `
${greeting},

We received a request to reset your password for your Evident account.

Click this link to reset your password: ${resetLink}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email.

- The Evident Team
      `.trim()
    });

    if (error) {
      console.error('[Email] Failed to send password reset email:', error);
      return false;
    }

    console.log('[Email] Password reset email sent successfully:', data?.id);
    return true;
  } catch (error) {
    console.error('[Email] Error sending password reset email:', error);
    return false;
  }
}

export async function sendWelcomeEmail(
  toEmail: string,
  firstName?: string | null
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const { data, error } = await client.emails.send({
      from: fromEmail,
      replyTo: REPLY_TO_EMAIL,
      to: toEmail,
      subject: 'Welcome to Evident',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  
  <p>Hi there,</p>
  
  <p>Welcome to Evident — I'm really glad you're here.</p>
  
  <p>A lot of people think the problem with AI is that it's too complex, or that you need to be "good at it" to use it properly.</p>
  
  <p>I don't think that's true.</p>
  
  <p>From what I've seen, the real gap isn't intelligence or ability.<br>
  It's that most of us were never shown what's possible in the first place.</p>
  
  <p>We already have information that matters — in our notes, documents, PDFs, files we save for later.<br>
  What's often missing isn't the content, but a clear and comfortable way to understand it, explore it, and ask questions without feeling lost or unsure.</p>
  
  <p>That's why I built Evident.</p>
  
  <p>You don't need the right words.<br>
  You don't need to know what to ask.<br>
  You don't need to be technical.</p>
  
  <p>You can simply start with what you have.</p>
  
  <p style="margin-top: 24px; font-weight: 600; color: #333;">Here's what you can do with Evident:</p>
  
  <ul style="margin: 16px 0; padding-left: 20px; color: #444;">
    <li style="margin-bottom: 10px;"><strong>Upload any document</strong> — PDFs, Word docs, images, even audio and video files</li>
    <li style="margin-bottom: 10px;"><strong>Ask questions in plain language</strong> — No special prompts needed, just ask naturally</li>
    <li style="margin-bottom: 10px;"><strong>Get answers with citations</strong> — Every answer shows exactly where the information came from</li>
    <li style="margin-bottom: 10px;"><strong>Extract obligations from contracts</strong> — Turn legal documents into clear checklists</li>
    <li style="margin-bottom: 10px;"><strong>Summarise, simplify, or get key points</strong> — Just ask for what you need</li>
  </ul>
  
  <p>As you use Evident, you might notice small moments where you pause and think:<br>
  "I didn't know I could do that."</p>
  
  <p>Those moments are important.<br>
  They're how confidence builds — quietly, naturally, and at your own pace.</p>
  
  <p>Thanks for giving Evident a try.</p>
  
  <p style="margin-top: 24px; margin-bottom: 8px; font-weight: 600; color: #333;">Get started:</p>
  
  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
    <tr>
      <td style="padding-right: 12px;">
        <a href="https://evident-ai.net/full" style="display: inline-block; background-color: #0066cc; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Open Web App</a>
      </td>
      <td>
        <a href="https://apps.apple.com/au/app/evidentai/id6758041735" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Download iOS App</a>
      </td>
    </tr>
  </table>
  <p style="margin: 0; font-size: 13px; color: #888;">Android app coming soon</p>
  
  <p style="margin-top: 32px; color: #555;">— Moses Ekbote<br>
  <span style="color: #888;">Founder, Evident</span></p>
  
</body>
</html>
      `,
      text: `Hi there,

Welcome to Evident — I'm really glad you're here.

A lot of people think the problem with AI is that it's too complex, or that you need to be "good at it" to use it properly.

I don't think that's true.

From what I've seen, the real gap isn't intelligence or ability.
It's that most of us were never shown what's possible in the first place.

We already have information that matters — in our notes, documents, PDFs, files we save for later.
What's often missing isn't the content, but a clear and comfortable way to understand it, explore it, and ask questions without feeling lost or unsure.

That's why I built Evident.

You don't need the right words.
You don't need to know what to ask.
You don't need to be technical.

You can simply start with what you have.

Here's what you can do with Evident:

• Upload any document — PDFs, Word docs, images, even audio and video files
• Ask questions in plain language — No special prompts needed, just ask naturally
• Get answers with citations — Every answer shows exactly where the information came from
• Extract obligations from contracts — Turn legal documents into clear checklists
• Summarise, simplify, or get key points — Just ask for what you need

As you use Evident, you might notice small moments where you pause and think:
"I didn't know I could do that."

Those moments are important.
They're how confidence builds — quietly, naturally, and at your own pace.

Thanks for giving Evident a try.

Get started:
• Web App: https://evident-ai.net/full
• iOS App: https://apps.apple.com/au/app/evidentai/id6758041735
• Android app coming soon

— Moses Ekbote
Founder, Evident`
    });

    if (error) {
      console.error('[Email] Failed to send welcome email:', error);
      return false;
    }

    console.log('[Email] Welcome email sent successfully:', data?.id);
    return true;
  } catch (error) {
    console.error('[Email] Error sending welcome email:', error);
    return false;
  }
}

export async function sendVerificationCodeEmail(
  toEmail: string,
  code: string
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();

    const { data, error } = await client.emails.send({
      from: fromEmail || 'Evident <onboarding@resend.dev>',
      replyTo: REPLY_TO_EMAIL,
      to: toEmail,
      subject: `${code} is your Evident verification code`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Evident</h1>
          </div>
          
          <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 20px; text-align: center;">
            <h2 style="margin-top: 0; color: #1e293b;">Your Verification Code</h2>
            
            <p>Enter this code to sign in to Evident:</p>
            
            <div style="margin: 24px 0;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #2563eb; font-family: monospace;">${code}</span>
            </div>
            
            <p style="color: #64748b; font-size: 14px;">This code expires in 10 minutes.</p>
          </div>
          
          <div style="text-align: center; color: #94a3b8; font-size: 12px;">
            <p>If you didn't request this code, you can safely ignore this email.</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
            <p>Evident - Evidence-Based Assistant</p>
          </div>
        </body>
        </html>
      `,
      text: `Your Evident verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.`
    });

    if (error) {
      console.error('[Email] Failed to send verification code:', error);
      return false;
    }

    console.log('[Email] Verification code sent to', toEmail, ':', data?.id);
    return true;
  } catch (error) {
    console.error('[Email] Error sending verification code:', error);
    return false;
  }
}

export async function sendCouponLimitNotification(
  couponCode: string,
  currentUses: number,
  maxUses: number,
  status: "approaching" | "reached"
) {
  try {
    const { client, fromEmail } = await getResendClient();
    const adminEmail = 'mosesekbote@yahoo.com';
    const remaining = maxUses - currentUses;
    const subject = status === "reached"
      ? `Coupon ${couponCode} has reached its limit (${maxUses}/${maxUses})`
      : `Coupon ${couponCode} is approaching its limit (${currentUses}/${maxUses})`;

    const message = status === "reached"
      ? `The coupon code ${couponCode} has been used ${currentUses} times and reached its maximum limit of ${maxUses}. No more redemptions will be accepted. Consider increasing the limit or creating a new coupon if needed.`
      : `The coupon code ${couponCode} has been used ${currentUses} out of ${maxUses} times. Only ${remaining} uses remaining.`;

    const { data, error } = await client.emails.send({
      from: fromEmail,
      replyTo: REPLY_TO_EMAIL,
      to: adminEmail,
      subject,
      text: `Coupon Usage Alert\n\nCode: ${couponCode}\nUsage: ${currentUses} / ${maxUses}\nStatus: ${status === "reached" ? "LIMIT REACHED" : "Approaching limit"}\nRemaining: ${remaining}\n\n${message}\n\n— Evident System`
    });

    if (error) {
      console.error('[Email] Failed to send coupon limit notification:', error);
      return false;
    }

    console.log(`[Email] Coupon limit notification sent (${status}):`, data?.id);
    return true;
  } catch (error) {
    console.error('[Email] Error sending coupon limit notification:', error);
    return false;
  }
}

export async function sendPilotWarningEmail(
  toEmail: string,
  firstName: string | null,
  daysInactive: number
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    const name = firstName || 'there';

    const { data, error } = await client.emails.send({
      from: fromEmail,
      replyTo: REPLY_TO_EMAIL,
      to: toEmail,
      subject: 'Your Evident Student Pilot access needs attention',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://evident-ai.net/apple-touch-icon.png" alt="Evident" width="48" height="48" style="border-radius: 12px;" />
          </div>
          <h2 style="margin: 0 0 16px; font-size: 20px;">Hi ${name},</h2>
          <p style="color: #444; line-height: 1.6;">We noticed you haven't used Evident for ${daysInactive} days. As part of the Student Pilot Program, we want to make sure active students get the most from their access.</p>
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-weight: 600;">Your pilot access will be suspended in 7 days if there's no activity.</p>
            <p style="margin: 8px 0 0; color: #856404; font-size: 14px;">Don't worry — you'll still keep your standard 60-day free student access.</p>
          </div>
          <p style="color: #444; line-height: 1.6;">To keep your pilot access active, simply log in and try any of these:</p>
          <ul style="color: #444; line-height: 1.8;">
            <li>Upload a study document or lecture slides</li>
            <li>Ask Evi a question about your materials</li>
            <li>Generate flashcards or practice questions</li>
          </ul>
          <div style="text-align: center; margin: 24px 0;">
            <a href="https://evident-ai.net/auth" style="background: #0891b2; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Log in to Evident</a>
          </div>
          <p style="color: #888; font-size: 13px; margin-top: 32px;">— The Evident Team</p>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('[Email] Failed to send pilot warning:', error);
      return false;
    }
    console.log(`[Email] Pilot warning sent to ${toEmail}:`, data?.id);
    return true;
  } catch (error) {
    console.error('[Email] Error sending pilot warning:', error);
    return false;
  }
}

export async function sendPilotSuspensionEmail(
  toEmail: string,
  firstName: string | null
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    const name = firstName || 'there';

    const { data, error } = await client.emails.send({
      from: fromEmail,
      replyTo: REPLY_TO_EMAIL,
      to: toEmail,
      subject: 'Your Evident Student Pilot access has been suspended',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://evident-ai.net/apple-touch-icon.png" alt="Evident" width="48" height="48" style="border-radius: 12px;" />
          </div>
          <h2 style="margin: 0 0 16px; font-size: 20px;">Hi ${name},</h2>
          <p style="color: #444; line-height: 1.6;">Your Evident Student Pilot access has been suspended due to inactivity.</p>
          <div style="background: #f0f9ff; border: 1px solid #0891b2; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #0e7490; font-weight: 600;">You still have your 60-day free student access.</p>
            <p style="margin: 8px 0 0; color: #0e7490; font-size: 14px;">Your standard student plan remains active — you can still use Evident with all the features included in the student tier.</p>
          </div>
          <p style="color: #444; line-height: 1.6;">If you'd like to regain full pilot access, reach out to us and we'll review your request.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="https://evident-ai.net/auth" style="background: #0891b2; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Continue with Student Access</a>
          </div>
          <p style="color: #888; font-size: 13px; margin-top: 32px;">— The Evident Team</p>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('[Email] Failed to send pilot suspension:', error);
      return false;
    }
    console.log(`[Email] Pilot suspension sent to ${toEmail}:`, data?.id);
    return true;
  } catch (error) {
    console.error('[Email] Error sending pilot suspension:', error);
    return false;
  }
}

export async function sendReferralBonusEmail(
  toEmail: string,
  firstName: string | null,
  newStudentEmail: string,
  bonusDays: number,
  referralsUsed: number,
  referralsMax: number,
  newExpiryDate: Date
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    const name = firstName || 'there';
    const referralsLeft = referralsMax - referralsUsed;
    const expiryStr = newExpiryDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const maskedEmail = newStudentEmail.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + b.replace(/./g, '•') + c);

    const referralNote = referralsLeft > 0
      ? `<p style="color: #444; line-height: 1.6;">You have <strong>${referralsLeft} referral${referralsLeft !== 1 ? 's' : ''}</strong> remaining. Keep sharing your code to earn more bonus days!</p>`
      : `<p style="color: #444; line-height: 1.6;">You've used all ${referralsMax} referrals — amazing! You've earned a total of <strong>${referralsUsed * bonusDays} bonus days</strong>.</p>`;

    const { data, error } = await client.emails.send({
      from: fromEmail,
      replyTo: REPLY_TO_EMAIL,
      to: toEmail,
      subject: `+${bonusDays} bonus days earned — a classmate just signed up!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://evident-ai.net/apple-touch-icon.png" alt="Evident" width="48" height="48" style="border-radius: 12px;" />
          </div>
          <h2 style="margin: 0 0 16px; font-size: 20px;">Hi ${name},</h2>
          <p style="color: #444; line-height: 1.6;">Great news! A classmate (${maskedEmail}) just signed up to Evident using your referral code.</p>
          <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; color: #065f46; font-size: 24px; font-weight: 700;">+${bonusDays} days</p>
            <p style="margin: 8px 0 0; color: #065f46; font-size: 14px;">added to your Evident access</p>
          </div>
          <p style="color: #444; line-height: 1.6;">Your new expiry date is <strong>${expiryStr}</strong>.</p>
          ${referralNote}
          <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #666; font-size: 13px;"><strong>Referral progress:</strong> ${referralsUsed}/${referralsMax} used</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="https://evident-ai.net/auth" style="background: #0891b2; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Open Evident</a>
          </div>
          <p style="color: #888; font-size: 13px; margin-top: 32px;">— The Evident Team</p>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('[Email] Failed to send referral bonus email:', error);
      return false;
    }
    console.log(`[Email] Referral bonus email sent to ${toEmail}:`, data?.id);
    return true;
  } catch (error) {
    console.error('[Email] Error sending referral bonus email:', error);
    return false;
  }
}

export async function sendAdminEmail(
  toEmail: string,
  subject: string,
  body: string,
  fromName: string = "Moses",
  trackingId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { apiKey } = await getCredentials();
    const client = new Resend(apiKey);
    const fromEmail = `${fromName} <moses@evident-ai.net>`;

    const trackingPixel = trackingId
      ? `<img src="${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : process.env.REPLIT_DOMAINS ? 'https://' + process.env.REPLIT_DOMAINS.split(',')[0] : ''}/api/email/track/${trackingId}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;opacity:0;" alt="" />`
      : '';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e;">
        ${body.split('\n').map(line => line.trim() ? `<p style="margin: 0 0 12px 0; line-height: 1.6;">${line}</p>` : '').join('')}
        ${trackingPixel}
      </body>
      </html>
    `;

    const { data, error } = await client.emails.send({
      from: fromEmail,
      replyTo: REPLY_TO_EMAIL,
      to: toEmail,
      subject,
      html: htmlBody,
      text: body,
    });

    if (error) {
      console.error('[Email] Admin email failed:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Admin email sent to ${toEmail}:`, data?.id);
    return { success: true };
  } catch (error: any) {
    console.error('[Email] Error sending admin email:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}
