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

  const getRowId = (row: T, rowIndex: number) =>
    rowKey
      ? rowKey(row, rowIndex)
      : ((row as Record<string, unknown>)?.id ??
         (row as Record<string, unknown>)?._id ??
         rowIndex);

  const renderCellContent = (column: TableProps<T>["columns"][number], row: T, actualIndex: number, calculatedNumber: number): React.ReactNode => {
    if (column.label === "No") return calculatedNumber;
    if (column.renderCell) return column.renderCell(row, actualIndex);
    if (column.accessorKey) {
      const val = (row as Record<string, unknown>)[column.accessorKey as string];
      return val !== undefined && val !== null ? String(val) : "-";
    }
    return null;
  };

  const emptyState = emptyMessage ? (
    emptyMessage
  ) : (
    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500">
        <Inbox size={20} />
      </div>
      <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{emptyTitle}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">{emptyDescription}</p>
    </div>
  );

  const getAlignClass = (align?: "left" | "center" | "right") => {
    if (align === "center") return "text-center";
    if (align === "right") return "text-right";
    return "text-left";
  };

  return (
    <>
    {/* HP: setiap baris jadi kartu label + nilai (tabel lebar sulit dibaca di layar kecil) */}
    <div className="md:hidden space-y-3">
      {isLoading ? (
        Array.from({ length: Math.min(skeletonRows, 3) }).map((_, i) => (
          <div key={`m-skeleton-${i}`} className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5 animate-pulse">
            <Skeleton className="h-4 w-2/3 rounded bg-slate-200/80 dark:bg-slate-800" />
            <Skeleton className="h-3 w-full rounded bg-slate-200/80 dark:bg-slate-800" />
            <Skeleton className="h-3 w-4/5 rounded bg-slate-200/80 dark:bg-slate-800" />
          </div>
        ))
      ) : displayData && displayData.length > 0 ? (
        displayData.map((row, rowIndex) => {
          const actualIndex = autoPaginate ? (page - 1) * limit + rowIndex : rowIndex;
          const calculatedNumber = (page - 1) * limit + rowIndex + 1;
          const [first, ...rest] = columns;
          return (
            <div
              key={String(getRowId(row, rowIndex))}
              onClick={() => onRowClick?.(row, actualIndex)}
              className={cn(
                "rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-sm text-slate-800 dark:text-slate-200 font-nunito min-w-0",
                onRowClick && "cursor-pointer",
                rowClassName?.(row, actualIndex)
              )}
            >
              {first && <div className="min-w-0">{renderCellContent(first, row, actualIndex, calculatedNumber)}</div>}
              {rest.length > 0 && (
                <dl className="space-y-2.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                  {rest.map((column, colIndex) => (
                    <div key={colIndex} className="flex items-start justify-between gap-3 min-w-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 shrink-0 pt-0.5">{column.label}</dt>
                      <dd className="min-w-0 text-right flex justify-end">{renderCellContent(column, row, actualIndex, calculatedNumber)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          );
        })
      ) : (
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-center px-6 py-10 text-xs text-slate-400 dark:text-slate-500 font-nunito">
          {emptyState}
        </div>
      )}
    </div>

    <div className="hidden md:block overflow-x-auto scrollbar rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-200">
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
              const rowId = getRowId(row, rowIndex);

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
                    const cellContent = renderCellContent(column, row, actualIndex, calculatedNumber);

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
                {emptyState}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </>
  );
};

export default Tables;
