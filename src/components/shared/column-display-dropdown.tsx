"use client";

import { Checkbox, Popover } from "antd";

export type ColumnDisplayItem = {
  key: string;
  label: string;
  disabled?: boolean;
};

type ColumnDisplayDropdownProps = {
  open: boolean;
  trigger: React.ReactNode;
  columns: ColumnDisplayItem[];
  visibleKeys: string[];
  onOpenChange: (open: boolean) => void;
  onChange: (keys: string[]) => void;
};

export default function ColumnDisplayDropdown({
  open,
  trigger,
  columns,
  visibleKeys,
  onOpenChange,
  onChange,
}: ColumnDisplayDropdownProps) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger="click"
      placement="bottomRight"
      content={
        <div className="w-[180px]">
          <div className="mb-2 text-sm font-semibold text-slate-700">
            Column Display
          </div>

          <Checkbox.Group
            value={visibleKeys}
            onChange={(values) => onChange(values as string[])}
            className="flex flex-col gap-2"
          >
            {columns.map((column) => (
              <Checkbox
                key={column.key}
                value={column.key}
                disabled={column.disabled}
                className="text-sm"
              >
                {column.label}
              </Checkbox>
            ))}
          </Checkbox.Group>
        </div>
      }
    >
      {trigger}
    </Popover>
  );
}
