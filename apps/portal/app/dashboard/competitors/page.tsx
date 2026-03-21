"use client";

import { Button, Card, Input, Space, Statistic, Table, message } from "antd";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCompetitorSearch } from "@/lib/hooks/use-competitor-search";
import { t } from "@/lib/i18n";

export default function CompetitorsPage() {
  const { filteredRows, loading, refresh, searchInput, setSearchInput } = useCompetitorSearch();
  const [isImporting, setIsImporting] = useState(false);
  const [lastImportedAt, setLastImportedAt] = useState<string | null>(null);
  const [messageApi, messageContextHolder] = message.useMessage();

  const loadImportStatus = useCallback(async () => {
    const response = await fetch("/api/admin/competitors/import-source", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Failed to load source import status (${response.status})`);
    }

    const payload = (await response.json()) as { importedAt: string | null };
    setLastImportedAt(payload.importedAt);
  }, []);

  useEffect(() => {
    loadImportStatus().catch(() => {
      setLastImportedAt(null);
    });
  }, [loadImportStatus]);

  const formattedLastImportedAt = useMemo(() => {
    if (!lastImportedAt) {
      return t("competitors.lastSourceImportNever");
    }

    return new Date(lastImportedAt).toLocaleString();
  }, [lastImportedAt]);

  async function downloadFromOrigin() {
    setIsImporting(true);
    try {
      const response = await fetch("/api/admin/competitors/import-source", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Import failed (${response.status})`);
      }
      const payload = (await response.json()) as { imported: { importedAt: string } };
      await refresh();
      setLastImportedAt(payload.imported.importedAt);
      messageApi.success(t("competitors.importSuccess"));
    } catch {
      messageApi.error(t("competitors.importError"));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {messageContextHolder}
      <Card>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            {t("competitors.title")}
          </Title>
          <Paragraph style={{ margin: 0, color: "#595959" }}>{t("competitors.subtitle")}</Paragraph>
          <Paragraph style={{ margin: 0, color: "#595959" }}>
            {t("competitors.lastSourceImport")}: {formattedLastImportedAt}
          </Paragraph>
          <Space>
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t("competitors.search")}
              style={{ width: 320 }}
            />
            <Button onClick={downloadFromOrigin} loading={isImporting}>
              {t("competitors.downloadOrigin")}
            </Button>
            <Button onClick={refresh}>{t("competitors.refresh")}</Button>
            <Statistic title={t("competitors.total")} value={filteredRows.length} />
          </Space>
        </Space>
      </Card>
      <Card>
        <Table
          loading={loading}
          rowKey={(row) => row.competitorId}
          dataSource={filteredRows}
          pagination={{ pageSize: 25 }}
          locale={{ emptyText: t("competitors.empty") }}
          scroll={{ x: 1200 }}
          columns={[
            { title: t("competitors.eolNumber"), dataIndex: "eolNumber", key: "eolNumber", width: 140 },
            { title: t("competitors.firstName"), dataIndex: "firstName", key: "firstName", width: 160 },
            { title: t("competitors.lastName"), dataIndex: "lastName", key: "lastName", width: 160 },
            { title: t("competitors.dob"), dataIndex: "dob", key: "dob", width: 130 },
            { title: t("competitors.club"), dataIndex: "club", key: "club", width: 180 },
            { title: t("competitors.siCard"), dataIndex: "siCard", key: "siCard", width: 140 },
          ]}
        />
      </Card>
    </Space>
  );
}
