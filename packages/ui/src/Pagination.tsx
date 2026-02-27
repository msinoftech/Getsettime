"use client";

import React from "react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  itemLabel?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  loading = false,
  itemLabel = "items",
}: PaginationProps) {
  return (
    <div className="flex justify-between items-center">
      {totalItems > 0 && (
        <div className="text-center text-sm text-slate-500 pt-2">
          Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{" "}
          {itemLabel}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 pt-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              currentPage === 1 || loading
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            aria-label="Previous page"
          >
            Previous
          </button>
          {Array.from(
            { length: Math.min(totalPages, 10) },
            (_, index) => {
              let pageNum: number;
              if (totalPages <= 10) {
                pageNum = index + 1;
              } else if (currentPage <= 5) {
                pageNum = index + 1;
              } else if (currentPage >= totalPages - 4) {
                pageNum = totalPages - 9 + index;
              } else {
                pageNum = currentPage - 5 + index;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    currentPage === pageNum
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                  aria-label={`Go to page ${pageNum}`}
                >
                  {pageNum}
                </button>
              );
            }
          )}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              currentPage === totalPages || loading
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
