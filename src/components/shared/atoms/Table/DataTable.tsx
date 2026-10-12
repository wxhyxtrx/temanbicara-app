import React from "react";
import { cn } from "@/lib/utils";
import { Tables } from "./Tables";
import { TableInfo } from "./TableInfo";
import { TablePagination } from "./TablePagination";
import type { DataTableProps } from "./types";

export const DataTable = <T,>({
  columns,
  data,
  className,
  currentPage = 1,
  itemsPerPage = 10,
  totalItems,
  isLoading = false,
  skeletonRows = 5,
  emptyMessage,
  emptyTitle,
  emptyDescription,
  onRowClick,
  rowKey,
  autoPaginate = false,
  onPageChange,
  onChangeDisplayed,
  pageSizeList = [10, 15, 20, 25],
  showPagination = true,
  showInfo = true,
  footerClassName,
}: DataTableProps<T>) => {
  const actualTotal = totalItems !== undefined ? totalItems : data?.length || 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* 1. Main Table */}
      <Tables
        columns={columns}
        data={data}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        isLoading={isLoading}
        skeletonRows={skeletonRows}
        emptyMessage={emptyMessage}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        onRowClick={onRowClick}
        rowKey={rowKey}
        autoPaginate={autoPaginate}
      />

      {/* 2. Pagination & Footer Info */}
      {(showPagination || showInfo) && actualTotal > 0 && (
        <div
          className={cn(
            "flex flex-col sm:flex-row justify-between items-center gap-4 pt-1",
            footerClassName
          )}
        >
          {showInfo && (
            <TableInfo
              total={actualTotal}
              displayed={itemsPerPage}
              onChangeDisplayed={onChangeDisplayed}
              list={pageSizeList}
            />
          )}

          {showPagination && onPageChange && (
            <TablePagination
              totalItems={actualTotal}
              page={currentPage}
              limit={itemsPerPage}
              onPageChange={onPageChange}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default DataTable;
