import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "../components/auth";
import { portal } from "../lib/portal";
import "../styles/css/bootstrap.min.css";
import "../styles/css/paper-dashboard.min.css";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: `kGamify ${portal.title}`, template: "%s | kGamify" },
  description: `kGamify ${portal.title} portal`,
  icons: { icon: "/brand/favicon.png" },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
