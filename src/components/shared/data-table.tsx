"use client";

import { Table } from "antd";
import type { TableProps } from "antd";

type DataTableProps<T extends object> = TableProps<T>;

export default function DataTable<T extends object>(props: DataTableProps<T>) {
  return <Table<T> size="small" className="data-table-sm" {...props} />;
}
