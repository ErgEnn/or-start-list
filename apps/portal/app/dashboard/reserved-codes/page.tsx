"use client";

import { Button, Card, Form, Input, Modal, Space, Statistic, Switch, Table, message } from "antd";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import { useEffect, useRef, useState } from "react";
import { UploadOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

type ReservedCodeRow = {
  code: string;
  isReserved: boolean;
  competitorId: string | null;
  eolNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
  club: string | null;
  siCard: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function ReservedCodesPage() {
  const [rows, setRows] = useState<ReservedCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingCode, setUpdatingCode] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<{ code: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadRows() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/reserved-codes", { cache: "no-store" });
      const payload = (await response.json()) as { reservedCodes: ReservedCodeRow[] };
      setRows(payload.reservedCodes ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    const values = await form.validateFields();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/reserved-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: values.code }),
      });

      if (response.status === 409) {
        messageApi.error(t("reservedCodes.codeExists"));
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to add code (${response.status})`);
      }

      form.resetFields();
      setIsAddModalOpen(false);
      await loadRows();
      messageApi.success(t("reservedCodes.addSuccess"));
    } catch {
      messageApi.error(t("reservedCodes.addError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCsvImport(file: File) {
    const text = await file.text();
    const codes = text
      .split(/[\r\n,;]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (codes.length === 0) {
      messageApi.warning(t("reservedCodes.importEmpty"));
      return;
    }

    try {
      const response = await fetch("/api/admin/reserved-codes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });

      if (!response.ok) {
        throw new Error(`Import failed (${response.status})`);
      }

      const payload = (await response.json()) as { importedCount: number; totalCount: number };
      messageApi.success(
        t("reservedCodes.importSuccess")
          .replace("{count}", String(payload.importedCount))
          .replace("{total}", String(payload.totalCount)),
      );
      await loadRows();
    } catch {
      messageApi.error(t("reservedCodes.importError"));
    }
  }

  async function handleReservedToggle(row: ReservedCodeRow, nextValue: boolean) {
    setUpdatingCode(row.code);
    try {
      const response = await fetch(`/api/admin/reserved-codes/${encodeURIComponent(row.code)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReserved: nextValue }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update code (${response.status})`);
      }
      setRows((prev) =>
        prev.map((item) =>
          item.code === row.code ? { ...item, isReserved: nextValue, updatedAt: new Date().toISOString() } : item,
        ),
      );
    } catch {
      messageApi.error(t("reservedCodes.updateError"));
    } finally {
      setUpdatingCode(null);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {contextHolder}
      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {t("reservedCodes.title")}
          </Title>
          <Paragraph style={{ margin: 0, color: "#595959" }}>{t("reservedCodes.subtitle")}</Paragraph>
          <Space>
            <Button type="primary" onClick={() => setIsAddModalOpen(true)}>
              {t("reservedCodes.add")}
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
              {t("reservedCodes.importCsv")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleCsvImport(file);
                }
                e.target.value = "";
              }}
            />
            <Button onClick={loadRows}>{t("reservedCodes.refresh")}</Button>
            <Statistic title={t("reservedCodes.total")} value={rows.length} />
          </Space>
        </Space>
      </Card>
      <Card>
        <Table
          loading={loading}
          rowKey={(row) => row.code}
          dataSource={rows}
          pagination={{ pageSize: 25 }}
          locale={{ emptyText: t("reservedCodes.empty") }}
          scroll={{ x: 1200 }}
          columns={[
            { title: t("reservedCodes.code"), dataIndex: "code", key: "code", width: 180 },
            {
              title: t("reservedCodes.isReserved"),
              key: "isReserved",
              width: 160,
              render: (_, row: ReservedCodeRow) => (
                <Switch
                  checked={row.isReserved}
                  loading={updatingCode === row.code}
                  onChange={(nextValue) => handleReservedToggle(row, nextValue)}
                />
              ),
            },
            {
              title: t("reservedCodes.eolNumber"),
              dataIndex: "eolNumber",
              key: "eolNumber",
              width: 140,
              render: (value: string | null) => value ?? "-",
            },
            {
              title: t("reservedCodes.firstName"),
              dataIndex: "firstName",
              key: "firstName",
              width: 160,
              render: (value: string | null) => value ?? "-",
            },
            {
              title: t("reservedCodes.lastName"),
              dataIndex: "lastName",
              key: "lastName",
              width: 160,
              render: (value: string | null) => value ?? "-",
            },
            {
              title: t("reservedCodes.club"),
              dataIndex: "club",
              key: "club",
              width: 180,
              render: (value: string | null) => value ?? "-",
            },
            {
              title: t("reservedCodes.siCard"),
              dataIndex: "siCard",
              key: "siCard",
              width: 140,
              render: (value: string | null) => value ?? "-",
            },
          ]}
        />
      </Card>
      <Modal
        title={t("reservedCodes.modalCreateTitle")}
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
        okText={t("reservedCodes.save")}
        cancelText={t("reservedCodes.cancel")}
      >
        <Form form={form} layout="vertical" disabled={isSubmitting}>
          <Form.Item
            label={t("reservedCodes.code")}
            name="code"
            rules={[
              {
                required: true,
                message: t("reservedCodes.invalid"),
              },
            ]}
          >
            <Input placeholder={t("reservedCodes.codePlaceholder")} autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
