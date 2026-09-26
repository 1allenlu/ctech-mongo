import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PolicyPilot",
  description: "A self-evolving training copilot for junior health-insurance reviewers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
