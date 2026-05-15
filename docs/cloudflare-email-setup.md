# Cloudflare Email Routing Setup for evident-ai.net

## Overview
Set up free email forwarding so emails to `support@evident-ai.net` (or any address) get forwarded to your personal email.

**Cost:** Free  
**Access:** Your regular email inbox (Gmail, Outlook, etc.)

---

## Step 1: Enable Email Routing in Cloudflare

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain: **evident-ai.net**
3. In the left sidebar, click **Email** → **Email Routing**
4. Click **Get Started** or **Enable Email Routing**
5. Cloudflare will automatically add the required MX and TXT DNS records

---

## Step 2: Add Your Destination Email

1. Go to **Email Routing** → **Destination addresses**
2. Click **Add destination address**
3. Enter your personal email (e.g., `yourname@gmail.com`)
4. Check your personal email inbox for a verification email from Cloudflare
5. Click the verification link

---

## Step 3: Create Email Routes

### Option A: Specific Addresses
1. Go to **Email Routing** → **Routing rules**
2. Click **Create address**
3. Enter the custom address: `support` (becomes `support@evident-ai.net`)
4. Select your verified destination email
5. Click **Save**

Repeat for other addresses like `hello@`, `contact@`, etc.

### Option B: Catch-All (Receive ALL Emails)
1. In **Routing rules**, find **Catch-all address**
2. Toggle it on
3. Select action: **Send to an email**
4. Choose your verified destination email
5. Now ANY address @evident-ai.net forwards to you

---

## Step 4: Send Emails AS Your Custom Domain (Gmail)

To reply from Gmail showing `support@evident-ai.net`:

### Using Gmail's Built-in Method:
1. Open Gmail → Click the gear icon → **See all settings**
2. Go to **Accounts and Import** tab
3. Find "Send mail as" → Click **Add another email address**
4. Enter:
   - Name: `Evident Support` (or your preferred name)
   - Email: `support@evident-ai.net`
   - Uncheck "Treat as an alias"
5. Click **Next Step**
6. For SMTP Server, you'll need a sending service (see below)

### Free SMTP Options for Sending:
- **Brevo (Sendinblue)**: Free tier, 300 emails/day
  - Sign up at brevo.com
  - Get SMTP credentials from Settings → SMTP & API
  - Use in Gmail: smtp-relay.brevo.com, port 587
  
- **Mailgun**: Free tier for testing
- **SendGrid**: 100 emails/day free

---

## Summary

| What | How |
|------|-----|
| Receive emails | Cloudflare Email Routing (free) forwards to your Gmail |
| Read emails | In your normal Gmail inbox |
| Reply as custom domain | Configure Gmail "Send mail as" with free SMTP service |

---

## Suggested Email Addresses for App Store

- `support@evident-ai.net` - For Apple/user support inquiries
- `hello@evident-ai.net` - General contact
- `privacy@evident-ai.net` - Privacy-related inquiries

---

## Troubleshooting

**Emails not arriving?**
- Check spam/junk folder
- Verify MX records are set correctly in Cloudflare DNS
- Ensure destination email is verified in Cloudflare

**Can't send as custom domain?**
- Make sure SMTP credentials are correct
- Check Gmail's "Send mail as" settings
- Some SMTP services require domain verification (SPF/DKIM records)
