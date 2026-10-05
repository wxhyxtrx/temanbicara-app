import React from "react";
import { cn } from "@/lib/utils";

const Tables = <T,>({
  columns,
  data,
  className,
  currentPage: page = 1,
  itemsPerPage: limit = 10,
}: TableProps<T>) => {
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
                  column.className,
                  "font-heading font-semibold py-3.5 first:ps-5 last:pe-5 px-3 text-xs sm:text-sm text-left text-slate-700 dark:text-slate-200"
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        {/* Body */}
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data?.length > 0 ? (
            data.map((row, rowIndex) => {
              return (
                <tr
                  key={rowIndex}
                  className="hover:bg-teal-50/40 dark:hover:bg-teal-950/30 transition-colors"
                >
                  {columns.map((column, colIndex) => {
                    return (
                      <td
                        key={colIndex}
                        className={cn(
                          column.className,
                          "py-3.5 first:ps-5 last:pe-5 px-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-nunito align-middle"
                        )}
                      >
                        {column.label === "No" ? rowIndex + 1 : column.renderCell(row)}
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
                className="text-center px-6 py-10 text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-nunito"
              >
                Tidak ada data jadwal yang ditemukan.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Tables;
