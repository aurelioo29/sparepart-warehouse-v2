"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

import ActivityLogPayloadModal from "./activity-log-payload-modal";

type ActivityLogItem = {
  id: string;
  userId?: string | null;
  action: string;
  module: string;
  resourceType?: string | null;
  resourceId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: {
    id: string;
    fullName?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
};

type ActivityLogsResponse = {
  items: ActivityLogItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function getActionColor(action: string) {
  switch (action) {
    case "CREATE":
      return "green";
    case "UPDATE":
      return "blue";
    case "DELETE":
      return "red";
    case "DELETE_PERMANENT":
      return "volcano";
    case "INACTIVE":
      return "orange";
    case "LOGIN":
      return "gold";
    case "LOGOUT":
      return "purple";
    case "PRINT":
      return "cyan";
    case "EXPORT":
      return "magenta";
    default:
      return "default";
  }
}

export default function ActivityLogsPageClient() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  async function fetchLogs(nextPage = page, nextLimit = limit) {
    try {
      setLoading(true);

      const query = new URLSearchParams({
        page: String(nextPage),
        limit: String(nextLimit),
      });

      const response = await fetch(`/api/activity-logs?${query.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch activity logs");
      }

      const data: ActivityLogsResponse = result.data;

      setLogs(data.items);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil activity logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs(page, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const columns: ColumnsType<ActivityLogItem> = useMemo(
    () => [
      {
        title: "Module",
        dataIndex: "module",
        key: "module",
        width: 180,
        render: (value: string) => value || "-",
      },
      {
        title: "Action",
        dataIndex: "action",
        key: "action",
        width: 130,
        render: (value: string) => (
          <Tag color={getActionColor(value)}>{value}</Tag>
        ),
      },
      {
        title: "User",
        key: "user",
        width: 220,
        render: (_, record) => (
          <div>
            <div className="font-medium text-slate-800">
              {record.user?.username || "-"}
            </div>
          </div>
        ),
      },
      {
        title: "Created At",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 240,
        render: (value: string) => dayjs(value).format("YYYY-MM-DD HH:mm:ss"),
      },
      {
        title: "Payload",
        key: "payload",
        width: 160,
        align: "center",
        render: (_, record) => (
          <Button size="small" onClick={() => setSelectedLog(record)}>
            View Payload
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <Table<ActivityLogItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={logs}
        pagination={{
          current: meta.page,
          pageSize: meta.limit,
          total: meta.total,
          showSizeChanger: false,
          onChange: (nextPage) => {
            setPage(nextPage);
          },
        }}
        scroll={{ x: 900 }}
      />

      <ActivityLogPayloadModal
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        log={selectedLog}
      />
    </>
  );
}
