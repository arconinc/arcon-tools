export interface GenericEmailParams {
  preheader: string
  heading: string
  greeting: string
  bodyLines: string[]
  ctaText: string
  ctaUrl: string
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderGenericEmail(p: GenericEmailParams): string {
  const bodyHtml = p.bodyLines
    .map(line => `<p style="margin:0 0 14px;font-size:15px;color:#475569;line-height:1.6">${line}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escape(p.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${escape(p.preheader)}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <tr>
          <td style="background:#6b1e98;padding:28px 40px">
            <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:.05em;text-transform:uppercase">Arcon Inc.</p>
            <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:14px">${escape(p.heading)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px">
            <p style="margin:0 0 20px;font-size:16px;color:#1e293b">${escape(p.greeting)}</p>
            ${bodyHtml}
            <table cellpadding="0" cellspacing="0" style="margin:24px 0 8px">
              <tr><td style="background:#6b1e98;border-radius:8px">
                <a href="${encodeURI(p.ctaUrl)}" style="display:inline-block;padding:12px 24px;color:#fff;font-size:15px;font-weight:600;text-decoration:none">${escape(p.ctaText)}</a>
              </td></tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;line-height:1.6">You're receiving this because this activity is relevant to your Arcon Tools account.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 40px;border-top:1px solid #f1f5f9;text-align:center">
            <p style="margin:0;font-size:12px;color:#94a3b8">Arcon Inc. &middot; arconinc.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
