import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Download, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotification } from '../components/Notification';
import Modal from '../components/Modal';
import { DynamicTable } from '../components/DynamicTable';
import { DynamicForm } from '../components/DynamicForm';
import { modelApi } from '../lib/api-client';
import { ModelConfig, modelConfigs } from '../config/models.config';
import { useAuthStore } from '../stores/auth.store';

export function DynamicCRUDPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { notify } = useNotification();

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Get model configuration from URL path
  const pathParts = location.pathname.split('/');
  const modelPlural = pathParts[pathParts.length - 1];

  // Find the model configuration by matching the plural name
  const modelConfig = Object.values(modelConfigs).find(config => config.plural === modelPlural);

  // Check permissions
  const canCreate = modelConfig?.permissions?.create.includes(user?.role || '') ?? false;
  const canEdit = modelConfig?.permissions?.update.includes(user?.role || '') ?? false;
  const canDelete = modelConfig?.permissions?.delete.includes(user?.role || '') ?? false;

  // Fetch data
  const { data, isLoading, refetch } = useQuery({
    queryKey: [modelPlural, page, limit, sortField, sortOrder, searchTerm, filters],
    queryFn: () =>
      modelApi.list(modelPlural, {
        page,
        limit,
        sort: sortField,
        order: sortOrder,
        search: searchTerm,
        ...filters,
      }),
    enabled: !!modelPlural && !!modelConfig,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => modelApi.create(modelPlural, data),
    onSuccess: () => {
      notify(`${modelConfig?.displayName} created successfully`, { type: 'success' });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: [modelPlural] });
    },
    onError: (error: any) => {
      notify(error.response?.data?.message || 'Create failed', { type: 'error' });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      modelApi.update(modelPlural, id, data),
    onSuccess: () => {
      notify(`${modelConfig?.displayName} updated successfully`, { type: 'success' });
      setShowForm(false);
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: [modelPlural] });
    },
    onError: (error: any) => {
      notify(error.response?.data?.message || 'Update failed', { type: 'error' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => modelApi.delete(modelPlural, id),
    onSuccess: () => {
      notify(`${modelConfig?.displayName} deleted successfully`, { type: 'success' });
      queryClient.invalidateQueries({ queryKey: [modelPlural] });
    },
    onError: (error: any) => {
      notify(error.response?.data?.message || 'Delete failed', { type: 'error' });
    },
  });

  const handleSubmit = async (formData: any) => {
    if (editingItem) {
      await updateMutation.mutateAsync({ id: editingItem.id, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleDelete = (item: any) => {
    if (window.confirm(`Are you sure you want to delete this ${modelConfig?.displayName}?`)) {
      deleteMutation.mutate(item.id);
    }
  };

  const handleSort = (field: string, order: 'asc' | 'desc') => {
    setSortField(field);
    setSortOrder(order);
    setPage(1);
  };

  if (!modelConfig) {
    return <div>Model configuration not found</div>;
  }

  // Build table columns
  const columns = (modelConfig.listFields || ['id']).map((fieldName) => {
    const field = modelConfig.fields.find((f) => f.name === fieldName);
    return {
      key: fieldName,
      label: field?.label || fieldName,
      sortable: field?.sortable,
    };
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {modelConfig.plural.charAt(0).toUpperCase() + modelConfig.plural.slice(1)}
        </h1>
        <p className="text-gray-600">
          Manage your {modelConfig.plural.toLowerCase()}
        </p>
      </div>

      {/* Actions bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={`Search ${modelConfig.plural}...`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>

          {canCreate && (
            <button
              onClick={() => {
                setEditingItem(null);
                setShowForm(true);
              }}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add {modelConfig.displayName}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <DynamicTable
        data={data?.data || []}
        columns={columns}
        onEdit={canEdit ? handleEdit : undefined}
        onDelete={canDelete ? handleDelete : undefined}
        onSort={handleSort}
        sortField={sortField}
        sortOrder={sortOrder}
        pagination={data?.pagination}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingItem(null);
        }}
        title={`${editingItem ? 'Edit' : 'Create'} ${modelConfig.displayName}`}
        size="lg"
      >
        <DynamicForm
          fields={modelConfig.fields.filter((f) => !f.hidden && !f.readOnly)}
          onSubmit={handleSubmit}
          initialData={editingItem}
          isLoading={createMutation.isPending || updateMutation.isPending}
          onCancel={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
        />
      </Modal>
    </div>
  );
}