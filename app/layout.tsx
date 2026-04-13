import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Hired",
  description: "AI-assisted job search operating system for structured intake, review, and asset generation.",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <div className="app-frame">{children}</div>
      </body>
    </html>
  );
}
