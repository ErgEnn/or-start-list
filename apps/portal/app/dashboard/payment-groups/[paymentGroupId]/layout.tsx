"use client";

import { Button, Card, Space, Tabs } from "antd";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n-client";

export default function PaymentGroupDetailLayout({ children }: { children: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ paymentGroupId: string }>();
  const paymentGroupId = params.paymentGroupId;
  const base = `/dashboard/payment-groups/${encodeURIComponent(paymentGroupId)}`;
  const [groupName, setGroupName] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/admin/payment-groups/${encodeURIComponent(paymentGroupId)}`, {
        cache: "no-store",
      });
      if (response.ok) {
        const payload = (await response.json()) as { paymentGroup: { name: string } };
        setGroupName(payload.paymentGroup.name);
      }
    }
    load();
  }, [paymentGroupId]);

  const activeKey = pathname.endsWith("/competitors") ? "competitors" : "settings";

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Button type="link" style={{ padding: 0 }} onClick={() => router.push("/dashboard/payment-groups")}>
            {t("paymentGroups.backToList")}
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            {t("paymentGroups.modalEditTitle")}
          </Title>
          {groupName && <Paragraph style={{ margin: 0, color: "#595959" }}>{groupName}</Paragraph>}
          <Tabs
            activeKey={activeKey}
            items={[
              {
                key: "settings",
                label: <Link href={`${base}/settings`}>{t("paymentGroups.settingsTab")}</Link>,
              },
              {
                key: "competitors",
                label: <Link href={`${base}/competitors`}>{t("paymentGroups.competitorsTab")}</Link>,
              },
            ]}
          />
        </Space>
      </Card>
      {children}
    </Space>
  );
}
