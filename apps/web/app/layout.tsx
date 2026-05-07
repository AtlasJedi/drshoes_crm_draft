import type { Metadata } from "next";
import { Bungee, Permanent_Marker, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fontDisplay = Bungee({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-display" });
const fontMarker  = Permanent_Marker({ weight: "400", subsets: ["latin"], variable: "--font-marker" });
const fontBody    = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-body" });
const fontMono    = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Dr Shoes — naprawy, custom malowanie, kurtki",
  description: "Pracownia szewska i custom painting. Naprawiamy, malujemy, ratujemy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${fontDisplay.variable} ${fontMarker.variable} ${fontBody.variable} ${fontMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
