import React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  totalItems: number; // Total number of items
  page: number; // Current page number
  limit: number; // Number of items per page
  onPageChange: (newPage: number) => void; // Function to handle page changes
};

function TablePagination({ limit, onPageChange, page, totalItems }: Props) {
  const totalPages = Math.ceil(totalItems / limit);
  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  };

  // Calculate the range of pages to display
  const maxVisiblePages = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  // Adjust startPage if endPage is less than maxVisiblePages
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  const pages = [];

  // Add previous button
  pages.push(
    <PaginationItem key="prev">
      <button
        className="size-8 justify-center items-center flex disabled:cursor-not-allowed"
        onClick={() => handlePageChange(page - 1)}
        disabled={page === 1}
      >
        <ChevronLeft className={cn(page === 1 && "text-neutral-600")} />
      </button>
    </PaginationItem>
  );

  // Add first page if needed
  if (startPage > 1) {
    pages.push(
      <PaginationItem key={1}>
        <button
          className={cn(
            "size-8 justify-center items-center flex disabled:cursor-not-allowed",
            page === 1 && "text-black bg-green-50 rounded-md"
          )}
          onClick={() => handlePageChange(1)}
        >
          <p>1</p>
        </button>
      </PaginationItem>
    );

    // Add ellipsis if there are pages between the first page and the startPage
    if (startPage > 2) {
      pages.push(
        <PaginationItem key="ellipsis-start">
          <span className="size-8 justify-center items-center flex">...</span>
        </PaginationItem>
      );
    }
  }

  // Add visible pages
  for (let i = startPage; i <= endPage; i++) {
    pages.push(
      <PaginationItem key={i}>
        <button
          className={cn(
            "size-8 justify-center items-center flex disabled:cursor-not-allowed text-sm",
            page === i && "text-black bg-green-50 rounded-md"
          )}
          onClick={() => handlePageChange(i)}
        >
          <p>{i}</p>
        </button>
      </PaginationItem>
    );
  }

  // Add ellipsis if there are pages between the endPage and the last page
  if (endPage < totalPages - 1) {
    pages.push(
      <PaginationItem key="ellipsis-end">
        <span className="size-8 justify-center items-center flex">...</span>
      </PaginationItem>
    );
  }

  // Add last page if needed
  if (endPage < totalPages) {
    pages.push(
      <PaginationItem key={totalPages}>
        <button
          className={cn(
            "size-8 justify-center items-center flex disabled:cursor-not-allowed text-sm",
            page === totalPages && "text-black bg-green-50 rounded-md"
          )}
          onClick={() => handlePageChange(totalPages)}
        >
          <p>{totalPages}</p>
        </button>
      </PaginationItem>
    );
  }

  // Add next button
  pages.push(
    <PaginationItem key="next">
      <button
        className="size-8 justify-center items-center flex disabled:cursor-not-allowed"
        onClick={() => handlePageChange(page + 1)}
        disabled={page === totalPages}
      >
        <ChevronRight
          className={cn(page === totalPages && " text-neutral-600")}
        />
      </button>
    </PaginationItem>
  );

  return (
    <Pagination className="justify-end m-0 w-fit">
      <PaginationContent className="">{pages}</PaginationContent>
    </Pagination>
  );
}

export default TablePagination;
