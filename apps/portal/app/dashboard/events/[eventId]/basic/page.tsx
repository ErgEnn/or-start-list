"use client";

import { Button, Card, Form, Input, Popconfirm, Space, message } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n-client";

type EventFormValues = {
  name: string;
  date: string;
};

type EventDetailPayload = {
  event: {
    eventId: string;
    name: string;
    startDate: string | null;
  };
};

export default function EventBasicInfoPage() {
  const t = useT();
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const eventId = params.eventId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formValues, setFormValues] = useState<EventFormValues | null>(null);
  const [form] = Form.useForm<EventFormValues>();
  const [apiMessage, contextHolder] = message.useMessage();

  async function loadEvent() {
    setLoading(true);
    const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, { cache: "no-store" });
    if (!response.ok) {
      apiMessage.error(t("events.detailLoadError"));
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as EventDetailPayload;
    const values = {
      name: payload.event.name,
      date: payload.event.startDate ?? "",
    };
    setFormValues(values);
    setLoading(false);
  }

  async function saveBasicInfo() {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        apiMessage.error(t("events.updateError"));
        setSaving(false);
        return;
      }

      apiMessage.success(t("events.updateSuccess"));
      await loadEvent();
      router.refresh();
      setSaving(false);
    } catch {
      apiMessage.error(t("events.createInvalid"));
      setSaving(false);
    }
  }

  async function deleteEvent() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        apiMessage.error(t("events.deleteError"));
        setDeleting(false);
        return;
      }
      apiMessage.success(t("events.deleteSuccess"));
      router.push("/dashboard/events");
    } catch {
      apiMessage.error(t("events.deleteError"));
      setDeleting(false);
    }
  }

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  useEffect(() => {
    if (formValues) {
      form.setFieldsValue(formValues);
    }
  }, [formValues]);

  return (
    <>
      {contextHolder}
      <Card loading={loading || !formValues}>
        {formValues && <Space direction="vertical" style={{ width: "100%" }}>
          <Form form={form} layout="vertical" initialValues={formValues}>
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
          <Space>
            <Button onClick={() => router.push("/dashboard/events")}>{t("events.back")}</Button>
            <Button type="primary" loading={saving} onClick={saveBasicInfo}>
              {t("events.save")}
            </Button>
            <Popconfirm
              title={t("events.deleteTitle")}
              description={t("events.deleteDescription")}
              okText={t("events.delete")}
              cancelText={t("events.deleteCancel")}
              okButtonProps={{ danger: true, loading: deleting }}
              onConfirm={deleteEvent}
            >
              <Button danger loading={deleting}>
                {t("events.delete")}
              </Button>
            </Popconfirm>
          </Space>
        </Space>}
      </Card>
    </>
  );
}
