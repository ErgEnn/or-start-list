"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, InputNumber, Space, message } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n-client";

type CourseFormItem = {
  courseId?: string;
  name: string;
  lengthKm?: number | null;
  coursePoints?: number | null;
};

type CourseFormValues = {
  courses: CourseFormItem[];
};

type CoursesPayload = {
  courses: Array<{
    courseId: string;
    name: string;
    lengthKm: number | null;
    coursePoints: number | null;
  }>;
};

export default function EventCoursesPage() {
  const t = useT();
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const eventId = params.eventId;
  const [form] = Form.useForm<CourseFormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiMessage, contextHolder] = message.useMessage();

  async function loadCourses() {
    setLoading(true);
    const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/courses`, { cache: "no-store" });
    if (!response.ok) {
      apiMessage.error(t("events.detailLoadError"));
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as CoursesPayload;
    form.setFieldsValue({ courses: payload.courses });
    setLoading(false);
  }

  async function saveCourses() {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/courses`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courses: (values.courses ?? []).map((item) => ({
            courseId: item.courseId,
            name: item.name,
            lengthKm: item.lengthKm ?? null,
            coursePoints: item.coursePoints ?? null,
          })),
        }),
      });

      if (!response.ok) {
        apiMessage.error(t("events.updateError"));
        setSaving(false);
        return;
      }

      apiMessage.success(t("events.updateSuccess"));
      await loadCourses();
      router.refresh();
      setSaving(false);
    } catch {
      apiMessage.error(t("events.coursesInvalid"));
      setSaving(false);
    }
  }

  useEffect(() => {
    loadCourses();
  }, [eventId]);

  return (
    <>
      {contextHolder}
      <Card loading={loading}>
        <Space direction="vertical" style={{ width: "100%" }} size={16}>
          <Form form={form} layout="vertical" initialValues={{ courses: [] }}>
            <Form.List name="courses">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: "100%" }} size={12}>
                  {fields.map((field) => (
                    <Card key={field.key} size="small">
                      <Form.Item name={[field.name, "courseId"]} hidden>
                        <Input />
                      </Form.Item>
                      <Space wrap align="end" style={{ width: "100%" }}>
                        <Form.Item
                          label={t("events.courseName")}
                          name={[field.name, "name"]}
                          rules={[{ required: true, message: t("events.coursesInvalid") }]}
                          style={{ marginBottom: 0, minWidth: 260, flex: 1 }}
                        >
                          <Input placeholder={t("events.courseName")} />
                        </Form.Item>
                        <Form.Item
                          label={t("events.courseLengthKm")}
                          name={[field.name, "lengthKm"]}
                          style={{ marginBottom: 0, width: 180 }}
                        >
                          <InputNumber min={0} precision={3} style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item
                          label={t("events.coursePoints")}
                          name={[field.name, "coursePoints"]}
                          style={{ marginBottom: 0, width: 180 }}
                        >
                          <InputNumber min={0} precision={0} style={{ width: "100%" }} />
                        </Form.Item>
                        <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)}>
                          {t("events.courseRemove")}
                        </Button>
                      </Space>
                    </Card>
                  ))}
                  <Button icon={<PlusOutlined />} onClick={() => add({ name: "", lengthKm: null, coursePoints: null })}>
                    {t("events.courseAdd")}
                  </Button>
                </Space>
              )}
            </Form.List>
          </Form>

          <Space>
            <Button onClick={() => router.push("/dashboard/events")}>{t("events.back")}</Button>
            <Button onClick={loadCourses}>{t("events.refresh")}</Button>
            <Button type="primary" loading={saving} onClick={saveCourses}>
              {t("events.save")}
            </Button>
          </Space>
        </Space>
      </Card>
    </>
  );
}
