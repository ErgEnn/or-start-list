"use client";

import { Button, Card, Input, InputNumber, Space, message } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n-client";

type PaymentGroupData = {
  paymentGroupId: string;
  name: string;
  colorHex: string | null;
  globalPriceOverride: number | null;
  sortOrder: number;
};

export default function PaymentGroupSettingsPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ paymentGroupId: string }>();
  const paymentGroupId = params.paymentGroupId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [globalPriceOverride, setGlobalPriceOverrideCents] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState(0);
  const [apiMessage, contextHolder] = message.useMessage();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const response = await fetch(`/api/admin/payment-groups/${encodeURIComponent(paymentGroupId)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        apiMessage.error(t("paymentGroups.saveError"));
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as { paymentGroup: PaymentGroupData };
      const group = payload.paymentGroup;
      setGroupName(group.name);
      setColorHex(group.colorHex ?? "");
      setGlobalPriceOverrideCents(group.globalPriceOverride);
      setSortOrder(group.sortOrder);
      setLoading(false);
    }
    load();
  }, [paymentGroupId]);

  async function saveSettings() {
    const name = groupName.trim();
    if (!name) {
      apiMessage.error(t("paymentGroups.invalid"));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/payment-groups/${encodeURIComponent(paymentGroupId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          colorHex: colorHex.trim() || null,
          globalPriceOverride,
          sortOrder,
        }),
      });

      if (!response.ok) {
        apiMessage.error(t("paymentGroups.saveError"));
        setSaving(false);
        return;
      }

      apiMessage.success(t("paymentGroups.saveSuccess"));
      setSaving(false);
    } catch {
      apiMessage.error(t("paymentGroups.saveError"));
      setSaving(false);
    }
  }

  async function deleteGroup() {
    const response = await fetch(`/api/admin/payment-groups/${encodeURIComponent(paymentGroupId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      apiMessage.error(t("paymentGroups.deleteError"));
      return;
    }
    apiMessage.success(t("paymentGroups.deleteSuccess"));
    router.push("/dashboard/payment-groups");
  }

  return (
    <>
      {contextHolder}
      <Card loading={loading}>
        <Space direction="vertical" size={16} style={{ width: "100%", maxWidth: 480 }}>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>{t("paymentGroups.name")}</div>
            <Input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder={t("paymentGroups.name")}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>{t("paymentGroups.color")}</div>
            <Space>
              <Input
                value={colorHex}
                onChange={(event) => setColorHex(event.target.value.toUpperCase())}
                placeholder="#RRGGBB"
                style={{ width: 180 }}
                maxLength={7}
                allowClear
              />
              {colorHex && /^#[0-9A-Fa-f]{6}$/.test(colorHex) && (
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    border: "1px solid #d9d9d9",
                    backgroundColor: colorHex,
                    display: "inline-block",
                  }}
                />
              )}
            </Space>
          </div>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>{t("paymentGroups.globalPriceOverride")}</div>
            <Space.Compact>
              <Input style={{ width: 40, pointerEvents: "none", textAlign: "center" }} value="€" readOnly tabIndex={-1} />
              <InputNumber
                value={globalPriceOverride}
                min={0}
                precision={2}
                onChange={(value) => setGlobalPriceOverrideCents(typeof value === "number" ? value : null)}
                placeholder={t("paymentGroups.globalPriceOverride")}
                style={{ width: 240 }}
              />
            </Space.Compact>
          </div>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>{t("paymentGroups.sortOrder")}</div>
            <InputNumber
              value={sortOrder}
              precision={0}
              onChange={(value) => setSortOrder(typeof value === "number" ? value : 0)}
              style={{ width: 180 }}
            />
          </div>
          <Space>
            <Button type="primary" loading={saving} onClick={saveSettings}>
              {t("paymentGroups.save")}
            </Button>
            <Button danger onClick={deleteGroup}>
              {t("paymentGroups.delete")}
            </Button>
          </Space>
        </Space>
      </Card>
    </>
  );
}
