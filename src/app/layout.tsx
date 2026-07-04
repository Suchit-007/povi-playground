import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Outfit, Space_Grotesk } from "next/font/google";
import "./globals.css";

const sansFont = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const displayFont = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const monoFont = Space_Grotesk({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PoVI Playground - Proof of Verifiable Inference",
  description: "Decentralized AI inference logs on the Ethereum blockchain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sansFont.variable} ${displayFont.variable} ${monoFont.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
