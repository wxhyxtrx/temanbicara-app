import React from "react";

export type Column<T> = {
  label: string | React.ReactNode;
  renderCell?: (row: T, index: number) => React.ReactNode;
  accessorKey?: keyof T;
  className?: string;
  headerClassName?: string;
  align?: "left" | "center" | "right";
};

export type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  className?: string;
  currentPage?: number;
  itemsPerPage?: number;
  isLoading?: boolean;
  skeletonRows?: number;
  emptyMessage?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T, index: number) => void;
  rowKey?: (row: T, index: number) => string | number;
  rowClassName?: (row: T, index: number) => string | undefined;
  autoPaginate?: boolean;
};

export type TableInfoProps = {
  total: number;
  displayed: number;
  onChangeDisplayed?: (value: number) => void;
  className?: string;
  list?: number[];
  label?: string;
};

export type TablePaginationProps = {
  totalItems: number;
  page: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  className?: string;
};

export type DataTableProps<T> = TableProps<T> & {
  totalItems?: number;
  onPageChange?: (newPage: number) => void;
  onChangeDisplayed?: (value: number) => void;
  pageSizeList?: number[];
  showPagination?: boolean;
  showInfo?: boolean;
  footerClassName?: string;
};
