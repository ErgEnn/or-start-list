"use client";

import { Button, Card, Input, InputNumber, Modal, Popconfirm, Space, Statistic, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n-client";
import { formatEuro } from "@/lib/money";

type PaymentGroupRow = {
  paymentGroupId: string;
  name: string;
  colorHex: string | null;
  globalPriceOverride: number | null;
  competitorsCount: number;
};

export default function PaymentGroupsPage() {
  const t = useT();
  const router = useRouter();
  const [rows, setRows] = useState<PaymentGroupRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [globalPriceOverride, setGlobalPriceOverrideCents] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState(0);

  const [apiMessage, contextHolder] = message.useMessage();

  async function loadGroups() {
    setLoading(true);
    const response = await fetch("/api/admin/payment-groups", { cache: "no-store" });
    if (!response.ok) {
      apiMessage.error(t("paymentGroups.saveError"));
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as { paymentGroups: PaymentGroupRow[] };
    setRows(payload.paymentGroups);
    setLoading(false);
  }

  useEffect(() => {
    loadGroups();
  }, []);

  function openCreateModal() {
    setGroupName("");
    setColorHex("");
    setGlobalPriceOverrideCents(null);
    setSortOrder(0);
    setModalOpen(true);
  }

  async function createGroup() {
    const name = groupName.trim();
    if (!name) {
      apiMessage.error(t("paymentGroups.invalid"));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/payment-groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          colorHex: colorHex.trim() || null,
          globalPriceOverride,
          sortOrder,
          competitors: [],
        }),
      });

      if (!response.ok) {
        apiMessage.error(t("paymentGroups.saveError"));
        setSaving(false);
        return;
      }

      const body = (await response.json()) as { paymentGroupId: string };
      apiMessage.success(t("paymentGroups.saveSuccess"));
      setModalOpen(false);
      setSaving(false);
      router.push(`/dashboard/payment-groups/${encodeURIComponent(body.paymentGroupId)}/settings`);
    } catch {
      apiMessage.error(t("paymentGroups.saveError"));
      setSaving(false);
    }
  }

  async function deleteGroup(paymentGroupId: string) {
    const response = await fetch(`/api/admin/payment-groups/${encodeURIComponent(paymentGroupId)}`, { method: "DELETE" });
    if (!response.ok) {
      apiMessage.error(t("paymentGroups.deleteError"));
      return;
    }
    apiMessage.success(t("paymentGroups.deleteSuccess"));
    await loadGroups();
  }

  const groupsColumns: ColumnsType<PaymentGroupRow> = [
    { title: t("paymentGroups.name"), dataIndex: "name", key: "name" },
    {
      title: t("paymentGroups.color"),
      dataIndex: "colorHex",
      key: "colorHex",
      width: 150,
      render: (value: string | null) =>
        value ? (
          <Space size={8}>
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                border: "1px solid #d9d9d9",
                backgroundColor: value,
                display: "inline-block",
              }}
            />
            {value}
          </Space>
        ) : (
          "-"
        ),
    },
    {
      title: t("paymentGroups.globalPriceOverride"),
      dataIndex: "globalPriceOverride",
      key: "globalPriceOverride",
      width: 220,
      render: (value: number | null) => formatEuro(value),
    },
    {
      title: t("paymentGroups.competitorsCount"),
      dataIndex: "competitorsCount",
      key: "competitorsCount",
      width: 140,
    },
    {
      title: t("paymentGroups.actions"),
      key: "actions",
      width: 200,
      render: (_, row) => (
        <Space>
          <Button onClick={() => router.push(`/dashboard/payment-groups/${encodeURIComponent(row.paymentGroupId)}/settings`)}>
            {t("paymentGroups.edit")}
          </Button>
          <Popconfirm title={t("paymentGroups.delete")} onConfirm={() => deleteGroup(row.paymentGroupId)}>
            <Button danger>{t("paymentGroups.delete")}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {contextHolder}
      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {t("paymentGroups.title")}
          </Title>
          <Paragraph style={{ margin: 0, color: "#595959" }}>{t("paymentGroups.subtitle")}</Paragraph>
          <Space>
            <Button type="primary" onClick={openCreateModal}>
              {t("paymentGroups.add")}
            </Button>
            <Button onClick={loadGroups}>{t("paymentGroups.refresh")}</Button>
            <Statistic title={t("paymentGroups.total")} value={rows.length} style={{ display: "flex", gap: 8, alignItems: "baseline" }} />
          </Space>
        </Space>
      </Card>

      <Card>
        <Table
          loading={loading}
          rowKey={(row) => row.paymentGroupId}
          dataSource={rows}
          pagination={{ pageSize: 25 }}
          locale={{ emptyText: t("paymentGroups.empty") }}
          columns={groupsColumns}
        />
      </Card>

      <Modal
        width={520}
        open={modalOpen}
        title={t("paymentGroups.modalCreateTitle")}
        okText={t("paymentGroups.save")}
        cancelText={t("paymentGroups.cancel")}
        onOk={createGroup}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={16}>
          <Input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder={t("paymentGroups.name")}
          />
          <Input
            value={colorHex}
            onChange={(event) => setColorHex(event.target.value.toUpperCase())}
            placeholder={t("paymentGroups.color")}
            maxLength={7}
            allowClear
          />
          <Space.Compact style={{ width: "100%" }}>
            <Input style={{ width: 40, pointerEvents: "none", textAlign: "center" }} value="€" readOnly tabIndex={-1} />
            <InputNumber
              value={globalPriceOverride}
              min={0}
              precision={2}
              onChange={(value) => setGlobalPriceOverrideCents(typeof value === "number" ? value : null)}
              placeholder={t("paymentGroups.globalPriceOverride")}
              style={{ width: "100%" }}
            />
          </Space.Compact>
          <InputNumber
            value={sortOrder}
            precision={0}
            onChange={(value) => setSortOrder(typeof value === "number" ? value : 0)}
            placeholder={t("paymentGroups.sortOrder")}
            style={{ width: "100%" }}
            addonBefore={t("paymentGroups.sortOrder")}
          />
        </Space>
      </Modal>
    </Space>
  );
}
