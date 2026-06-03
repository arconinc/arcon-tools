import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface LureOrderEmailDetails {
  lureType: string
  lureName: string
  firstName: string
  lastName: string
  company: string
  email: string
  phone?: string
  quantity: number
  unitPrice: number
  artColors: number
  pantoneColor?: string
  backImprint: boolean
  backColors: number
  estimatedTotal: number
  frontArtworkUrl: string
  backArtworkUrl?: string
  notes?: string
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export async function sendLureOrderConfirmation(details: LureOrderEmailDetails) {
  const { lureType, lureName } = details
  const artSetup = details.artColors * 50
  const locationFee = details.backImprint ? 1 : 0
  const extraColorFee = details.backColors * 0.5
  const base = details.quantity * details.unitPrice

  const html = `
<!DOCTYPE html>
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
            <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:14px">Rapala Logo Lure Order Confirmation</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 24px;font-size:16px;color:#1e293b">
              Hi ${details.firstName},
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6">
              Thank you for your lure order request! We've received your submission and a member of our team will be in touch shortly to confirm your order details and provide a final quote.
            </p>

            <!-- Order Summary -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:28px">
              <tr><td colspan="2" style="background:#f8fafc;padding:12px 20px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Order Summary</td></tr>
              <tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">Company</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;text-align:right;border-top:1px solid #f1f5f9">${details.company}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">Lure Style</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;text-align:right;border-top:1px solid #f1f5f9">${lureName} (${lureType.toUpperCase()})</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">Quantity</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;text-align:right;border-top:1px solid #f1f5f9">${details.quantity.toLocaleString()} units</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">Base (${fmt(details.unitPrice)}/unit)</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;text-align:right;border-top:1px solid #f1f5f9">${fmt(base)}</td>
              </tr>
              ${details.pantoneColor ? `
              <tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">Pantone Color(s)</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;text-align:right;border-top:1px solid #f1f5f9">${details.pantoneColor}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">Art Setup (${details.artColors} color${details.artColors !== 1 ? 's' : ''} × $50)</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;text-align:right;border-top:1px solid #f1f5f9">${fmt(artSetup)}</td>
              </tr>
              ${locationFee > 0 ? `
              <tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">Back Imprint Location</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;text-align:right;border-top:1px solid #f1f5f9">${fmt(locationFee)}</td>
              </tr>` : ''}
              ${extraColorFee > 0 ? `
              <tr>
                <td style="padding:12px 20px;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">Back Imprint Colors (${details.backColors} × $0.50)</td>
                <td style="padding:12px 20px;font-size:14px;color:#1e293b;font-weight:500;text-align:right;border-top:1px solid #f1f5f9">${fmt(extraColorFee)}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:14px 20px;font-size:15px;font-weight:700;color:#6b1e98;border-top:2px solid #e2e8f0">Estimated Total*</td>
                <td style="padding:14px 20px;font-size:15px;font-weight:700;color:#6b1e98;text-align:right;border-top:2px solid #e2e8f0">${fmt(details.estimatedTotal)}</td>
              </tr>
            </table>

            <p style="margin:0 0 28px;font-size:12px;color:#94a3b8;font-style:italic">* This is an estimate. Final pricing confirmed by Arcon includes applicable sales tax and any adjustments based on artwork complexity.</p>

            <!-- Artwork -->
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Artwork Received</p>
            <p style="margin:0 0 4px;font-size:14px;color:#475569">
              ✓ Front imprint art uploaded
            </p>
            ${details.backArtworkUrl ? `<p style="margin:0 0 24px;font-size:14px;color:#475569">✓ Back imprint art uploaded</p>` : `<p style="margin:0 0 24px;font-size:14px;color:#94a3b8">— No back imprint art provided</p>`}

            ${details.notes ? `
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Your Notes</p>
            <p style="margin:0 0 28px;font-size:14px;color:#475569;line-height:1.6;background:#f8fafc;padding:12px 16px;border-radius:6px;border-left:3px solid #e2e8f0">${details.notes}</p>` : ''}

            <!-- What's next -->
            <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:20px 24px;margin-bottom:28px">
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#6b1e98">What happens next?</p>
              <p style="margin:0;font-size:14px;color:#7e22ce;line-height:1.6">Our team will review your order, confirm pricing and artwork, and follow up within 1–2 business days. If you have questions in the meantime, reply to this email directly.</p>
            </div>

            <p style="margin:0;font-size:15px;color:#1e293b">Thanks again,<br><strong>Aaron Wheatcraft</strong><br><span style="color:#64748b">Arcon Inc.</span></p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f1f5f9;text-align:center">
            <p style="margin:0;font-size:12px;color:#94a3b8">Arcon Inc. · arconinc.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL_PERSONAL ?? process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
    to: details.email,
    subject: `Lure Order Received — ${details.company} · ${lureName} (${details.quantity.toLocaleString()} units)`,
    html,
  })
}
