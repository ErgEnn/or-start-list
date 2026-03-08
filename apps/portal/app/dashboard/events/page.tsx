"use client";

import { Button, Card, Form, Input, Modal, Select, Space, Statistic, Table, message } from "antd";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { t } from "@/lib/i18n";

type EventRow = {
  eventId: string;
  name: string;
  startDate: string | null;
  competitorsCount: number;
};

type EventFormValues = {
  name: string;
  date: string;
};

function getYear(value: string | null) {
  if (!value) {
    return null;
  }
  const match = value.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

function sortByDateAsc(items: EventRow[]) {
  return [...items].sort((a, b) => {
    const aDate = a.startDate ?? "9999-12-31";
    const bDate = b.startDate ?? "9999-12-31";
    if (aDate === bDate) {
      return a.name.localeCompare(b.name);
    }
    return aDate.localeCompare(bDate);
  });
}

export default function EventsPage() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm<EventFormValues>();
  const [apiMessage, contextHolder] = message.useMessage();

  async function loadEvents() {
    setLoading(true);
    const response = await fetch("/api/admin/events", { cache: "no-store" });
    if (!response.ok) {
      apiMessage.error(t("events.createError"));
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as { events: EventRow[] };
    setRows(sortByDateAsc(payload.events));
    setLoading(false);
  }

  const years = useMemo(() => {
    const unique = new Set<number>();
    for (const row of rows) {
      const year = getYear(row.startDate);
      if (year !== null) {
        unique.add(year);
      }
    }
    return Array.from(unique).sort((a, b) => b - a);
  }, [rows]);

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setSelectedYear((previous) => {
      if (previous !== null && years.includes(previous)) {
        return previous;
      }
      if (years.includes(currentYear)) {
        return currentYear;
      }
      return years[0] ?? null;
    });
  }, [years]);

  const filteredRows = useMemo(() => {
    if (selectedYear === null) {
      return [];
    }
    return rows.filter((row) => getYear(row.startDate) === selectedYear);
  }, [rows, selectedYear]);

  async function createEvent() {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      const response = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        apiMessage.error(t("events.createError"));
        setCreating(false);
        return;
      }

      apiMessage.success(t("events.createSuccess"));
      const year = getYear(values.date);
      if (year !== null) {
        setSelectedYear(year);
      }
      setModalOpen(false);
      createForm.resetFields();
      await loadEvents();
      setCreating(false);
    } catch {
      apiMessage.error(t("events.createInvalid"));
      setCreating(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {contextHolder}
      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {t("events.title")}
          </Title>
          <Paragraph style={{ margin: 0, color: "#595959" }}>{t("events.subtitle")}</Paragraph>
          <Space wrap>
            <Select
              value={selectedYear ?? undefined}
              onChange={(value) => setSelectedYear(value)}
              placeholder={t("events.year")}
              style={{ width: 160 }}
              options={years.map((year) => ({ label: String(year), value: year }))}
            />
            <Button type="primary" onClick={() => setModalOpen(true)}>
              {t("events.add")}
            </Button>
            <Button onClick={loadEvents}>{t("events.refresh")}</Button>
            <Statistic title={t("events.total")} value={filteredRows.length} />
          </Space>
        </Space>
      </Card>
      <Card>
        <Table
          loading={loading}
          rowKey={(row) => row.eventId}
          dataSource={filteredRows}
          pagination={{ pageSize: 25 }}
          locale={{ emptyText: t("events.empty") }}
          columns={[
            { title: t("events.name"), dataIndex: "name", key: "name" },
            { title: t("events.date"), dataIndex: "startDate", key: "startDate", width: 160 },
            { title: t("events.competitorsCount"), dataIndex: "competitorsCount", key: "competitorsCount", width: 150 },
            {
              title: t("events.actions"),
              key: "actions",
              width: 120,
              render: (_, row: EventRow) => <Link href={`/dashboard/events/${encodeURIComponent(row.eventId)}/basic`}>{t("events.edit")}</Link>,
            },
          ]}
        />
      </Card>
      <Modal
        title={t("events.createTitle")}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          createForm.resetFields();
        }}
        onOk={createEvent}
        okText={t("events.createSubmit")}
        cancelText={t("events.createCancel")}
        confirmLoading={creating}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            label={t("events.createName")}
            name="name"
            rules={[{ required: true, message: t("events.createInvalid") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label={t("events.createDate")}
            name="date"
            rules={[
              { required: true, message: t("events.createInvalid") },
              { pattern: /^\d{4}-\d{2}-\d{2}$/, message: t("events.createInvalid") },
            ]}
          >
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
