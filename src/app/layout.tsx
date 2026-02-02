import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Awaken Tax CSV | Multi-Chain Transaction Exporter",
  description:
    "Export your crypto wallet transactions to Awaken.tax CSV format for easy tax reporting. Supports Bittensor (TAO) and more chains coming soon.",
  keywords: ["crypto tax", "awaken.tax", "csv export", "bittensor", "tao", "solana", "ethereum", "staking rewards"],
  openGraph: {
    title: "Awaken Tax CSV | Multi-Chain Transaction Exporter",
    description:
      "Export your crypto wallet transactions to Awaken.tax CSV format for easy tax reporting.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Theme detection script - static content, no user input
  const themeScript = `(function(){var s=localStorage.getItem('theme'),d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(s==='dark'||(!s&&d))document.documentElement.classList.add('dark')})()`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
