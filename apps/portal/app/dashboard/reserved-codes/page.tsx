"use client";

import { Button, Card, Descriptions, Form, Input, Modal, Space, Statistic, Switch, Table, message } from "antd";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import { useEffect, useRef, useState } from "react";
import { CopyOutlined, UploadOutlined } from "@ant-design/icons";
import { useT } from "@/lib/i18n-client";

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
  county: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
};

function eolLink(eolNumber: string) {
  return `https://pass.orienteerumine.ee/kood/index.php?act=Muuda&kood=${encodeURIComponent(eolNumber)}`;
}

export default function ReservedCodesPage() {
  const t = useT();
  const [rows, setRows] = useState<ReservedCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingCode, setUpdatingCode] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<ReservedCodeRow | null>(null);
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
            <Statistic title={t("reservedCodes.total")} value={rows.length} style={{ display: "flex", gap: 8, alignItems: "baseline" }} />
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
            {
              title: t("reservedCodes.eolNumber"),
              dataIndex: "eolNumber",
              key: "eolNumber",
              width: 140,
              render: (value: string | null, row: ReservedCodeRow) => {
                const code = value ?? row.code;
                return (
                  <a href={eolLink(code)} target="_blank" rel="noopener noreferrer">
                    {code}
                  </a>
                );
              },
            },
            {
              title: t("reservedCodes.isReserved"),
              key: "isReserved",
              width: 120,
              render: (_, row: ReservedCodeRow) => (
                <Switch
                  checked={row.isReserved}
                  loading={updatingCode === row.code}
                  onChange={(nextValue) => handleReservedToggle(row, nextValue)}
                />
              ),
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
              title: t("reservedCodes.details"),
              key: "details",
              width: 100,
              render: (_, row: ReservedCodeRow) => (
                <Button type="link" onClick={() => setDetailRow(row)}>{t("reservedCodes.details")}</Button>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        title={t("reservedCodes.detailsTitle")}
        open={detailRow !== null}
        onCancel={() => setDetailRow(null)}
        footer={null}
      >
        {detailRow && (
          <Descriptions column={1} bordered size="small">
            {[
              { label: t("reservedCodes.eolNumber"), value: detailRow.eolNumber ?? detailRow.code, link: true },
              { label: t("reservedCodes.firstName"), value: detailRow.firstName },
              { label: t("reservedCodes.lastName"), value: detailRow.lastName },
              { label: t("reservedCodes.dob"), value: detailRow.dob },
              { label: t("reservedCodes.club"), value: detailRow.club },
              { label: t("reservedCodes.siCard"), value: detailRow.siCard },
              { label: t("reservedCodes.county"), value: detailRow.county },
              { label: t("reservedCodes.email"), value: detailRow.email },
            ].map((item) => (
              <Descriptions.Item key={item.label} label={item.label}>
                <Space>
                  {item.link && item.value ? (
                    <a href={eolLink(item.value)} target="_blank" rel="noopener noreferrer">{item.value}</a>
                  ) : (
                    item.value ?? "-"
                  )}
                  {item.value && (
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => { void navigator.clipboard.writeText(item.value!); messageApi.success("Copied"); }}
                    />
                  )}
                </Space>
              </Descriptions.Item>
            ))}
          </Descriptions>
        )}
      </Modal>
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
