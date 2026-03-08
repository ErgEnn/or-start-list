import { Card } from "antd";
import Paragraph from "antd/es/typography/Paragraph";
import Title from "antd/es/typography/Title";
import { t } from "@/lib/i18n";

export default function DashboardPage() {
  return (
    <Card>
      <Title level={3} style={{ marginTop: 0 }}>
        {t("dashboard.title")}
      </Title>
      <Paragraph>{t("dashboard.welcome")}</Paragraph>
    </Card>
  );
}
