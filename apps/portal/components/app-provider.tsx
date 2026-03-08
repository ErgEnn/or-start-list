"use client";

import "@ant-design/v5-patch-for-react-19";
import { ConfigProvider, theme } from "antd";
import React from "react";

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
