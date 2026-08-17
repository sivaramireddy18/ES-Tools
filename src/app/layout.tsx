import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import ClientProviders from "@/components/ClientProviders";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Embedded Systems Validation Bench",
  description:
    "Post-silicon validation station for embedded firmware testing. Real-time logic analyzer, GPIO visualization, and WASM-based microcontroller simulation.",
  icons: {
    icon: "/favicon.svg",
  },
  keywords: [
    "embedded systems",
    "validation bench",
    "logic analyzer",
    "firmware testing",
    "WASM",
    "STM32",
    "GPIO",
    "oscilloscope",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-screen overflow-hidden">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} h-screen overflow-hidden bg-[#060709] text-zinc-100 antialiased`}
      >
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
