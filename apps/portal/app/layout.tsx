import type { Metadata } from "next";
import React from "react";
import "antd/dist/reset.css";
import "./globals.css";
import { AppProvider } from "@/components/app-provider";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("app.title"),
  description: t("app.description"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
