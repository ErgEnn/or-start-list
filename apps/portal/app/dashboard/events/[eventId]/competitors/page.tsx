"use client";

import { Button, Card, Space, Table, message } from "antd";
import Paragraph from "antd/es/typography/Paragraph";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

type EventCompetitorRow = {
  competitorId: string;
  eolNumber: string;
  firstName: string;
  lastName: string;
  dob: string | null;
  club: string | null;
  siCard: string | null;
};

type EventDetailPayload = {
  competitors: EventCompetitorRow[];
};

export default function EventCompetitorsPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const eventId = params.eventId;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EventCompetitorRow[]>([]);
  const [apiMessage, contextHolder] = message.useMessage();

  async function loadCompetitors() {
    setLoading(true);
    const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, { cache: "no-store" });
    if (!response.ok) {
      apiMessage.error(t("events.detailLoadError"));
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as EventDetailPayload;
    setRows(payload.competitors);
    setLoading(false);
  }

  useEffect(() => {
    loadCompetitors();
  }, [eventId]);

  return (
    <>
      {contextHolder}
      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Paragraph style={{ margin: 0, color: "#595959" }}>{t("events.competitorsSubtitle")}</Paragraph>
          <Space>
            <Button onClick={() => router.push("/dashboard/events")}>{t("events.back")}</Button>
            <Button onClick={loadCompetitors}>{t("events.refresh")}</Button>
          </Space>
          <Table
            loading={loading}
            rowKey={(row) => row.competitorId}
            dataSource={rows}
            pagination={{ pageSize: 25 }}
            locale={{ emptyText: t("events.competitorsEmpty") }}
            scroll={{ x: 1100 }}
            columns={[
              { title: t("events.competitorId"), dataIndex: "competitorId", key: "competitorId", width: 180 },
              { title: t("events.eolNumber"), dataIndex: "eolNumber", key: "eolNumber", width: 140 },
              { title: t("events.firstName"), dataIndex: "firstName", key: "firstName", width: 160 },
              { title: t("events.lastName"), dataIndex: "lastName", key: "lastName", width: 160 },
              { title: t("events.dob"), dataIndex: "dob", key: "dob", width: 140 },
              { title: t("events.club"), dataIndex: "club", key: "club", width: 180 },
              { title: t("events.siCard"), dataIndex: "siCard", key: "siCard", width: 140 },
            ]}
          />
        </Space>
      </Card>
    </>
  );
}
