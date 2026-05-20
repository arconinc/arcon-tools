import { Resend } from 'resend'
import { SHOWCASE_EVENT, CALENDAR_LINKS } from '@/lib/product-showcase-config'

export { SHOWCASE_EVENT, CALENDAR_LINKS }

const resend = new Resend(process.env.RESEND_API_KEY)

function buildICS(): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Arcon Inc.//Product Showcase 2026//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'DTSTART;TZID=America/Chicago:20260918T110000',
    'DTEND;TZID=America/Chicago:20260918T140000',
    `SUMMARY:${SHOWCASE_EVENT.title}`,
    `LOCATION:${SHOWCASE_EVENT.venue}\\, ${SHOWCASE_EVENT.address}`,
    `DESCRIPTION:${SHOWCASE_EVENT.description.replace(/,/g, '\\,').replace(/\n/g, '\\n')}`,
    'STATUS:CONFIRMED',
    `UID:product-showcase-2026@arconinc.com`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShowcaseRecipient {
  firstName: string
  email: string
}

export interface ShowcaseConfirmationDetails {
  company: string
  salesPersonName: string
  categories: string[]
  totalAttendees: number
}

// ---------------------------------------------------------------------------
// Send confirmation email
// ---------------------------------------------------------------------------

export async function sendProductShowcaseConfirmation(
  recipient: ShowcaseRecipient,
  details: ShowcaseConfirmationDetails
): Promise<void> {
  const { firstName, email } = recipient
  const { company, salesPersonName, categories, totalAttendees } = details
  const { title, date, time, venue, address } = SHOWCASE_EVENT

  const categoriesHtml =
    categories.length > 0
      ? `<ul style="margin:8px 0 0;padding-left:20px;list-style:disc">${categories
          .map(
            (c) =>
              `<li style="font-size:14px;color:#475569;margin-bottom:4px">${c}</li>`
          )
          .join('')}</ul>`
      : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">

        <!-- Header -->
        <tr>
          <td style="background:#6b1e98;padding:32px 40px">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:.05em;text-transform:uppercase">Arcon Inc.</p>
            <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:14px">Product Showcase 2026 — Registration Confirmed</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#1e293b">You're in, ${firstName}!</p>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6">
              Your registration for the Arcon Product Showcase 2026 is confirmed. We&rsquo;re excited to see you there — we'll be in touch with more details as the event gets closer.
            </p>

            <!-- Event summary table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:28px">
              <tr>
                <td colspan="2" style="background:#f8fafc;padding:12px 20px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em">
                  Event Details
                </td>
              </tr>
              <tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9;width:130px">Date</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9">${date}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">Time</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9">${time}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">Venue</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9">
                  ${venue}<br>
                  <span style="font-weight:400;color:#64748b">${address}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">Company</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9">${company}</td>
              </tr>
              ${
                totalAttendees > 1
                  ? `<tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">Attendees</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9">${totalAttendees} from ${company}</td>
              </tr>`
                  : ''
              }
              ${
                salesPersonName
                  ? `<tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">Arcon Contact</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9">${salesPersonName}</td>
              </tr>`
                  : ''
              }
              ${
                categories.length > 0
                  ? `<tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9;vertical-align:top">Interests</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;border-top:1px solid #f1f5f9">${categoriesHtml}</td>
              </tr>`
                  : ''
              }
            </table>

            <!-- Add to Calendar -->
            <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:20px 24px;margin-bottom:28px">
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#6b1e98">&#128197; Add to Your Calendar</p>
              <p style="margin:0 0 14px;font-size:14px;color:#7e22ce;line-height:1.6">
                A calendar file (.ics) is attached to this email — open it to add the event to Apple Calendar, Outlook, or any calendar app. You can also use the links below:
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px">
                    <a href="${CALENDAR_LINKS.google}" style="display:inline-block;padding:8px 18px;background:#6b1e98;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">Google Calendar</a>
                  </td>
                  <td>
                    <a href="${CALENDAR_LINKS.outlook}" style="display:inline-block;padding:8px 18px;background:#fff;color:#6b1e98;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;border:1px solid #d8b4fe">Outlook Calendar</a>
                  </td>
                </tr>
              </table>
            </div>

            <!-- What to expect -->
            <div style="margin-bottom:28px">
              <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em">What to expect</p>
              <ul style="margin:0;padding-left:20px">
                <li style="font-size:14px;color:#475569;margin-bottom:6px;line-height:1.5">Hands-on product displays across multiple categories</li>
                <li style="font-size:14px;color:#475569;margin-bottom:6px;line-height:1.5">Live entertainment and a great social atmosphere</li>
                <li style="font-size:14px;color:#475569;margin-bottom:6px;line-height:1.5">Food &amp; drinks provided at Union 32 Craft House</li>
                <li style="font-size:14px;color:#475569;margin-bottom:6px;line-height:1.5">One-on-one time with the Arcon team</li>
                <li style="font-size:14px;color:#475569;line-height:1.5">Giveaways and exclusive showcase specials</li>
              </ul>
            </div>

            <p style="margin:0;font-size:15px;color:#1e293b">See you September 18th!<br><br><strong>The Arcon Team</strong><br><span style="color:#64748b;font-size:14px">Arcon Inc. &middot; arconinc.com</span></p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f1f5f9;text-align:center">
            <p style="margin:0;font-size:12px;color:#94a3b8">
              &copy; ${new Date().getFullYear()} Arcon Inc. &middot;
              <a href="https://www.arconinc.com" style="color:#94a3b8;text-decoration:none">arconinc.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
    to: email,
    subject: `You're registered for the Arcon Product Showcase 2026!`,
    html,
    attachments: [
      {
        filename: 'arcon-product-showcase-2026.ics',
        content: Buffer.from(buildICS()),
      },
    ],
  })
}
