import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Restormel Keys — Next.js Demo",
  description: "Demo app for Restormel Keys with Next.js App Router",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
