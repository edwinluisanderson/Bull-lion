import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Cinzel, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";

import "./globals.css";

const display = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  variable: "--font-display",
  display: "swap",
});

const reel = Big_Shoulders({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-reel",
  display: "swap",
  adjustFontFallback: false,
});

const readout = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-readout",
  display: "swap",
});

const body = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Bullion Bandit",
  description:
    "A steampunk slot machine that turns live gold, silver, platinum, palladium, and copper spot prices into a melt value.",
};

export const viewport: Viewport = {
  themeColor: "#1a100b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${reel.variable} ${readout.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
