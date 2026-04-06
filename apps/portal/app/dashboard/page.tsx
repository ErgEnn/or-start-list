"use client";

import { Card } from "antd";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import { useT } from "@/lib/i18n-client";

export default function DashboardPage() {
  const t = useT();
  return (
    <Card>
      <Title level={3} style={{ marginTop: 0 }}>
        {t("dashboard.title")}
      </Title>
      <Paragraph>{t("dashboard.welcome")}</Paragraph>
    </Card>
  );
}
