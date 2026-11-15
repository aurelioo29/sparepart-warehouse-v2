"use client";

import { Modal, Tag, Typography } from "antd";
import dayjs from "dayjs";

const { Text } = Typography;

type ActivityLogPayloadModalProps = {
  open: boolean;
  onClose: () => void;
  log: {
    id: string;
    action: string;
    module: string;
    resourceType?: string | null;
    resourceId?: string | null;
    createdAt: string | Date;
    oldData?: unknown;
    newData?: unknown;
    ipAddress?: string | null;
    userAgent?: string | null;
    user?: {
      fullName?: string | null;
      username?: string | null;
      email?: string | null;
    } | null;
  } | null;
};

function formatJson(value: unknown) {
  if (!value) return "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getActionColor(action?: string) {
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

export default function ActivityLogPayloadModal({
  open,
  onClose,
  log,
}: ActivityLogPayloadModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="Activity Log Payload"
      width={1100}
      destroyOnHidden
    >
      {log ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <Text type="secondary" className="!text-sm">
                User
              </Text>
              <div className="font-medium text-slate-800">
                {log.user?.fullName || "-"}
              </div>
              <div className="text-sm text-slate-500">
                @{log.user?.username || "-"}
              </div>
            </div>

            <div>
              <Text type="secondary" className="!text-sm">
                Action
              </Text>
              <div className="mt-1">
                <Tag color={getActionColor(log.action)}>{log.action}</Tag>
              </div>
            </div>

            <div>
              <Text type="secondary" className="!text-sm">
                Module
              </Text>
              <div className="font-medium text-slate-800">{log.module}</div>
              <div className="text-sm text-slate-500">
                {log.resourceType || "-"}
              </div>
            </div>

            <div>
              <Text type="secondary" className="!text-sm">
                Created At
              </Text>
              <div className="font-medium text-slate-800">
                {dayjs(log.createdAt).format("DD MMM YYYY HH:mm:ss")}
              </div>
              <div className="text-sm text-slate-500">
                IP: {log.ipAddress || "-"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">
                Old Data
              </div>
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {formatJson(log.oldData)}
              </pre>
            </div>

            <div className="rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">
                New Data
              </div>
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {formatJson(log.newData)}
              </pre>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 font-semibold text-slate-800">
              Additional Information
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <div>
                <span className="font-medium text-slate-800">Resource ID:</span>{" "}
                {log.resourceId || "-"}
              </div>
              <div>
                <span className="font-medium text-slate-800">User Agent:</span>{" "}
                <span className="break-all">{log.userAgent || "-"}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
