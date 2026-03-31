"use client";

import { EyeInvisibleOutlined, EyeOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Input, Space, Statistic, Table } from "antd";
import Paragraph from "antd/es/typography/Paragraph";
import Text from "antd/es/typography/Text";
import Title from "antd/es/typography/Title";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

type DeviceRow = {
  id: string;
  apiKey: string | null;
  status: string;
  heartbeatStatus: string;
  lastError: string | null;
  lastSeenAt: string | null;
};

type ProvisionResponse = {
  ok: boolean;
  deviceName: string;
  apiKey: string;
};

function maskApiKey(apiKey: string) {
  return apiKey.replace(/./g, "*");
}

function formatDateTime(value: string | null) {
  if (!value) {
    return t("devices.never");
  }
  return new Date(value).toISOString();
}

export default function DevicesPage() {
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [provisioned, setProvisioned] = useState<ProvisionResponse | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  async function loadDevices() {
    setLoading(true);
    const response = await fetch("/api/admin/devices", { cache: "no-store" });
    const payload = (await response.json()) as { devices: DeviceRow[] };
    setRows(payload.devices);
    setLoading(false);
  }

  async function registerDevice() {
    const nextDeviceName = deviceName.trim();
    if (!nextDeviceName) {
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/admin/devices/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceName: nextDeviceName }),
    });
    if (!response.ok) {
      setSubmitting(false);
      return;
    }

    const payload = (await response.json()) as ProvisionResponse;
    setProvisioned(payload);
    setDeviceName("");
    await loadDevices();
    setSubmitting(false);
  }

  async function copyKey() {
    if (!provisioned?.apiKey) {
      return;
    }
    await navigator.clipboard.writeText(provisioned.apiKey);
  }

  useEffect(() => {
    loadDevices();
  }, []);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {t("devices.title")}
          </Title>
          <Paragraph style={{ margin: 0, color: "#595959" }}>{t("devices.subtitle")}</Paragraph>
          <Space wrap>
            <Input
              value={deviceName}
              onChange={(event) => setDeviceName(event.target.value)}
              placeholder={t("devices.deviceName")}
              style={{ width: 260 }}
            />
            <Button type="primary" loading={submitting} onClick={registerDevice}>
              {t("devices.register")}
            </Button>
            <Button onClick={loadDevices}>{t("devices.refresh")}</Button>
            <Statistic title={t("devices.total")} value={rows.length} style={{ display: "flex", gap: 8, alignItems: "baseline" }} />
          </Space>
        </Space>
      </Card>

      {provisioned ? (
        <Alert
          type="success"
          showIcon
          message={t("devices.keyTitle")}
          description={
            <Space direction="vertical">
              <Text>
                {t("devices.deviceName")}: <Text code>{provisioned.deviceName}</Text>
              </Text>
              <Text>
                {t("devices.apiKey")}: <Text code>{provisioned.apiKey}</Text>
              </Text>
              <Button size="small" onClick={copyKey}>
                {t("devices.copyKey")}
              </Button>
            </Space>
          }
        />
      ) : null}

      <Card>
        <Table
          loading={loading}
          rowKey={(row) => row.id}
          dataSource={rows}
          pagination={{ pageSize: 25 }}
          locale={{ emptyText: t("devices.empty") }}
          columns={[
            { title: t("devices.deviceName"), dataIndex: "id", key: "id", width: 220 },
            {
              title: t("devices.apiKey"),
              dataIndex: "apiKey",
              key: "apiKey",
              width: 220,
              render: (value: string | null, row: DeviceRow) => {
                if (!value) {
                  return <Text type="secondary">{t("devices.apiKeyUnavailable")}</Text>;
                }

                const revealed = revealedKeys[row.id] ?? false;

                return (
                  <Space size="small">
                    <Text code>{revealed ? value : maskApiKey(value)}</Text>
                    <Button
                      type="text"
                      size="small"
                      icon={revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={() =>
                        setRevealedKeys((current) => ({
                          ...current,
                          [row.id]: !revealed,
                        }))
                      }
                    >
                      {revealed ? t("devices.hideKey") : t("devices.showKey")}
                    </Button>
                  </Space>
                );
              },
            },
            { title: t("devices.status"), dataIndex: "status", key: "status", width: 120 },
            { title: t("devices.health"), dataIndex: "heartbeatStatus", key: "heartbeatStatus", width: 180 },
            {
              title: t("devices.lastError"),
              dataIndex: "lastError",
              key: "lastError",
              render: (value: string | null) => value ? <Text type="danger">{value}</Text> : <Text type="secondary">{t("devices.noError")}</Text>,
            },
            {
              title: t("devices.lastHealthCheck"),
              dataIndex: "lastSeenAt",
              key: "lastSeenAt",
              width: 220,
              render: (value: string | null) => formatDateTime(value),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
