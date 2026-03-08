"use client";

import { CalendarOutlined, DesktopOutlined, HomeOutlined, LogoutOutlined, TableOutlined, TagOutlined, TeamOutlined } from "@ant-design/icons";
import { Button, Layout, Menu } from "antd";
import Title from "antd/es/typography/Title";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { t } from "@/lib/i18n";

const { Header, Sider, Content } = Layout;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
              key: "/dashboard/rental-sis",
              icon: <TagOutlined />,
              label: <Link href="/dashboard/rental-sis">{t("nav.rentalSIs")}</Link>,
            },
            {
              key: "/dashboard/payment-groups",
              icon: <TeamOutlined />,
              label: <Link href="/dashboard/payment-groups">{t("nav.paymentGroups")}</Link>,
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
          <Button icon={<LogoutOutlined />} onClick={() => signOut({ callbackUrl: "/" })}>
            {t("dashboard.signOut")}
          </Button>
        </Header>
        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
