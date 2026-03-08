"use client";

import { Alert, Button, Card, Form, Input, Space, Typography } from "antd";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { t } from "@/lib/i18n";

type FormValues = {
  username: string;
  password: string;
};

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(values: FormValues) {
    setError(null);
    setIsPending(true);

    const result = await signIn("credentials", {
      username: values.username,
      password: values.password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    setIsPending(false);
    if (result?.error) {
      setError(t("auth.invalid"));
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <Card style={{ width: 420 }}>
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {t("auth.title")}
          </Typography.Title>
          <Typography.Text type="secondary">{t("auth.subtitle")}</Typography.Text>
        </div>
        {error ? <Alert type="error" message={error} showIcon /> : null}
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label={t("auth.username")}
            name="username"
            rules={[{ required: true, message: t("auth.required") }]}
          >
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item
            label={t("auth.password")}
            name="password"
            rules={[{ required: true, message: t("auth.required") }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={isPending} block>
            {t("auth.submit")}
          </Button>
        </Form>
      </Space>
    </Card>
  );
}
