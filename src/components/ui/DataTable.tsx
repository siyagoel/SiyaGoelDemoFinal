import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  width?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  emptyMessage?: string;
}

/**
 * Shared table shell for every tool in the app: columns are declared per tool,
 * layout, empty state and row styling stay consistent.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  emptyMessage = "No records found.",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center text-sm text-faint">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-subtle">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={`whitespace-nowrap px-4 py-2.5 text-2xs font-medium uppercase tracking-wider text-faint ${
                  column.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row)}
              data-href={rowHref?.(row)}
              className="group border-b border-line/60 transition-colors last:border-0 hover:bg-panel-hover"
              style={{ animation: `rise 240ms cubic-bezier(0.22,1,0.36,1) ${Math.min(index, 12) * 12}ms both` }}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-4 py-3 align-middle ${
                    column.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
