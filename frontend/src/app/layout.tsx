import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIMOS | Intelligence Monitoring",
  description: "Artificial Intelligence Monitoring and Observation System",
  // Instagram/TikTok CDN (fbcdn.net, tiktokcdn) menolak request yang mengirim
  // header Referer dari origin lain, sehingga foto profil & thumbnail gagal tampil.
  // Hilangkan referrer agar gambar dari CDN sosial media bisa dimuat.
  referrer: "no-referrer"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
