import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Eye,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { FieldConfig } from '../config/models.config';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  format?: (value: any, row: any) => React.ReactNode;
}

interface DynamicTableProps {
  data: any[];
  columns: Column[];
  onView?: (item: any) => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  onSort?: (field: string, order: 'asc' | 'desc') => void;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
}

export function DynamicTable({
  data,
  columns,
  onView,
  onEdit,
  onDelete,
  onSort,
  sortField,
  sortOrder,
  pagination,
  onPageChange,
  isLoading = false,
}: DynamicTableProps) {
  const handleSort = (column: Column) => {
    if (!column.sortable || !onSort) return;

    const newOrder =
      sortField === column.key && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(column.key, newOrder);
  };

  const formatValue = (value: any, column: Column, row: any) => {
    if (column.format) {
      return column.format(value, row);
    }

    if (value === null || value === undefined) {
      return <span className="text-gray-400">-</span>;
    }

    if (typeof value === 'boolean') {
      return (
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            value
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {value ? 'Yes' : 'No'}
        </span>
      );
    }

    if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
      return new Date(value).toLocaleDateString();
    }

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return value;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.sortable ? 'cursor-pointer select-none' : ''}
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {column.sortable && (
                      <div className="flex flex-col">
                        <ChevronUp
                          className={`w-3 h-3 -mb-1 ${
                            sortField === column.key && sortOrder === 'asc'
                              ? 'text-gray-900'
                              : 'text-gray-400'
                          }`}
                        />
                        <ChevronDown
                          className={`w-3 h-3 ${
                            sortField === column.key && sortOrder === 'desc'
                              ? 'text-gray-900'
                              : 'text-gray-400'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                </th>
              ))}
              {(onView || onEdit || onDelete) && (
                <th className="text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={row.id || index}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {formatValue(row[column.key], column, row)}
                  </td>
                ))}
                {(onView || onEdit || onDelete) && (
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onView && (
                        <button
                          onClick={() => onView(row)}
                          className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(row)}
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <div className="flex items-center text-sm text-gray-700">
            <span>
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} results
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => onPageChange?.(page)}
                    className={`w-8 h-8 rounded transition-colors ${
                      page === pagination.page
                        ? 'bg-gray-900 text-white'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}