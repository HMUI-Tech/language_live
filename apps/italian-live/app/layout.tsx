import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Italian Live",
  description: "Everyday Italian from A1 to B2.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
