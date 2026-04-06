"use client";

import { Button, Card, Input, InputNumber, Modal, Popconfirm, Space, Statistic, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import { useEffect, useRef, useState } from "react";
import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import type { CompetitorRow } from "@/lib/competitors-indexed-db";
import { useCompetitorSearch } from "@/lib/hooks/use-competitor-search";
import { useT } from "@/lib/i18n-client";
import { formatEuro } from "@/lib/money";

type PaymentGroupCompetitor = {
  competitorId: string;
  priceOverrideCents: number | null;
  eolNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  club: string | null;
  eventsAttended: number;
};

type PaymentGroupRow = {
  paymentGroupId: string;
  name: string;
  colorHex: string | null;
  globalPriceOverrideCents: number | null;
  competitorsCount: number;
  competitors: PaymentGroupCompetitor[];
};

type EditableMember = {
  competitorId: string;
  priceOverrideCents: number | null;
  eolNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  club: string | null;
  eventsAttended: number;
};

function displayPrice(value: number | null) {
  return formatEuro(value);
}

function competitorName(item: { firstName: string | null; lastName: string | null }) {
  return `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim() || "Unknown";
}

export default function PaymentGroupsPage() {
  const t = useT();
  const [rows, setRows] = useState<PaymentGroupRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [globalPriceOverrideCents, setGlobalPriceOverrideCents] = useState<number | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<EditableMember[]>([]);

  const [apiMessage, contextHolder] = message.useMessage();
  const { filteredRows: filteredAvailableCompetitors, loading: competitorLoading, searchInput, setSearchInput } =
    useCompetitorSearch({
      excludedCompetitorIds: selectedMembers.map((member) => member.competitorId),
    });

  async function loadGroups() {
    setLoading(true);
    const response = await fetch("/api/admin/payment-groups", { cache: "no-store" });
    if (!response.ok) {
      apiMessage.error(t("paymentGroups.saveError"));
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as { paymentGroups: PaymentGroupRow[] };
    setRows(payload.paymentGroups);
    setLoading(false);
  }

  useEffect(() => {
    loadGroups();
  }, []);

  function openCreateModal() {
    setEditingGroupId(null);
    setGroupName("");
    setColorHex("");
    setGlobalPriceOverrideCents(null);
    setSelectedMembers([]);
    setSearchInput("");
    setModalOpen(true);
  }

  function openEditModal(group: PaymentGroupRow) {
    setEditingGroupId(group.paymentGroupId);
    setGroupName(group.name);
    setColorHex(group.colorHex ?? "");
    setGlobalPriceOverrideCents(group.globalPriceOverrideCents);
    setSelectedMembers(
      group.competitors.map((member) => ({
        competitorId: member.competitorId,
        priceOverrideCents: member.priceOverrideCents,
        eolNumber: member.eolNumber,
        firstName: member.firstName,
        lastName: member.lastName,
        club: member.club,
        eventsAttended: member.eventsAttended,
      })),
    );
    setSearchInput("");
    setModalOpen(true);
  }

  function addCompetitor(item: CompetitorRow) {
    setSelectedMembers((current) => {
      if (current.some((member) => member.competitorId === item.competitorId)) {
        return current;
      }
      return [
        ...current,
        {
          competitorId: item.competitorId,
          priceOverrideCents: null,
          eolNumber: item.eolNumber,
          firstName: item.firstName,
          lastName: item.lastName,
          club: item.club,
          eventsAttended: 0,
        },
      ];
    });
  }

  function removeCompetitor(competitorId: string) {
    setSelectedMembers((current) => current.filter((member) => member.competitorId !== competitorId));
  }

  function updateMemberPriceOverride(competitorId: string, value: number | null) {
    setSelectedMembers((current) =>
      current.map((member) => {
        if (member.competitorId !== competitorId) {
          return member;
        }
        return { ...member, priceOverrideCents: value };
      }),
    );
  }

  async function saveGroup() {
    const name = groupName.trim();
    if (!name) {
      apiMessage.error(t("paymentGroups.invalid"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        colorHex: colorHex.trim() || null,
        globalPriceOverrideCents,
        competitors: selectedMembers.map((member) => ({
          competitorId: member.competitorId,
          priceOverrideCents: member.priceOverrideCents,
        })),
      };

      const response = await fetch(
        editingGroupId ? `/api/admin/payment-groups/${encodeURIComponent(editingGroupId)}` : "/api/admin/payment-groups",
        {
          method: editingGroupId ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        apiMessage.error(t("paymentGroups.saveError"));
        setSaving(false);
        return;
      }

      apiMessage.success(t("paymentGroups.saveSuccess"));
      setModalOpen(false);
      await loadGroups();
      setSaving(false);
    } catch {
      apiMessage.error(t("paymentGroups.saveError"));
      setSaving(false);
    }
  }

  async function deleteGroup(paymentGroupId: string) {
    const response = await fetch(`/api/admin/payment-groups/${encodeURIComponent(paymentGroupId)}`, { method: "DELETE" });
    if (!response.ok) {
      apiMessage.error(t("paymentGroups.deleteError"));
      return;
    }
    apiMessage.success(t("paymentGroups.deleteSuccess"));
    await loadGroups();
  }

  const importInputRef = useRef<HTMLInputElement>(null);
  const [importTargetGroupId, setImportTargetGroupId] = useState<string | null>(null);

  function triggerImport(paymentGroupId: string) {
    setImportTargetGroupId(paymentGroupId);
    importInputRef.current?.click();
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset input so the same file can be re-selected
    event.target.value = "";
    if (!file || !importTargetGroupId) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `/api/admin/payment-groups/${encodeURIComponent(importTargetGroupId)}/import`,
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
      await loadGroups();
    } catch {
      apiMessage.error(t("paymentGroups.importError"));
    }
  }

  function exportGroupExcel(group: PaymentGroupRow) {
    const data = group.competitors.map((c) => ({
      [t("competitors.eolNumber")]: c.eolNumber ?? "",
      [t("competitors.firstName")]: c.firstName ?? "",
      [t("competitors.lastName")]: c.lastName ?? "",
      [t("paymentGroups.eventsAttended")]: c.eventsAttended,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, group.name.slice(0, 31));
    XLSX.writeFile(wb, `${group.name}.xlsx`);
  }

  const groupsColumns: ColumnsType<PaymentGroupRow> = [
    { title: t("paymentGroups.name"), dataIndex: "name", key: "name" },
    {
      title: t("paymentGroups.color"),
      dataIndex: "colorHex",
      key: "colorHex",
      width: 150,
      render: (value: string | null) =>
        value ? (
          <Space size={8}>
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                border: "1px solid #d9d9d9",
                backgroundColor: value,
                display: "inline-block",
              }}
            />
            {value}
          </Space>
        ) : (
          "-"
        ),
    },
    {
      title: t("paymentGroups.globalPriceOverride"),
      dataIndex: "globalPriceOverrideCents",
      key: "globalPriceOverrideCents",
      width: 220,
      render: (value: number | null) => displayPrice(value),
    },
    {
      title: t("paymentGroups.competitorsCount"),
      dataIndex: "competitorsCount",
      key: "competitorsCount",
      width: 140,
    },
    {
      title: t("paymentGroups.actions"),
      key: "actions",
      width: 460,
      render: (_, row) => (
        <Space>
          <Button onClick={() => openEditModal(row)}>{t("paymentGroups.edit")}</Button>
          <Button icon={<UploadOutlined />} onClick={() => triggerImport(row.paymentGroupId)}>
            {t("paymentGroups.importCsv")}
          </Button>
          <Button
            icon={<DownloadOutlined />}
            disabled={row.competitors.length === 0}
            onClick={() => exportGroupExcel(row)}
          >
            {t("paymentGroups.exportExcel")}
          </Button>
          <Popconfirm title={t("paymentGroups.delete")} onConfirm={() => deleteGroup(row.paymentGroupId)}>
            <Button danger>{t("paymentGroups.delete")}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const availableColumns: ColumnsType<CompetitorRow> = [
    { title: t("competitors.eolNumber"), dataIndex: "eolNumber", key: "eolNumber", width: 120 },
    { title: t("competitors.firstName"), dataIndex: "firstName", key: "firstName", width: 140 },
    { title: t("competitors.lastName"), dataIndex: "lastName", key: "lastName", width: 140 },
    { title: t("competitors.club"), dataIndex: "club", key: "club", width: 180 },
    {
      title: t("paymentGroups.actions"),
      key: "actions",
      width: 90,
      render: (_, row) => (
        <Button size="small" onClick={() => addCompetitor(row)}>
          {t("paymentGroups.addCompetitor")}
        </Button>
      ),
    },
  ];

  const selectedColumns: ColumnsType<EditableMember> = [
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
      title: t("paymentGroups.competitorPriceOverride"),
      key: "priceOverrideCents",
      width: 230,
      render: (_, row) => (
        <Space.Compact style={{ width: "100%" }}>
          <Input style={{ width: 40, pointerEvents: "none", textAlign: "center" }} value="€" readOnly tabIndex={-1} />
          <InputNumber
            value={row.priceOverrideCents}
            min={0}
            precision={2}
            style={{ width: "100%" }}
            onChange={(value) => updateMemberPriceOverride(row.competitorId, typeof value === "number" ? value : null)}
            placeholder="-"
          />
        </Space.Compact>
      ),
    },
    {
      title: t("paymentGroups.actions"),
      key: "actions",
      width: 120,
      render: (_, row) => (
        <Button size="small" danger onClick={() => removeCompetitor(row.competitorId)}>
          {t("paymentGroups.removeCompetitor")}
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {contextHolder}
      <input ref={importInputRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleImportFile} />
      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {t("paymentGroups.title")}
          </Title>
          <Paragraph style={{ margin: 0, color: "#595959" }}>{t("paymentGroups.subtitle")}</Paragraph>
          <Space>
            <Button type="primary" onClick={openCreateModal}>
              {t("paymentGroups.add")}
            </Button>
            <Button onClick={loadGroups}>{t("paymentGroups.refresh")}</Button>
            <Statistic title={t("paymentGroups.total")} value={rows.length} style={{ display: "flex", gap: 8, alignItems: "baseline" }} />
          </Space>
        </Space>
      </Card>

      <Card>
        <Table
          loading={loading}
          rowKey={(row) => row.paymentGroupId}
          dataSource={rows}
          pagination={{ pageSize: 25 }}
          locale={{ emptyText: t("paymentGroups.empty") }}
          columns={groupsColumns}
        />
      </Card>

      <Modal
        width={1180}
        open={modalOpen}
        title={editingGroupId ? t("paymentGroups.modalEditTitle") : t("paymentGroups.modalCreateTitle")}
        okText={t("paymentGroups.save")}
        cancelText={t("paymentGroups.cancel")}
        onOk={saveGroup}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={16}>
          <Space wrap>
            <Input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder={t("paymentGroups.name")}
              style={{ width: 280 }}
            />
            <Input
              value={colorHex}
              onChange={(event) => setColorHex(event.target.value.toUpperCase())}
              placeholder={t("paymentGroups.color")}
              style={{ width: 180 }}
              maxLength={7}
              allowClear
            />
            <Space.Compact>
              <Input style={{ width: 40, pointerEvents: "none", textAlign: "center" }} value="€" readOnly tabIndex={-1} />
              <InputNumber
                value={globalPriceOverrideCents}
                min={0}
                precision={2}
                onChange={(value) => setGlobalPriceOverrideCents(typeof value === "number" ? value : null)}
                placeholder={t("paymentGroups.globalPriceOverride")}
                style={{ width: 240 }}
              />
            </Space.Compact>
          </Space>

          <Card size="small" title={t("paymentGroups.selectedCompetitors")}>
            <Table
              rowKey={(row) => row.competitorId}
              dataSource={selectedMembers}
              pagination={{ pageSize: 6 }}
              columns={selectedColumns}
              locale={{ emptyText: t("competitors.empty") }}
              scroll={{ x: 900 }}
            />
          </Card>

          <Card size="small" title={t("paymentGroups.availableCompetitors")}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("paymentGroups.searchCompetitors")}
                style={{ width: 320 }}
              />
              <Table
                loading={competitorLoading}
                rowKey={(row) => row.competitorId}
                dataSource={filteredAvailableCompetitors}
                pagination={{ pageSize: 6 }}
                columns={availableColumns}
                locale={{ emptyText: t("competitors.empty") }}
                scroll={{ x: 760 }}
              />
            </Space>
          </Card>
        </Space>
      </Modal>
    </Space>
  );
}
