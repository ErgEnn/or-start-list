"use client";

import "@ant-design/v5-patch-for-react-19";
import { ConfigProvider, theme } from "antd";
import React from "react";
import { LanguageProvider } from "@/lib/i18n-client";

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            borderRadius: 10,
            colorBgLayout: "#f5f6f8",
          },
        }}
      >
        {children}
      </ConfigProvider>
    </LanguageProvider>
  );
}
