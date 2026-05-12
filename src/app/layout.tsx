import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor:  '#FF8C00',
  width:       'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title:       '南高祭',
  description: '南高祭 公式サイト',
  appleWebApp: {
    capable:         true,
    statusBarStyle:  'default',
    title:           '南高祭',
  },
  icons: {
    apple: '/nanpen.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
