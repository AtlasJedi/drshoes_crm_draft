import type { Metadata } from "next";
import {
  Anton,
  Big_Shoulders_Stencil,
  Permanent_Marker,
  Inter_Tight,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

const fontDisplay = Anton({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});
const fontStencil = Big_Shoulders_Stencil({
  weight: ["700", "800"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-stencil",
  display: "swap",
});
const fontMarker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marker",
  display: "swap",
});
const fontBody = Inter_Tight({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});
const fontMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dr Shoes — naprawy, custom malowanie, kurtki",
  description: "Pracownia szewska i custom painting. Naprawiamy, malujemy, ratujemy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [
    fontDisplay.variable,
    fontStencil.variable,
    fontMarker.variable,
    fontBody.variable,
    fontMono.variable,
  ].join(" ");

  return (
    <html lang="pl" className={fontVars}>
      <body>{children}</body>
    </html>
  );
}
