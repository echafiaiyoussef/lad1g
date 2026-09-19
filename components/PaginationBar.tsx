import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
  scrollToTop?: boolean;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalItems,
  pageSize = 30,
  onPageChange,
  itemLabel = 'عنصر',
  className = '',
  scrollToTop = true
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  if (totalItems <= 0) return null;

  const startIndex = (safeCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(safeCurrentPage * pageSize, totalItems);

  const handlePageClick = (page: number) => {
    if (page === safeCurrentPage || page < 1 || page > totalPages) return;
    onPageChange(page);
    if (scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Generate page numbers with ellipsis if many pages
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    pages.push(1);

    if (safeCurrentPage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(totalPages - 1, safeCurrentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (safeCurrentPage < totalPages - 2) {
      pages.push('...');
    }

    pages.push(totalPages);
    return pages;
  };

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-xs text-xs font-bold text-slate-600 select-none ${className}`}
      dir="rtl"
    >
      {/* Items Range Summary */}
      <div className="flex items-center gap-2 text-slate-500 flex-wrap justify-center sm:justify-start">
        <span>عرض</span>
        <span className="font-black text-indigo-700 font-mono bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
          {startIndex} - {endIndex}
        </span>
        <span>من أصل</span>
        <span className="font-black text-slate-800 font-mono">{totalItems}</span>
        <span>{itemLabel}</span>
        <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
          ({pageSize} بالصفحة)
        </span>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {/* First page button */}
        {totalPages > 5 && (
          <button
            type="button"
            disabled={safeCurrentPage <= 1}
            onClick={() => handlePageClick(1)}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer text-slate-600"
            title="الصفحة الأولى"
          >
            <ChevronsRight size={15} />
          </button>
        )}

        {/* Previous page button (RTL: ChevronRight goes backward) */}
        <button
          type="button"
          disabled={safeCurrentPage <= 1}
          onClick={() => handlePageClick(safeCurrentPage - 1)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1 cursor-pointer text-slate-700 font-black"
          title="الصفحة السابقة"
        >
          <ChevronRight size={15} />
          <span>السابق</span>
        </button>

        {/* Page pills */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-7 text-center text-slate-400 font-mono select-none"
                >
                  •••
                </span>
              );
            }
            const isCurrent = p === safeCurrentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => handlePageClick(p as number)}
                className={`w-8 h-8 rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-2 ring-indigo-200 scale-105'
                    : 'bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200/80 text-slate-700'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next page button (RTL: ChevronLeft goes forward) */}
        <button
          type="button"
          disabled={safeCurrentPage >= totalPages}
          onClick={() => handlePageClick(safeCurrentPage + 1)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1 cursor-pointer text-slate-700 font-black"
          title="الصفحة التالية"
        >
          <span>التالي</span>
          <ChevronLeft size={15} />
        </button>

        {/* Last page button */}
        {totalPages > 5 && (
          <button
            type="button"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => handlePageClick(totalPages)}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer text-slate-600"
            title="الصفحة الأخيرة"
          >
            <ChevronsLeft size={15} />
          </button>
        )}
      </div>
    </div>
  );
};
