"use client";

import { AutoComplete, Button, Card, Input, InputNumber, Space, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CheckOutlined, CloseOutlined, DownloadOutlined, EditOutlined, UploadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CompetitorRow } from "@/lib/competitors-indexed-db";
import { useCompetitorSearch } from "@/lib/hooks/use-competitor-search";
import { useT } from "@/lib/i18n-client";
import { formatEuro } from "@/lib/money";

type PaymentGroupCompetitor = {
  competitorId: string;
  priceOverrideCents: number | null;
  compensatedEvents: number | null;
  eolNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  club: string | null;
  eventsAttended: number;
};

function competitorName(item: { firstName: string | null; lastName: string | null }) {
  return `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim() || "Unknown";
}

export default function PaymentGroupCompetitorsPage() {
  const t = useT();
  const params = useParams<{ paymentGroupId: string }>();
  const paymentGroupId = params.paymentGroupId;

  const [members, setMembers] = useState<PaymentGroupCompetitor[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [apiMessage, contextHolder] = message.useMessage();

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/admin/payment-groups/${encodeURIComponent(paymentGroupId)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      apiMessage.error(t("paymentGroups.saveError"));
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as {
      paymentGroup: {
        name: string;
        competitors: PaymentGroupCompetitor[];
      };
    };
    setMembers(payload.paymentGroup.competitors);
    setGroupName(payload.paymentGroup.name);
    setLoading(false);
  }, [paymentGroupId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const { filteredRows: filteredAvailableCompetitors, loading: competitorLoading, searchInput, setSearchInput } =
    useCompetitorSearch({
      excludedCompetitorIds: members.map((m) => m.competitorId),
    });

  async function addCompetitor(item: CompetitorRow) {
    const response = await fetch(
      `/api/admin/payment-groups/${encodeURIComponent(paymentGroupId)}/competitors`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ competitorId: item.competitorId }),
      },
    );
    if (!response.ok) {
      apiMessage.error(t("paymentGroups.saveError"));
      return;
    }
    await loadMembers();
  }

  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<number | null>(null);

  function startEditPrice(row: PaymentGroupCompetitor) {
    setEditingPriceId(row.competitorId);
    setEditingPriceValue(row.priceOverrideCents);
  }

  function cancelEditPrice() {
    setEditingPriceId(null);
    setEditingPriceValue(null);
  }

  async function savePrice(competitorId: string) {
    const response = await fetch(
      `/api/admin/payment-groups/${encodeURIComponent(paymentGroupId)}/competitors/${encodeURIComponent(competitorId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceOverrideCents: editingPriceValue }),
      },
    );
    if (!response.ok) {
      apiMessage.error(t("paymentGroups.saveError"));
      return;
    }
    setEditingPriceId(null);
    setEditingPriceValue(null);
    await loadMembers();
  }

  const [editingCompEventsId, setEditingCompEventsId] = useState<string | null>(null);
  const [editingCompEventsValue, setEditingCompEventsValue] = useState<number | null>(null);

  function startEditCompEvents(row: PaymentGroupCompetitor) {
    setEditingCompEventsId(row.competitorId);
    setEditingCompEventsValue(row.compensatedEvents);
  }

  function cancelEditCompEvents() {
    setEditingCompEventsId(null);
    setEditingCompEventsValue(null);
  }

  async function saveCompEvents(competitorId: string) {
    const response = await fetch(
      `/api/admin/payment-groups/${encodeURIComponent(paymentGroupId)}/competitors/${encodeURIComponent(competitorId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ compensatedEvents: editingCompEventsValue }),
      },
    );
    if (!response.ok) {
      apiMessage.error(t("paymentGroups.saveError"));
      return;
    }
    setEditingCompEventsId(null);
    setEditingCompEventsValue(null);
    await loadMembers();
  }

  async function removeCompetitor(competitorId: string) {
    const response = await fetch(
      `/api/admin/payment-groups/${encodeURIComponent(paymentGroupId)}/competitors/${encodeURIComponent(competitorId)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      apiMessage.error(t("paymentGroups.deleteError"));
      return;
    }
    await loadMembers();
  }

  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `/api/admin/payment-groups/${encodeURIComponent(paymentGroupId)}/import`,
        { method: "POST", body: formData },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.error === "unknown_eol" && Array.isArray(body.notFound)) {
          apiMessage.error(t("paymentGroups.importUnknownEol").replace("{eolNumbers}", body.notFound.join(", ")));
        } else {
          apiMessage.error(t("paymentGroups.importError"));
        }
        return;
      }

      const body = await response.json();
      apiMessage.success(t("paymentGroups.importSuccess").replace("{count}", String(body.imported)));
      await loadMembers();
    } catch {
      apiMessage.error(t("paymentGroups.importError"));
    }
  }

  function exportExcel() {
    const data = members.map((c) => ({
      [t("competitors.eolNumber")]: c.eolNumber ?? "",
      [t("competitors.firstName")]: c.firstName ?? "",
      [t("competitors.lastName")]: c.lastName ?? "",
      [t("paymentGroups.eventsAttended")]: c.eventsAttended,
      [t("paymentGroups.compensatedEvents")]: c.compensatedEvents ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, groupName.slice(0, 31) || "Members");
    XLSX.writeFile(wb, `${groupName || "payment-group"}.xlsx`);
  }

  const memberColumns: ColumnsType<PaymentGroupCompetitor> = [
    { title: t("competitors.eolNumber"), dataIndex: "eolNumber", key: "eolNumber", width: 120 },
    {
      title: t("competitors.fullName"),
      key: "name",
      width: 200,
      render: (_, row) => competitorName({ firstName: row.firstName, lastName: row.lastName }),
    },
    { title: t("competitors.club"), dataIndex: "club", key: "club", width: 180 },
    {
      title: t("paymentGroups.eventsAttended"),
      dataIndex: "eventsAttended",
      key: "eventsAttended",
      width: 80,
    },
    {
      title: t("paymentGroups.compensatedEvents"),
      key: "compensatedEvents",
      width: 160,
      render: (_, row) =>
        editingCompEventsId === row.competitorId ? (
          <Space.Compact size="small">
            <InputNumber
              autoFocus
              value={editingCompEventsValue}
              min={0}
              precision={0}
              style={{ width: 80 }}
              onChange={(v) => setEditingCompEventsValue(typeof v === "number" ? v : null)}
              placeholder="-"
              onPressEnter={() => saveCompEvents(row.competitorId)}
            />
            <Button size="small" icon={<CheckOutlined />} onClick={() => saveCompEvents(row.competitorId)} />
            <Button size="small" icon={<CloseOutlined />} onClick={cancelEditCompEvents} />
          </Space.Compact>
        ) : (
          <Space size={4}>
            <span>{row.compensatedEvents ?? "-"}</span>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => startEditCompEvents(row)} />
          </Space>
        ),
    },
    {
      title: t("paymentGroups.competitorPriceOverride"),
      key: "priceOverrideCents",
      width: 230,
      render: (_, row) =>
        editingPriceId === row.competitorId ? (
          <Space.Compact size="small">
            <Input style={{ width: 28, pointerEvents: "none", textAlign: "center" }} value="€" readOnly tabIndex={-1} />
            <InputNumber
              autoFocus
              value={editingPriceValue}
              min={0}
              precision={2}
              style={{ width: 100 }}
              onChange={(v) => setEditingPriceValue(typeof v === "number" ? v : null)}
              placeholder="-"
              onPressEnter={() => savePrice(row.competitorId)}
            />
            <Button size="small" icon={<CheckOutlined />} onClick={() => savePrice(row.competitorId)} />
            <Button size="small" icon={<CloseOutlined />} onClick={cancelEditPrice} />
          </Space.Compact>
        ) : (
          <Space size={4}>
            <span>{formatEuro(row.priceOverrideCents)}</span>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => startEditPrice(row)} />
          </Space>
        ),
    },
    {
      title: t("paymentGroups.actions"),
      key: "actions",
      width: 100,
      render: (_, row) => (
        <Button size="small" danger onClick={() => removeCompetitor(row.competitorId)}>
          {t("paymentGroups.removeCompetitor")}
        </Button>
      ),
    },
  ];

  const top5 = filteredAvailableCompetitors.slice(0, 5);

  const autocompleteOptions = searchInput.trim()
    ? top5.map((row) => ({
        value: row.competitorId,
        label: (
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <span>
              <strong>{row.firstName} {row.lastName}</strong>
              {row.club ? ` — ${row.club}` : ""}
            </span>
            <span style={{ color: "#8c8c8c" }}>{row.eolNumber}</span>
          </Space>
        ),
        row,
      }))
    : [];

  function handleSelect(_: string, option: (typeof autocompleteOptions)[number]) {
    addCompetitor(option.row);
    setSearchInput("");
  }

  return (
    <>
      {contextHolder}
      <input ref={importInputRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleImportFile} />

      <AutoComplete
        value={searchInput}
        options={autocompleteOptions}
        onSearch={setSearchInput}
        onSelect={handleSelect}
        placeholder={t("paymentGroups.searchCompetitors")}
        style={{ width: "100%" }}
      />

      <Card
        size="small"
        title={`${t("paymentGroups.selectedCompetitors")} (${members.length})`}
        extra={
          <Space>
            <Button icon={<UploadOutlined />} onClick={() => importInputRef.current?.click()}>
              {t("paymentGroups.importCsv")}
            </Button>
            <Button icon={<DownloadOutlined />} disabled={members.length === 0} onClick={exportExcel}>
              {t("paymentGroups.exportExcel")}
            </Button>
          </Space>
        }
      >
        <Table
          loading={loading}
          rowKey={(row) => row.competitorId}
          dataSource={members}
          pagination={{ pageSize: 25 }}
          columns={memberColumns}
          locale={{ emptyText: t("competitors.empty") }}
          scroll={{ x: 830 }}
        />
      </Card>
    </>
  );
}
