"use client";

import { Card, Space, Tabs } from "antd";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";

export default function EventDetailLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const base = `/dashboard/events/${encodeURIComponent(eventId)}`;

  let activeKey = "basic";
  if (pathname.endsWith("/courses")) {
    activeKey = "courses";
  } else if (pathname.endsWith("/competitors")) {
    activeKey = "competitors";
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {t("events.detailTitle")}
          </Title>
          <Paragraph style={{ margin: 0, color: "#595959" }}>{eventId}</Paragraph>
          <Tabs
            activeKey={activeKey}
            items={[
              {
                key: "basic",
                label: <Link href={`${base}/basic`}>{t("events.basicInfoTab")}</Link>,
              },
              {
                key: "competitors",
                label: <Link href={`${base}/competitors`}>{t("events.competitorsTab")}</Link>,
              },
              {
                key: "courses",
                label: <Link href={`${base}/courses`}>{t("events.coursesTab")}</Link>,
              },
            ]}
          />
        </Space>
      </Card>
      {children}
    </Space>
  );
}
