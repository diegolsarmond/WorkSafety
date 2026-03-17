import React from 'react';

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  actions?: (row: T) => React.ReactNode;
}

export function Table<T extends { id: number }>({ data, columns, actions }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
            {actions && (
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Ações</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {data.map((row) => (
            <tr key={row.id}>
              {columns.map((col, i) => (
                <td key={i} className={`px-6 py-4 text-sm text-slate-900 ${col.className || 'whitespace-normal'}`}>
                  {typeof col.accessor === 'function' ? col.accessor(row) : (row[col.accessor] as React.ReactNode)}
                </td>
              ))}
              {actions && (
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {actions(row)}
                </td>
              )}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-4 text-center text-sm text-slate-500">
                Nenhum registro encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
