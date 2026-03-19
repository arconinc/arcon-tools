import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

const GA_ID = 'G-6FMMVL6CVF'

export const metadata: Metadata = {
  title: 'The Arc',
  description: 'Arcon Solutions Intranet',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { send_page_view: false });
          `}
        </Script>
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
