"use client";

import { Button, Card, Form, Input, Modal, Space, Statistic, Table, message } from "antd";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n-client";

type PersonRow = {
  id: number;
  name: string;
  idCode: string | null;
  ticketCount: number;
};

type TicketRow = {
  id: number;
  ticketCode: string;
  validUntil: string | null;
  purchasableName: string | null;
  purchasablePrice: string | null;
  purchasableCategory: string | null;
};

export default function StebbyPage() {
  const t = useT();
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ticketsModalPerson, setTicketsModalPerson] = useState<PersonRow | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [messageApi, messageContextHolder] = message.useMessage();
  const [form] = Form.useForm<{ apiKey: string }>();

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/stebby", { cache: "no-store" });
      const payload = await response.json();
      setHasApiKey(payload.config?.hasApiKey ?? false);
      setLastSyncedAt(payload.config?.lastSyncedAt ?? null);
      setPersons(payload.persons ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveApiKey() {
    const values = await form.validateFields();
    const apiKey = values.apiKey.trim();
    if (!apiKey) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/stebby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!response.ok) throw new Error("Failed");
      form.resetFields();
      setIsApiKeyModalOpen(false);
      setHasApiKey(true);
      messageApi.success(t("stebby.apiKeySaveSuccess"));
    } catch {
      messageApi.error(t("stebby.apiKeySaveError"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/admin/stebby/sync", { method: "POST" });
      if (!response.ok) throw new Error("Failed");
      await loadData();
      messageApi.success(t("stebby.syncSuccess"));
    } catch {
      messageApi.error(t("stebby.syncError"));
    } finally {
      setIsSyncing(false);
    }
  }

  async function openTicketsModal(person: PersonRow) {
    setTicketsModalPerson(person);
    setTicketsLoading(true);
    setTickets([]);
    try {
      const response = await fetch(`/api/admin/stebby/persons/${person.id}/tickets`, {
        cache: "no-store",
      });
      const payload = await response.json();
      setTickets(payload.tickets ?? []);
    } finally {
      setTicketsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const formattedLastSynced = useMemo(() => {
    if (!lastSyncedAt) return t("stebby.lastSyncedNever");
    return new Date(lastSyncedAt).toLocaleString();
  }, [lastSyncedAt, t]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {messageContextHolder}
      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {t("stebby.title")}
          </Title>
          <Paragraph style={{ margin: 0, color: "#595959" }}>{t("stebby.subtitle")}</Paragraph>
          {!hasApiKey && !loading && (
            <Paragraph style={{ margin: 0, color: "#ff4d4f" }}>{t("stebby.noApiKey")}</Paragraph>
          )}
          <Paragraph style={{ margin: 0, color: "#595959" }}>
            {t("stebby.lastSynced")}: {formattedLastSynced}
          </Paragraph>
          <Space>
            <Button onClick={() => setIsApiKeyModalOpen(true)}>{t("stebby.setApiKey")}</Button>
            <Button type="primary" onClick={handleSync} loading={isSyncing} disabled={!hasApiKey}>
              {t("stebby.syncTickets")}
            </Button>
            <Button onClick={loadData}>{t("stebby.refresh")}</Button>
            <Statistic
              title={t("stebby.totalPersons")}
              value={persons.length}
              style={{ display: "flex", gap: 8, alignItems: "baseline" }}
            />
          </Space>
        </Space>
      </Card>

      <Card>
        <Table
          loading={loading}
          rowKey={(row) => row.id}
          dataSource={persons}
          pagination={{ pageSize: 25 }}
          locale={{ emptyText: t("stebby.empty") }}
          columns={[
            { title: t("stebby.name"), dataIndex: "name", key: "name" },
            { title: t("stebby.idCode"), dataIndex: "idCode", key: "idCode" },
            { title: t("stebby.ticketCount"), dataIndex: "ticketCount", key: "ticketCount", width: 120 },
            {
              title: t("stebby.actions"),
              key: "actions",
              width: 160,
              render: (_, row: PersonRow) => (
                <Button onClick={() => openTicketsModal(row)}>{t("stebby.viewTickets")}</Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={t("stebby.apiKeyModalTitle")}
        open={isApiKeyModalOpen}
        onOk={handleSaveApiKey}
        confirmLoading={isSaving}
        onCancel={() => {
          if (isSaving) return;
          setIsApiKeyModalOpen(false);
          form.resetFields();
        }}
        okText={t("stebby.apiKeySave")}
        cancelText={t("stebby.apiKeyCancel")}
      >
        <Form form={form} layout="vertical" disabled={isSaving}>
          <Form.Item
            label={t("stebby.apiKeyLabel")}
            name="apiKey"
            rules={[{ required: true, message: t("stebby.apiKeyRequired") }]}
          >
            <Input.Password autoFocus />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${t("stebby.ticketsModalTitle")} — ${ticketsModalPerson?.name ?? ""}`}
        open={!!ticketsModalPerson}
        onCancel={() => setTicketsModalPerson(null)}
        footer={null}
        width={800}
      >
        <Table
          loading={ticketsLoading}
          rowKey={(row) => row.id}
          dataSource={tickets}
          pagination={false}
          locale={{ emptyText: t("stebby.ticketsEmpty") }}
          columns={[
            { title: t("stebby.ticketCode"), dataIndex: "ticketCode", key: "ticketCode" },
            {
              title: t("stebby.validUntil"),
              dataIndex: "validUntil",
              key: "validUntil",
              render: (val: string | null) => (val ? new Date(val).toLocaleDateString() : "—"),
            },
            { title: t("stebby.serviceName"), dataIndex: "purchasableName", key: "purchasableName" },
            { title: t("stebby.price"), dataIndex: "purchasablePrice", key: "purchasablePrice" },
            { title: t("stebby.category"), dataIndex: "purchasableCategory", key: "purchasableCategory" },
          ]}
        />
      </Modal>
    </Space>
  );
}
