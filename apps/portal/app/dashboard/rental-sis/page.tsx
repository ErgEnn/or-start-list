"use client";

import { Button, Card, Form, Input, Modal, Space, Statistic, Table, message } from "antd";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

type RentalSiRow = {
  code: string;
  createdAt: string;
  updatedAt: string;
};

export default function RentalSisPage() {
  const [rows, setRows] = useState<RentalSiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingCode, setRemovingCode] = useState<string | null>(null);
  const [messageApi, messageContextHolder] = message.useMessage();
  const [form] = Form.useForm<{ code: string }>();

  async function loadRows() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/rental-sis", { cache: "no-store" });
      const payload = (await response.json()) as { rentalSis?: RentalSiRow[] };
      setRows(payload.rentalSis ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    const values = await form.validateFields();
    const code = values.code.trim();
    if (!code) {
      messageApi.error(t("rentalSIs.addInvalid"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/rental-sis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (response.status === 409) {
        messageApi.error(t("rentalSIs.addConflict"));
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to add SI code (${response.status})`);
      }

      form.resetFields();
      setIsAddModalOpen(false);
      await loadRows();
      messageApi.success(t("rentalSIs.addSuccess"));
    } catch {
      messageApi.error(t("rentalSIs.addError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function openRemoveModal(row: RentalSiRow) {
    Modal.confirm({
      title: t("rentalSIs.removeTitle"),
      content: `${t("rentalSIs.removeDescription")} (${row.code})`,
      okText: t("rentalSIs.removeOk"),
      cancelText: t("rentalSIs.removeCancel"),
      okButtonProps: { danger: true, loading: removingCode === row.code },
      onOk: async () => {
        setRemovingCode(row.code);
        try {
          const response = await fetch(`/api/admin/rental-sis/${encodeURIComponent(row.code)}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            throw new Error(`Failed to remove SI code (${response.status})`);
          }
          messageApi.success(t("rentalSIs.removeSuccess"));
          await loadRows();
        } catch {
          messageApi.error(t("rentalSIs.removeError"));
        } finally {
          setRemovingCode(null);
        }
      },
    });
  }

  useEffect(() => {
    loadRows();
  }, []);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {messageContextHolder}
      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {t("rentalSIs.title")}
          </Title>
          <Paragraph style={{ margin: 0, color: "#595959" }}>{t("rentalSIs.subtitle")}</Paragraph>
          <Space>
            <Button type="primary" onClick={() => setIsAddModalOpen(true)}>
              {t("rentalSIs.add")}
            </Button>
            <Button onClick={loadRows}>{t("rentalSIs.refresh")}</Button>
            <Statistic title={t("rentalSIs.total")} value={rows.length} style={{ display: "flex", gap: 8, alignItems: "baseline" }} />
          </Space>
        </Space>
      </Card>

      <Card>
        <Table
          loading={loading}
          rowKey={(row) => row.code}
          dataSource={rows}
          pagination={{ pageSize: 25 }}
          locale={{ emptyText: t("rentalSIs.empty") }}
          columns={[
            { title: t("rentalSIs.code"), dataIndex: "code", key: "code" },
            {
              title: t("rentalSIs.actions"),
              key: "actions",
              width: 140,
              render: (_, row: RentalSiRow) => (
                <Button danger onClick={() => openRemoveModal(row)} loading={removingCode === row.code}>
                  {t("rentalSIs.remove")}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={t("rentalSIs.addModalTitle")}
        open={isAddModalOpen}
        onOk={handleAdd}
        confirmLoading={isSubmitting}
        onCancel={() => {
          if (isSubmitting) {
            return;
          }
          setIsAddModalOpen(false);
          form.resetFields();
        }}
        okText={t("rentalSIs.addModalOk")}
        cancelText={t("rentalSIs.addModalCancel")}
      >
        <Form form={form} layout="vertical" disabled={isSubmitting}>
          <Form.Item
            label={t("rentalSIs.code")}
            name="code"
            rules={[
              {
                required: true,
                message: t("rentalSIs.addInvalid"),
              },
            ]}
          >
            <Input autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
