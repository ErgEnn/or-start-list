"use client";

import { CalendarOutlined, CompassOutlined, DesktopOutlined, HomeOutlined, LogoutOutlined, TableOutlined, TagOutlined, TeamOutlined } from "@ant-design/icons";
import { Button, Layout, Menu, Select, Space } from "antd";
import Title from "antd/es/typography/Title";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { useLocale, useT } from "@/lib/i18n-client";
import type { Locale } from "@/lib/i18n";

const { Header, Sider, Content } = Layout;

const localeOptions: Array<{ label: string; value: Locale }> = [
  { label: "EN", value: "en" },
  { label: "ET", value: "et" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const { locale, setLocale } = useLocale();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="light" width={250}>
        <div style={{ padding: 20 }}>
          <Title level={4} style={{ margin: 0 }}>
            {t("dashboard.title")}
          </Title>
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[pathname]}
          items={[
            {
              key: "/dashboard",
              icon: <HomeOutlined />,
              label: <Link href="/dashboard">{t("nav.dashboard")}</Link>,
            },
            {
              key: "/dashboard/competitors",
              icon: <TableOutlined />,
              label: <Link href="/dashboard/competitors">{t("nav.competitors")}</Link>,
            },
            {
              key: "/dashboard/payment-groups",
              icon: <TeamOutlined />,
              label: <Link href="/dashboard/payment-groups">{t("nav.paymentGroups")}</Link>,
            },
            {
              key: "/dashboard/map-preferences",
              icon: <CompassOutlined />,
              label: <Link href="/dashboard/map-preferences">{t("nav.mapPreferences")}</Link>,
            },
            {
              key: "/dashboard/competition-groups",
              icon: <TableOutlined />,
              label: <Link href="/dashboard/competition-groups">{t("nav.competitionGroups")}</Link>,
            },
            {
              key: "/dashboard/reserved-codes",
              icon: <TagOutlined />,
              label: <Link href="/dashboard/reserved-codes">{t("nav.reservedCodes")}</Link>,
            },
            {
              key: "/dashboard/devices",
              icon: <DesktopOutlined />,
              label: <Link href="/dashboard/devices">{t("nav.devices")}</Link>,
            },
            {
              key: "/dashboard/events",
              icon: <CalendarOutlined />,
              label: <Link href="/dashboard/events">{t("nav.events")}</Link>,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e6e6e6",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            paddingInline: 20,
          }}
        >
          <Space>
            <Select
              value={locale}
              onChange={setLocale}
              options={localeOptions}
              variant="borderless"
              style={{ width: 70 }}
            />
            <Button icon={<LogoutOutlined />} onClick={() => signOut({ callbackUrl: "/" })}>
              {t("dashboard.signOut")}
            </Button>
          </Space>
        </Header>
        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
