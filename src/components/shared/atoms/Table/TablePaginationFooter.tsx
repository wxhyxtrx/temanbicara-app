import React from "react";
import { cn } from "@/lib/utils";
import { TableInfo } from "./TableInfo";
import { TablePagination } from "./TablePagination";
import type { TablePaginationFooterProps } from "./types";

export function TablePaginationFooter({
  totalItems,
  page,
  limit,
  onPageChange,
  onChangeLimit,
  limitList = [10, 20, 50],
  className,
  showWhenEmpty = false,
}: TablePaginationFooterProps) {
  if (!showWhenEmpty && totalItems <= 0) {
    return null;
  }

  const handleLimitChange = (newLimit: number) => {
    if (onChangeLimit) {
      onChangeLimit(newLimit);
      const nextTotalPages = Math.max(1, Math.ceil(totalItems / newLimit));
      if (page > nextTotalPages) {
        onPageChange(1);
      }
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row justify-between items-center gap-4 px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800",
        className
      )}
    >
      <TableInfo
        total={totalItems}
        displayed={limit}
        onChangeDisplayed={onChangeLimit ? handleLimitChange : undefined}
        list={limitList}
      />
      <TablePagination
        totalItems={totalItems}
        page={page}
        limit={limit}
        onPageChange={onPageChange}
      />
    </div>
  );
}

export default TablePaginationFooter;
