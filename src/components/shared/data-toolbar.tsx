"use client";

import { Button, Select, Space } from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
} from "@ant-design/icons";

type DataToolbarProps = {
  total?: number;
  page?: number;
  limit?: number;
  bulkDisabled?: boolean;
  addLabel?: string;
  onAdd?: () => void;
  onRefresh?: () => void;
  onOpenColumnDisplay?: () => void;
};

export default function DataToolbar({
  total = 0,
  page = 1,
  limit = 10,
  bulkDisabled = true,
  addLabel = "Add New",
  onAdd,
  onRefresh,
  onOpenColumnDisplay,
}: DataToolbarProps) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="text-sm text-slate-500">
        showing {from} to {to} of {total} items
      </div>

      <Space wrap>
        <Select
          disabled={bulkDisabled}
          placeholder="Bulk action"
          className="w-[130px]"
          size="small"
          options={[
            {
              label: "Set Active",
              value: "active",
            },
            {
              label: "Set Inactive",
              value: "inactive",
            },
          ]}
        />

        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={onAdd}
        >
          {addLabel}
        </Button>

        <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} />

        <Button
          size="small"
          icon={<SettingOutlined />}
          onClick={onOpenColumnDisplay}
        />
      </Space>
    </div>
  );
}
