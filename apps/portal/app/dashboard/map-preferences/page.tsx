"use client";

import { AutoComplete, Button, Card, Input, Space, Switch, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CheckOutlined, CloseOutlined, DownloadOutlined, EditOutlined, UploadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CompetitorRow } from "@/lib/competitors-indexed-db";
import { useCompetitorSearch } from "@/lib/hooks/use-competitor-search";
import { useT } from "@/lib/i18n-client";

type MapPreferenceCompetitor = {
  competitorId: string;
  courseName: string;
  waterproofMap: boolean;
  eolNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  club: string | null;
};

function competitorName(item: { firstName: string | null; lastName: string | null }) {
  return `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim() || "Unknown";
}

export default function MapPreferencesPage() {
  const t = useT();
  const [members, setMembers] = useState<MapPreferenceCompetitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiMessage, contextHolder] = message.useMessage();

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/map-preferences", { cache: "no-store" });
    if (!response.ok) {
      apiMessage.error(t("mapPreferences.saveError"));
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as { mapPreferences: MapPreferenceCompetitor[] };
    setMembers(payload.mapPreferences);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const { filteredRows: filteredAvailableCompetitors, searchInput, setSearchInput } =
    useCompetitorSearch({
      excludedCompetitorIds: members.map((m) => m.competitorId),
    });

  async function addCompetitor(item: CompetitorRow) {
    const response = await fetch("/api/admin/map-preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ competitorId: item.competitorId, courseName: "", waterproofMap: false }),
    });
    if (!response.ok) {
      apiMessage.error(t("mapPreferences.saveError"));
      return;
    }
    await loadMembers();
  }

  async function removeCompetitor(competitorId: string) {
    const response = await fetch(
      `/api/admin/map-preferences/${encodeURIComponent(competitorId)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      apiMessage.error(t("mapPreferences.deleteError"));
      return;
    }
    await loadMembers();
  }

  async function patchCompetitor(competitorId: string, data: { courseName?: string; waterproofMap?: boolean }) {
    setMembers((prev) => prev.map((m) => m.competitorId === competitorId ? { ...m, ...data } : m));
    const response = await fetch(
      `/api/admin/map-preferences/${encodeURIComponent(competitorId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) {
      apiMessage.error(t("mapPreferences.saveError"));
      await loadMembers();
    }
  }

  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseValue, setEditingCourseValue] = useState("");

  function startEditCourse(row: MapPreferenceCompetitor) {
    setEditingCourseId(row.competitorId);
    setEditingCourseValue(row.courseName);
  }

  function cancelEditCourse() {
    setEditingCourseId(null);
    setEditingCourseValue("");
  }

  function saveCourse(competitorId: string) {
    setEditingCourseId(null);
    setEditingCourseValue("");
    void patchCompetitor(competitorId, { courseName: editingCourseValue });
  }

  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/admin/map-preferences/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.error === "unknown_eol" && Array.isArray(body.notFound)) {
          apiMessage.error(t("mapPreferences.importUnknownEol").replace("{eolNumbers}", body.notFound.join(", ")));
        } else {
          apiMessage.error(t("mapPreferences.importError"));
        }
        return;
      }

      const body = await response.json();
      apiMessage.success(t("mapPreferences.importSuccess").replace("{count}", String(body.imported)));
      await loadMembers();
    } catch {
      apiMessage.error(t("mapPreferences.importError"));
    }
  }

  function exportExcel() {
    const data = members.map((c) => ({
      [t("competitors.eolNumber")]: c.eolNumber ?? "",
      [t("competitors.firstName")]: c.firstName ?? "",
      [t("competitors.lastName")]: c.lastName ?? "",
      [t("mapPreferences.courseName")]: c.courseName,
      [t("mapPreferences.waterproofMap")]: c.waterproofMap ? 1 : 0,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Map Preferences");
    XLSX.writeFile(wb, "map-preferences.xlsx");
  }

  const memberColumns: ColumnsType<MapPreferenceCompetitor> = [
    { title: t("competitors.eolNumber"), dataIndex: "eolNumber", key: "eolNumber", width: 120 },
    {
      title: t("competitors.fullName"),
      key: "name",
      width: 200,
      render: (_, row) => competitorName({ firstName: row.firstName, lastName: row.lastName }),
    },
    {
      title: t("mapPreferences.courseName"),
      key: "courseName",
      width: 230,
      render: (_, row) =>
        editingCourseId === row.competitorId ? (
          <Space.Compact size="small">
            <Input
              autoFocus
              value={editingCourseValue}
              style={{ width: 150 }}
              onChange={(e) => setEditingCourseValue(e.target.value)}
              onPressEnter={() => saveCourse(row.competitorId)}
            />
            <Button size="small" icon={<CheckOutlined />} onClick={() => saveCourse(row.competitorId)} />
            <Button size="small" icon={<CloseOutlined />} onClick={cancelEditCourse} />
          </Space.Compact>
        ) : (
          <Space size={4}>
            <span>{row.courseName || "—"}</span>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => startEditCourse(row)} />
          </Space>
        ),
    },
    {
      title: t("mapPreferences.waterproofMap"),
      key: "waterproofMap",
      width: 130,
      render: (_, row) => (
        <Switch
          checked={row.waterproofMap}
          onChange={(checked) => patchCompetitor(row.competitorId, { waterproofMap: checked })}
        />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      render: (_, row) => (
        <Button size="small" danger onClick={() => removeCompetitor(row.competitorId)}>
          {t("mapPreferences.removeCompetitor")}
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
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {contextHolder}
      <input ref={importInputRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleImportFile} />

      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {t("mapPreferences.title")}
          </Title>
          <Paragraph style={{ margin: 0, color: "#595959" }}>{t("mapPreferences.subtitle")}</Paragraph>
        </Space>
      </Card>

      <AutoComplete
        value={searchInput}
        options={autocompleteOptions}
        onSearch={setSearchInput}
        onSelect={handleSelect}
        placeholder={t("mapPreferences.searchCompetitors")}
        style={{ width: "100%" }}
      />

      <Card
        size="small"
        title={`${t("mapPreferences.selectedCompetitors")} (${members.length})`}
        extra={
          <Space>
            <Button icon={<UploadOutlined />} onClick={() => importInputRef.current?.click()}>
              {t("mapPreferences.importCsv")}
            </Button>
            <Button icon={<DownloadOutlined />} disabled={members.length === 0} onClick={exportExcel}>
              {t("mapPreferences.exportExcel")}
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
          scroll={{ x: 900 }}
        />
      </Card>
    </Space>
  );
}
