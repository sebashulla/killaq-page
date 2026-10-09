import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const sans = Manrope({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-playfair", display: "swap" });

export const metadata: Metadata = {
  title: "Killaq Joyería Fina | Joyas de oro y plata en Perú",
  description:
    "Tienda virtual de Killaq Joyería Fina: anillos, collares, aretes y pulseras con diseño atemporal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body className={`${sans.variable} ${serif.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
