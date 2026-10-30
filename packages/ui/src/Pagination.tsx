"use client";

import React, { useEffect, useState } from "react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  itemLabel?: string;
}

type PageItem = number | "ellipsis";

function buildPageList(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 1) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(2);
  pages.add(totalPages - 1);
  pages.add(totalPages);
  pages.add(currentPage);
  if (currentPage > 1) pages.add(currentPage - 1);
  if (currentPage < totalPages) pages.add(currentPage + 1);

  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const result: PageItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(sorted[i]);
  }
  return result;
}

const paginationBtnBase =
  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 border";

const paginationBtnEnabled =
  "bg-indigo-100 border-indigo-300 text-indigo-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600";

const paginationBtnDisabled =
  "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200";

const navButtonClass = (disabled: boolean) =>
  `${paginationBtnBase} ${disabled ? paginationBtnDisabled : paginationBtnEnabled}`;

const pageButtonClass = (active: boolean, loading: boolean) =>
  `${paginationBtnBase} min-w-[2.25rem] ${
    active
      ? "bg-indigo-600 text-white border-indigo-600"
      : paginationBtnEnabled
  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`;

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  loading = false,
  itemLabel = "items",
}: PaginationProps) {
  const [jumpValue, setJumpValue] = useState(String(currentPage));

  useEffect(() => {
    setJumpValue(String(currentPage));
  }, [currentPage]);

  const pageItems = buildPageList(currentPage, totalPages);

  const goToPage = (page: number) => {
    if (loading || page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
  };

  const handleJumpChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = event.target.value.replace(/\D/g, "");
    setJumpValue(digitsOnly);
  };

  const handleJumpSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!jumpValue) {
      setJumpValue(String(currentPage));
      return;
    }
    const parsed = parseInt(jumpValue, 10);
    const clamped = Math.min(Math.max(parsed, 1), totalPages);
    setJumpValue(String(clamped));
    goToPage(clamped);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-center mt-4">
      {totalItems > 0 && (
        <div className="text-center text-sm text-slate-600">
          Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{" "}
          {itemLabel}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap justify-center items-center gap-2">
          <form
            onSubmit={handleJumpSubmit}
            className="flex items-center gap-1.5 mr-1 sm:mr-2"
          >
            <label htmlFor="pagination-jump" className="sr-only">
              Go to page
            </label>
            <input
              id="pagination-jump"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={jumpValue}
              onChange={handleJumpChange}
              disabled={loading}
              className="w-14 px-2 py-1.5 rounded-lg text-sm text-center border border-indigo-300 text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
              aria-label={`Page number, 1 to ${totalPages}`}
            />
            <button
              type="submit"
              disabled={loading || !jumpValue}
              className={navButtonClass(loading || !jumpValue)}
            >
              Go
            </button>
          </form>

          <button
            type="button"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1 || loading}
            className={navButtonClass(currentPage === 1 || loading)}
            aria-label="First page"
          >
            First
          </button>
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            className={navButtonClass(currentPage === 1 || loading)}
            aria-label="Previous page"
          >
            Prev
          </button>

          {pageItems.map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-1 text-sm text-slate-500 select-none"
                aria-hidden
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => goToPage(item)}
                disabled={loading}
                className={pageButtonClass(currentPage === item, loading)}
                aria-label={`Go to page ${item}`}
                aria-current={currentPage === item ? "page" : undefined}
              >
                {item}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
            className={navButtonClass(currentPage === totalPages || loading)}
            aria-label="Next page"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages || loading}
            className={navButtonClass(currentPage === totalPages || loading)}
            aria-label="Last page"
          >
            Last
          </button>
        </div>
      )}
    </div>
  );
}
