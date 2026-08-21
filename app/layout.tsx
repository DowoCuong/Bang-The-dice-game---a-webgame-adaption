import type { Metadata } from "next";
import "./globals.css";

export function generateMetadata(): Metadata {
  const title = "BANG! Dice — Web Game";
  const description = "Bản web game chiến thuật xúc xắc miền Viễn Tây: đấu bot hoặc chơi phòng riêng 3–8 người.";
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://bang-dice-web-game.dabo-social-7911.chatgpt.site"),
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, images: [{ url: "/og.png", width: 1536, height: 1024 }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
