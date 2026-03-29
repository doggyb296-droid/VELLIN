import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VELLIN",
  description: "A premium focus and screen-time recovery app.",
  icons: {
    icon: "/vellin-mark.svg",
    shortcut: "/vellin-mark.svg",
    apple: "/vellin-mark.svg",
  },
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
