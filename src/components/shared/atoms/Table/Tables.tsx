import React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";
import type { TableProps } from "./types";

export const Tables = <T,>({
  columns,
  data,
  className,
  currentPage: page = 1,
  itemsPerPage: limit = 10,
  isLoading = false,
  skeletonRows = 5,
  emptyMessage,
  emptyTitle = "Tidak ada data yang ditemukan",
  emptyDescription = "Coba sesuaikan kata kunci pencarian atau filter Anda.",
  onRowClick,
  rowKey,
  rowClassName,
  autoPaginate = false,
}: TableProps<T>) => {
  // Slicing data jika autoPaginate aktif
  const displayData = autoPaginate
    ? data?.slice((page - 1) * limit, page * limit)
    : data;

  const getAlignClass = (align?: "left" | "center" | "right") => {
    if (align === "center") return "text-center";
    if (align === "right") return "text-right";
    return "text-left";
  };

  return (
    <div className="overflow-x-auto scrollbar rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-200">
      <table className={cn("w-full min-w-[680px] table-auto border-collapse", className)}>
        {/* Header */}
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/90 dark:border-slate-800 select-none text-slate-700 dark:text-slate-300">
            {columns.map((column, index) => (
              <th
                key={index}
                className={cn(
                  getAlignClass(column.align),
                  "font-heading font-semibold py-3.5 first:ps-5 last:pe-5 px-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200",
                  column.headerClassName,
                  column.className
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, rIdx) => (
              <tr key={`skeleton-${rIdx}`} className="animate-pulse">
                {columns.map((col, cIdx) => (
                  <td
                    key={`skeleton-col-${cIdx}`}
                    className={cn(
                      "py-4 first:ps-5 last:pe-5 px-3",
                      getAlignClass(col.align),
                      col.className
                    )}
                  >
                    <Skeleton className="h-4 w-4/5 rounded bg-slate-200/80 dark:bg-slate-800" />
                  </td>
                ))}
              </tr>
            ))
          ) : displayData && displayData.length > 0 ? (
            displayData.map((row, rowIndex) => {
              const actualIndex = autoPaginate
                ? (page - 1) * limit + rowIndex
                : rowIndex;
              const calculatedNumber = (page - 1) * limit + rowIndex + 1;
              const rowId = rowKey
                ? rowKey(row, rowIndex)
                : ((row as Record<string, unknown>)?.id ??
                   (row as Record<string, unknown>)?._id ??
                   rowIndex);

              return (
                <tr
                  key={String(rowId)}
                  onClick={() => onRowClick?.(row, actualIndex)}
                  className={cn(
                    "hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition-colors",
                    onRowClick && "cursor-pointer",
                    rowClassName?.(row, actualIndex)
                  )}
                >
                  {columns.map((column, colIndex) => {
                    let cellContent: React.ReactNode = null;

                    if (column.label === "No") {
                      cellContent = calculatedNumber;
                    } else if (column.renderCell) {
                      cellContent = column.renderCell(row, actualIndex);
                    } else if (column.accessorKey) {
                      const val = (row as Record<string, unknown>)[
                        column.accessorKey as string
                      ];
                      cellContent = val !== undefined && val !== null ? String(val) : "-";
                    }

                    return (
                      <td
                        key={colIndex}
                        className={cn(
                          getAlignClass(column.align),
                          "py-3.5 first:ps-5 last:pe-5 px-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-nunito align-middle",
                          column.className
                        )}
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center px-6 py-12 text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-nunito"
              >
                {emptyMessage ? (
                  emptyMessage
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500">
                      <Inbox size={20} />
                    </div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                      {emptyTitle}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {emptyDescription}
                    </p>
                  </div>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Tables;
