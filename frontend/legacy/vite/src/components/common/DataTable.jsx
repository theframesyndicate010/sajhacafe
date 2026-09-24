import { useEffect, useMemo, useState } from "react";

import EmptyState from "./EmptyState.jsx";

export default function DataTable({
  columns,
  rows,
  title,
  searchPlaceholder = "Search records (khojnu)",
  pageSizeOptions = [5, 10, 20, 50],
  rowKey = (row) => row.id,
}) {
  const [searchValue, setSearchValue] = useState("");
  const [pageSize, setPageSize] = useState(pageSizeOptions[1] || 10);
  const [pageIndex, setPageIndex] = useState(0);
  const normalizedSearch = searchValue.trim().toLowerCase();
  const hasSearch = Boolean(normalizedSearch);

  const filteredRows = useMemo(() => {
    if (!hasSearch) {
      return rows;
    }

    return rows.filter((row) =>
      columns.some((column) => {
        const value = column.searchAccessor
          ? column.searchAccessor(row)
          : row[column.key];

        return String(value ?? "").toLowerCase().includes(normalizedSearch);
      }),
    );
  }, [columns, hasSearch, normalizedSearch, rows]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const visibleStart = filteredRows.length ? safePageIndex * pageSize + 1 : 0;
  const visibleEnd = filteredRows.length ? Math.min((safePageIndex + 1) * pageSize, filteredRows.length) : 0;

  useEffect(() => {
    if (pageIndex > pageCount - 1) {
      setPageIndex(Math.max(pageCount - 1, 0));
    }
  }, [pageCount, pageIndex]);

  const paginatedRows = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePageIndex, pageSize]);

  const emptyTitle = hasSearch ? "No match bhetiyena" : "Aile samma records chaina";
  const emptyMessage = hasSearch
    ? `"${searchValue.trim()}" ko result bhetiyena. Arko keyword try garnus.`
    : "Data add garepachi records yahi dekhincha.";

  return (
    <div>
      <div className="filter-toolbar">
        <div className="filter-input-wrap">
          <input
            aria-label={title ? `Search ${title}` : "Search records"}
            className="filter-input"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={searchPlaceholder}
            type="search"
            value={searchValue}
          />

          {hasSearch ? (
            <button
              className="filter-clear-btn"
              onClick={() => {
                setSearchValue("");
                setPageIndex(0);
              }}
              type="button"
            >
              Clear search
            </button>
          ) : null}
        </div>

        <select
          aria-label="Rows per page"
          className="filter-select"
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value));
            setPageIndex(0);
          }}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              Show {option}
            </option>
          ))}
        </select>

        <span className="invoice-meta">
          {title ? `${title}: ` : ""}
          {filteredRows.length} record{filteredRows.length === 1 ? "" : "s"}
        </span>
      </div>

      <p className="table-status-strip">
        {filteredRows.length
          ? `Showing ${visibleStart}-${visibleEnd} of ${filteredRows.length} records`
          : "Aile 0 records dekhaudai"}
        {hasSearch ? ` (filter gareko ${rows.length} bata)` : ""}
      </p>

      {paginatedRows.length ? (
        <div className="table-wrap">
          <table className="premium-table">
            <thead>
              <tr>
                {columns.map((column, columnIndex) => (
                  <th key={column.key || `${column.label}-${columnIndex}`}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column, columnIndex) => (
                    <td key={`${rowKey(row)}-${column.key || columnIndex}`}>
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          actionLabel={hasSearch ? "Search clear garnus" : undefined}
          message={emptyMessage}
          onAction={
            hasSearch
              ? () => {
                  setSearchValue("");
                  setPageIndex(0);
                }
              : undefined
          }
          title={emptyTitle}
        />
      )}

      {filteredRows.length ? (
        <div className="filter-toolbar table-pagination">
          <button
            aria-label="Go to previous page"
            className="icon-btn table-page-btn"
            disabled={safePageIndex === 0}
            onClick={() => setPageIndex((previous) => Math.max(previous - 1, 0))}
            type="button"
          >
            Prev
          </button>
          <span className="invoice-meta">
            Page {safePageIndex + 1} / {pageCount}
          </span>
          <button
            aria-label="Go to next page"
            className="icon-btn table-page-btn"
            disabled={safePageIndex >= pageCount - 1}
            onClick={() => setPageIndex((previous) => Math.min(previous + 1, pageCount - 1))}
            type="button"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
