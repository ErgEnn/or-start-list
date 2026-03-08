"use client";

import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Statistic, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { formatEuro } from "@/lib/money";

type CompetitionGroupRow = {
  name: string;
  gender: "male" | "female" | null;
  minYear: number | null;
  maxYear: number | null;
  price: number;
  createdAt: string;
  updatedAt: string;
};

type FormValues = {
  name: string;
  gender?: "male" | "female" | null;
  minYear?: number | null;
  maxYear?: number | null;
  price: number;
};

function displayGender(value: "male" | "female" | null) {
  if (value === "male") {
    return t("competitionGroups.genderMale");
  }
  if (value === "female") {
    return t("competitionGroups.genderFemale");
  }
  return "-";
}

function displayNumber(value: number | null) {
  return value === null ? "-" : value;
}

export default function CompetitionGroupsPage() {
  const [rows, setRows] = useState<CompetitionGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<FormValues>();

  async function loadRows() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/competition-groups", { cache: "no-store" });
      const payload = (await response.json()) as { competitionGroups: CompetitionGroupRow[] };
      setRows(payload.competitionGroups ?? []);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingName(null);
    form.setFieldsValue({
      name: "",
      gender: null,
      minYear: null,
      maxYear: null,
      price: 0,
    });
    setModalOpen(true);
  }

  function openEditModal(row: CompetitionGroupRow) {
    setEditingName(row.name);
    form.setFieldsValue({
      name: row.name,
      gender: row.gender,
      minYear: row.minYear,
      maxYear: row.maxYear,
      price: row.price,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const response = await fetch(
        editingName
          ? `/api/admin/competition-groups/${encodeURIComponent(editingName)}`
          : "/api/admin/competition-groups",
        {
          method: editingName ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name.trim(),
            gender: values.gender ?? null,
            minYear: values.minYear ?? null,
            maxYear: values.maxYear ?? null,
            price: values.price,
          }),
        },
      );

      if (response.status === 409) {
        messageApi.error(t("competitionGroups.conflict"));
        return;
      }
      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }

      messageApi.success(t("competitionGroups.saveSuccess"));
      setModalOpen(false);
      form.resetFields();
      await loadRows();
    } catch {
      messageApi.error(t("competitionGroups.saveError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(name: string) {
    try {
      const response = await fetch(`/api/admin/competition-groups/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`Delete failed (${response.status})`);
      }
      messageApi.success(t("competitionGroups.deleteSuccess"));
      await loadRows();
      if (editingName === name) {
        setModalOpen(false);
        setEditingName(null);
        form.resetFields();
      }
    } catch {
      messageApi.error(t("competitionGroups.deleteError"));
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  const columns: ColumnsType<CompetitionGroupRow> = [
    { title: t("competitionGroups.name"), dataIndex: "name", key: "name", width: 240 },
    {
      title: t("competitionGroups.gender"),
      dataIndex: "gender",
      key: "gender",
      width: 140,
      render: (value: "male" | "female" | null) => displayGender(value),
    },
    {
      title: t("competitionGroups.minYear"),
      dataIndex: "minYear",
      key: "minYear",
      width: 120,
      render: (value: number | null) => displayNumber(value),
    },
    {
      title: t("competitionGroups.maxYear"),
      dataIndex: "maxYear",
      key: "maxYear",
      width: 120,
      render: (value: number | null) => displayNumber(value),
    },
    {
      title: t("competitionGroups.price"),
      dataIndex: "price",
      key: "price",
      width: 140,
      render: (value: number) => formatEuro(value),
    },
    {
      title: t("competitionGroups.actions"),
      key: "actions",
      width: 120,
      render: (_, row) => (
        <Popconfirm
          title={t("competitionGroups.deleteTitle")}
          description={t("competitionGroups.deleteDescription")}
          okText={t("competitionGroups.delete")}
          cancelText={t("competitionGroups.cancel")}
          onConfirm={() => handleDelete(row.name)}
        >
          <Button
            danger
            size="small"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {t("competitionGroups.delete")}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {contextHolder}
      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {t("competitionGroups.title")}
          </Title>
          <Paragraph style={{ margin: 0, color: "#595959" }}>{t("competitionGroups.subtitle")}</Paragraph>
          <Space>
            <Button type="primary" onClick={openAddModal}>
              {t("competitionGroups.add")}
            </Button>
            <Button onClick={loadRows}>{t("competitionGroups.refresh")}</Button>
            <Statistic title={t("competitionGroups.total")} value={rows.length} />
          </Space>
        </Space>
      </Card>

      <Card>
        <Table
          loading={loading}
          rowKey={(row) => row.name}
          dataSource={rows}
          pagination={{ pageSize: 25 }}
          locale={{ emptyText: t("competitionGroups.empty") }}
          columns={columns}
          onRow={(row) => ({
            onClick: () => openEditModal(row),
            style: { cursor: "pointer" },
          })}
        />
      </Card>

      <Modal
        title={editingName ? t("competitionGroups.modalEditTitle") : t("competitionGroups.modalCreateTitle")}
        open={modalOpen}
        onOk={handleSave}
        confirmLoading={submitting}
        okText={t("competitionGroups.save")}
        cancelText={t("competitionGroups.cancel")}
        onCancel={() => {
          if (submitting) {
            return;
          }
          setModalOpen(false);
          setEditingName(null);
          form.resetFields();
        }}
        footer={(_, { OkBtn, CancelBtn }) => (
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between" }}>
            <span>
              {editingName ? (
                <Popconfirm
                  title={t("competitionGroups.deleteTitle")}
                  description={t("competitionGroups.deleteDescription")}
                  okText={t("competitionGroups.delete")}
                  cancelText={t("competitionGroups.cancel")}
                  onConfirm={() => handleDelete(editingName)}
                >
                  <Button danger>{t("competitionGroups.delete")}</Button>
                </Popconfirm>
              ) : null}
            </span>
            <Space>
              <CancelBtn />
              <OkBtn />
            </Space>
          </div>
        )}
      >
        <Form form={form} layout="vertical" disabled={submitting}>
          <Form.Item
            label={t("competitionGroups.name")}
            name="name"
            rules={[{ required: true, message: t("competitionGroups.nameRequired") }]}
          >
            <Input autoFocus placeholder={t("competitionGroups.namePlaceholder")} />
          </Form.Item>
          <Form.Item label={t("competitionGroups.gender")} name="gender">
            <Select
              allowClear
              placeholder={t("competitionGroups.genderPlaceholder")}
              options={[
                { label: t("competitionGroups.genderMale"), value: "male" },
                { label: t("competitionGroups.genderFemale"), value: "female" },
              ]}
            />
          </Form.Item>
          <Space wrap style={{ width: "100%" }}>
            <Form.Item label={t("competitionGroups.minYear")} name="minYear">
              <InputNumber
                style={{ width: 180 }}
                precision={0}
                placeholder={t("competitionGroups.minYearPlaceholder")}
                min={0}
              />
            </Form.Item>
            <Form.Item label={t("competitionGroups.maxYear")} name="maxYear">
              <InputNumber
                style={{ width: 180 }}
                precision={0}
                placeholder={t("competitionGroups.maxYearPlaceholder")}
                min={0}
              />
            </Form.Item>
            <Form.Item
              label={t("competitionGroups.price")}
              name="price"
              rules={[{ required: true, message: t("competitionGroups.priceRequired") }]}
            >
              <InputNumber
                style={{ width: 180 }}
                precision={2}
                min={0}
                addonBefore="\u20ac"
                placeholder={t("competitionGroups.price")}
              />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Space>
  );
}
