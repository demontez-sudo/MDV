# Team email (Microsoft 365) — one-time admin setup

Each team member connects **their own** Microsoft 365 mailbox in the portal (**Mail** in the menu) and can then read, send and reply to email without leaving the portal. The portal never sees anyone's password, only a Microsoft sign-in token that it stores **encrypted**.

This setup is done once by a Microsoft 365 / Entra admin. Until it is finished, the Mail page shows "Setup needed" and lists what is missing.

## 1. Register the app in Microsoft Entra

1. Go to <https://entra.microsoft.com> → **Identity → Applications → App registrations → New registration**.
2. **Name:** `Maison de Veux Portal Mail`
3. **Supported account types:** *Accounts in this organizational directory only* (single tenant).
4. **Redirect URI:** platform **Web**, value exactly:

   ```
   https://www.maisondeveux.com/admin/api/agent/mail/callback
   ```
5. Click **Register**. On the app's **Overview** page, copy:
   - **Application (client) ID** → this is `MS_CLIENT_ID`
   - **Directory (tenant) ID** → this is `MS_TENANT_ID`

## 2. Permissions

**API permissions → Add a permission → Microsoft Graph → Delegated permissions**, add:

| Permission | Why |
|---|---|
| `openid`, `profile`, `email` | sign-in |
| `offline_access` | stay connected without signing in every hour |
| `User.Read` | show which mailbox is connected |
| `Mail.ReadWrite` | read, mark read, archive and delete **the signed-in person's own** mail |
| `Mail.Send` | send and reply **as the signed-in person** |

These are *delegated*: the app can only act as the person who signed in, on their own mailbox. It cannot read anyone else's mail.

Then click **Grant admin consent for Maison de Veux** so team members aren't asked to approve it individually (and aren't blocked if your tenant restricts user consent).

## 3. Client secret

**Certificates & secrets → New client secret.** Copy the secret **Value** immediately (not the Secret ID); Microsoft only shows it once. This is `MS_CLIENT_SECRET`.

> Secrets expire (24 months at most). Put the expiry date in the calendar: when it lapses, Mail stops working for everyone until a new secret is set in Netlify.

## 4. Netlify environment variables

In Netlify, on the **maison-agent** site → **Site configuration → Environment variables**, add:

| Variable | Value |
|---|---|
| `MS_CLIENT_ID` | Application (client) ID from step 1 |
| `MS_TENANT_ID` | Directory (tenant) ID from step 1 |
| `MS_CLIENT_SECRET` | the secret **Value** from step 3 |
| `MAIL_TOKEN_KEY` | a long random string — generate one with `openssl rand -base64 48` |

Then **trigger a new deploy** so the functions pick them up.

> `MAIL_TOKEN_KEY` encrypts everyone's saved sign-in tokens. Keep it secret and **do not change it** later: changing it makes every saved connection unreadable and everyone has to reconnect.

Optional: `MAIL_REDIRECT_URI` (only if you ever serve the portal from a different address; it must also be registered in step 1).

## 5. Database

In the Supabase SQL editor, run **`agent-portal/docs/sql/2026-10-07-mail-connections.sql`**. It creates the `mail_connections` table, locked so only the server can read or write it.

## 6. Connect

Each team member opens **Mail** in the portal menu → **Connect Microsoft 365** → signs in with their `@maisondeveux.com` account → accepts the permissions. They land back in their inbox.

## What the portal stores and what it can't do

- Stores: the connected address, display name, and the **encrypted** access and refresh tokens. It does **not** store emails; they are fetched live from Microsoft each time.
- Each person sees only their own mailbox. The server uses the signed-in staff member's identity for every request; there is no way to ask for someone else's mail.
- Remote images in emails are blocked by default (tracking pixels); the reader can show them with one click. Email bodies are displayed in a locked-down frame, so scripts in an email can't run.
- A person can **Disconnect** at any time (deletes the stored tokens; the mailbox itself is untouched). Admins can also revoke the app for a user in Entra.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Setup needed" on the Mail page | an env var is missing (the page lists which) or the deploy hasn't run since adding them |
| Microsoft shows `AADSTS50011` (reply URL mismatch) | the Redirect URI in step 1 doesn't exactly match |
| Microsoft shows `AADSTS65001` / "needs admin approval" | click **Grant admin consent** in step 2 |
| "Reconnect your email" | the person changed their password, an admin revoked access, or the secret expired. Reconnecting fixes it (if it affects everyone, check the secret expiry) |
| "That sign-in was started in a different browser" | the sign-in was opened in a different browser or private window than the one that started it; try again in one window |
| "One database step is left" | run the SQL in step 5 |

## Limits (v1)

Attachments up to 3 MB total when sending; downloads up to about 4.5 MB. Plain-text composing (no rich-text editor yet). Mail is fetched on demand and refreshed every minute while the Mail page is open; there is no push notification or menu badge yet.
