import React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TablePaginationProps } from "./types";

export function TablePagination({
  limit,
  onPageChange,
  page,
  totalItems,
  className,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages && newPage !== page) {
      onPageChange(newPage);
    }
  };

  const maxVisiblePages = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  const pages = [];

  // Previous button
  pages.push(
    <PaginationItem key="prev">
      <button
        type="button"
        className="size-8 justify-center items-center flex rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
        onClick={() => handlePageChange(page - 1)}
        disabled={page === 1}
        aria-label="Halaman Sebelumnya"
      >
        <ChevronLeft className="size-4" />
      </button>
    </PaginationItem>
  );

  // First page if needed
  if (startPage > 1) {
    pages.push(
      <PaginationItem key={1}>
        <button
          type="button"
          className={cn(
            "size-8 justify-center items-center flex rounded-lg text-xs font-semibold transition-colors cursor-pointer",
            page === 1
              ? "bg-teal-50 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
          )}
          onClick={() => handlePageChange(1)}
        >
          1
        </button>
      </PaginationItem>
    );

    if (startPage > 2) {
      pages.push(
        <PaginationItem key="ellipsis-start">
          <span className="size-8 justify-center items-center flex text-slate-400 text-xs">...</span>
        </PaginationItem>
      );
    }
  }

  // Visible pages
  for (let i = startPage; i <= endPage; i++) {
    pages.push(
      <PaginationItem key={i}>
        <button
          type="button"
          className={cn(
            "size-8 justify-center items-center flex rounded-lg text-xs font-semibold transition-colors cursor-pointer",
            page === i
              ? "bg-teal-50 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
          )}
          onClick={() => handlePageChange(i)}
        >
          {i}
        </button>
      </PaginationItem>
    );
  }

  // End ellipsis
  if (endPage < totalPages - 1) {
    pages.push(
      <PaginationItem key="ellipsis-end">
        <span className="size-8 justify-center items-center flex text-slate-400 text-xs">...</span>
      </PaginationItem>
    );
  }

  // Last page if needed
  if (endPage < totalPages) {
    pages.push(
      <PaginationItem key={totalPages}>
        <button
          type="button"
          className={cn(
            "size-8 justify-center items-center flex rounded-lg text-xs font-semibold transition-colors cursor-pointer",
            page === totalPages
              ? "bg-teal-50 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
          )}
          onClick={() => handlePageChange(totalPages)}
        >
          {totalPages}
        </button>
      </PaginationItem>
    );
  }

  // Next button
  pages.push(
    <PaginationItem key="next">
      <button
        type="button"
        className="size-8 justify-center items-center flex rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
        onClick={() => handlePageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Halaman Selanjutnya"
      >
        <ChevronRight className="size-4" />
      </button>
    </PaginationItem>
  );

  return (
    <Pagination className={cn("justify-end m-0 w-fit", className)}>
      <PaginationContent className="gap-1">{pages}</PaginationContent>
    </Pagination>
  );
}

export default TablePagination;
