"use client";

import { Button, Card, Form, Input, Popconfirm, Space, Statistic, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import { useCallback, useEffect, useState } from "react";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { useT } from "@/lib/i18n-client";

type InfoPageRow = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export default function InfoPagesPage() {
  const t = useT();
  const [rows, setRows] = useState<InfoPageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; content: string } | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<{ title: string }>();

  async function loadRows() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/info-pages", { cache: "no-store" });
      const payload = (await response.json()) as { infoPages: InfoPageRow[] };
      setRows(payload.infoPages ?? []);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    form.setFieldsValue({ title: "" });
    setEditorKey((k) => k + 1);
    setEditing({ id: null, content: "" });
  }

  function openEdit(row: InfoPageRow) {
    form.setFieldsValue({ title: row.title });
    setEditorKey((k) => k + 1);
    setEditing({ id: row.id, content: row.content });
  }

  function closeEditor() {
    setEditing(null);
    form.resetFields();
  }

  const handleContentChange = useCallback((html: string) => {
    setEditing((prev) => prev ? { ...prev, content: html } : prev);
  }, []);

  async function handleSave() {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const response = await fetch(
        editing?.id ? `/api/admin/info-pages/${encodeURIComponent(editing.id)}` : "/api/admin/info-pages",
        {
          method: editing?.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: values.title.trim(), content: editing?.content ?? "" }),
        },
      );
      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }
      messageApi.success(t("infoPages.saveSuccess"));
      closeEditor();
      await loadRows();
    } catch {
      messageApi.error(t("infoPages.saveError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const response = await fetch(`/api/admin/info-pages/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`Delete failed (${response.status})`);
      }
      messageApi.success(t("infoPages.deleteSuccess"));
      if (editing?.id === id) {
        closeEditor();
      }
      await loadRows();
    } catch {
      messageApi.error(t("infoPages.deleteError"));
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  const columns: ColumnsType<InfoPageRow> = [
    { title: t("infoPages.pageTitle"), dataIndex: "title", key: "title" },
    {
      title: t("infoPages.updatedAt"),
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 200,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      key: "actions",
      width: 120,
      render: (_, row) => (
        <Popconfirm
          title={t("infoPages.deleteTitle")}
          description={t("infoPages.deleteDescription")}
          okText={t("infoPages.delete")}
          cancelText={t("infoPages.cancel")}
          onConfirm={() => handleDelete(row.id)}
        >
          <Button
            danger
            size="small"
            onClick={(event) => { event.stopPropagation(); }}
          >
            {t("infoPages.delete")}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      {editing ? (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Title level={3} style={{ margin: 0 }}>
                {editing.id ? t("infoPages.modalEditTitle") : t("infoPages.modalCreateTitle")}
              </Title>
              <Form form={form} layout="vertical" disabled={submitting} style={{ marginTop: 16 }}>
                <Form.Item
                  label={t("infoPages.pageTitle")}
                  name="title"
                  rules={[{ required: true, message: t("infoPages.pageTitle") }]}
                >
                  <Input autoFocus />
                </Form.Item>
                <Form.Item label={t("infoPages.pageContent")}>
                  <SimpleEditor key={editorKey} initialContent={editing.content} onContentChange={handleContentChange} />
                </Form.Item>
              </Form>
              <Space style={{ marginTop: 8 }}>
                <Button type="primary" loading={submitting} onClick={() => void handleSave()}>
                  {t("infoPages.save")}
                </Button>
                <Button disabled={submitting} onClick={closeEditor}>
                  {t("infoPages.cancel")}
                </Button>
                {editing.id && (
                  <Popconfirm
                    title={t("infoPages.deleteTitle")}
                    description={t("infoPages.deleteDescription")}
                    okText={t("infoPages.delete")}
                    cancelText={t("infoPages.cancel")}
                    onConfirm={() => handleDelete(editing.id!)}
                  >
                    <Button danger>{t("infoPages.delete")}</Button>
                  </Popconfirm>
                )}
              </Space>
            </Space>
          </Card>
        </Space>
      ) : (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {t("infoPages.title")}
          </Title>
          <Paragraph style={{ margin: 0, color: "#595959" }}>{t("infoPages.subtitle")}</Paragraph>
          <Space>
            <Button type="primary" onClick={openAdd}>
              {t("infoPages.add")}
            </Button>
            <Button onClick={loadRows}>{t("infoPages.refresh")}</Button>
            <Statistic title={t("infoPages.total")} value={rows.length} style={{ display: "flex", gap: 8, alignItems: "baseline" }} />
          </Space>
        </Space>
      </Card>

      <Card>
        <Table
          loading={loading}
          rowKey={(row) => row.id}
          dataSource={rows}
          pagination={{ pageSize: 25 }}
          locale={{ emptyText: t("infoPages.empty") }}
          columns={columns}
          onRow={(row) => ({
            onClick: () => openEdit(row),
            style: { cursor: "pointer" },
          })}
        />
      </Card>
    </Space>
      )}
    </>
  );
}
