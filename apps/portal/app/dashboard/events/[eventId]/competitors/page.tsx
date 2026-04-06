"use client";

import { Badge, Button, Card, Space, Table, message } from "antd";
import Paragraph from "antd/es/typography/Paragraph";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DownloadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import { useT } from "@/lib/i18n-client";
import { formatEuro } from "@/lib/money";

type EventCompetitorRow = {
  registrationId: string;
  competitorId: string;
  eolNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  courseName: string | null;
  price: number | null;
  pricePaid: number | null;
  paymentMethod: string;
};

type EventDetailPayload = {
  competitors: EventCompetitorRow[];
  paymentGroups: Record<string, string[]>;
};

export default function EventCompetitorsPage() {
  const t = useT();
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const eventId = params.eventId;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EventCompetitorRow[]>([]);
  const [paymentGroupMap, setPaymentGroupMap] = useState<Record<string, string[]>>({});
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
    setPaymentGroupMap(payload.paymentGroups ?? {});
    setLoading(false);
  }

  function toSheetRow(row: EventCompetitorRow) {
    return {
      [t("events.eolNumber")]: row.eolNumber ?? "",
      [t("events.firstName")]: row.firstName ?? "",
      [t("events.lastName")]: row.lastName ?? "",
      [t("events.selectedCourse")]: row.courseName ?? "",
      [t("events.price")]: row.price ?? 0,
      [t("events.pricePaid")]: row.pricePaid ?? 0,
      [t("events.paymentMethod")]: row.paymentMethod,
    };
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    const allData = rows.map(toSheetRow);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allData), "Competitors");

    for (const [groupName, competitorIds] of Object.entries(paymentGroupMap)) {
      const idSet = new Set(competitorIds);
      const groupRows = rows.filter((r) => idSet.has(r.competitorId));
      if (groupRows.length === 0) continue;
      const sheetName = groupName.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(groupRows.map(toSheetRow)), sheetName);
    }

    XLSX.writeFile(wb, `competitors-${eventId}.xlsx`);
  }

  const totals = useMemo(() => {
    const totalPrice = rows.reduce((sum, r) => sum + (r.price ?? 0), 0);
    const totalPaid = rows.reduce((sum, r) => sum + (r.pricePaid ?? 0), 0);
    return { count: rows.length, totalPrice, totalPaid };
  }, [rows]);

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
            <Button icon={<DownloadOutlined />} disabled={rows.length === 0} onClick={exportExcel}>
              {t("events.exportExcel")}
            </Button>
          </Space>
          <Table
            loading={loading}
            rowKey={(row) => row.registrationId}
            dataSource={rows}
            pagination={{ pageSize: 25 }}
            locale={{ emptyText: t("events.competitorsEmpty") }}
            scroll={{ x: 1080 }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <strong>{t("events.total")}: {totals.count}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4}>
                  <strong>{formatEuro(totals.totalPrice)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5}>
                  <strong>{formatEuro(totals.totalPaid)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} colSpan={2} />
              </Table.Summary.Row>
            )}
            columns={[
              { title: t("events.eolNumber"), dataIndex: "eolNumber", key: "eolNumber", width: 140 },
              { title: t("events.firstName"), dataIndex: "firstName", key: "firstName", width: 160 },
              { title: t("events.lastName"), dataIndex: "lastName", key: "lastName", width: 160 },
              { title: t("events.selectedCourse"), dataIndex: "courseName", key: "courseName", width: 180 },
              {
                title: t("events.price"),
                dataIndex: "price",
                key: "price",
                width: 120,
                render: (value: number | null) => formatEuro(value),
              },
              {
                title: t("events.pricePaid"),
                dataIndex: "pricePaid",
                key: "pricePaid",
                width: 120,
                render: (value: number | null) => formatEuro(value),
              },
              { title: t("events.paymentMethod"), dataIndex: "paymentMethod", key: "paymentMethod", width: 150 },
              {
                title: "",
                key: "paymentStatus",
                width: 60,
                render: (_: unknown, row: EventCompetitorRow) =>
                  row.price === row.pricePaid
                    ? <Badge status="success" text="OK" />
                    : <Badge status="warning" text="!" />,
              },
            ]}
          />
        </Space>
      </Card>
    </>
  );
}
