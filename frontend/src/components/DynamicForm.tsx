import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FieldConfig } from '../config/models.config';
import { Loader2, ImageIcon, X } from 'lucide-react';
import { modelApi, apiClient } from '../lib/api-client';
import { SearchableSelect } from './SearchableSelect';
import { FilePicker } from './FilePicker';

interface DynamicFormProps {
  fields: FieldConfig[];
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  isLoading?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
}

export function DynamicForm({
  fields,
  onSubmit,
  initialData = {},
  isLoading = false,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  onCancel,
}: DynamicFormProps) {
  // State for relation field options
  const [relationOptions, setRelationOptions] = useState<Record<string, { value: string; label: string }[]>>({});
  const [loadingRelations, setLoadingRelations] = useState(true);

  // State for file picker
  const [filePickerOpen, setFilePickerOpen] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<Record<string, any>>({});

  // Determine if this is a create or edit operation
  const isEditMode = initialData && Object.keys(initialData).length > 0 && initialData.id;

  // Build validation schema
  const schema = z.object(
    fields.reduce((acc, field) => {
      // Skip hidden fields in validation, except password in create mode
      if (field.hidden && !(field.type === 'password' && !isEditMode)) return acc;
      if (field.readOnly) return acc;

      let fieldSchema: any = z.any();

      switch (field.type) {
        case 'text':
        case 'email':
        case 'password':
        case 'textarea':
          fieldSchema = z.string();
          if (field.type === 'email') {
            fieldSchema = fieldSchema.email();
          }
          break;
        case 'number':
          fieldSchema = z.number();
          if (field.min !== undefined) fieldSchema = fieldSchema.min(field.min);
          if (field.max !== undefined) fieldSchema = fieldSchema.max(field.max);
          break;
        case 'decimal':
          fieldSchema = z.string().transform((val) => parseFloat(val));
          break;
        case 'checkbox':
          fieldSchema = z.boolean();
          break;
        case 'date':
          fieldSchema = z.string();
          break;
        case 'select':
          fieldSchema = z.string();
          break;
        case 'array':
          fieldSchema = z.array(z.string());
          break;
        case 'json':
          fieldSchema = z.string();
          break;
      }

      // Make field optional if:
      // 1. Field is not required, OR
      // 2. Field is password in edit mode (password changes are optional)
      if (!field.required || (field.type === 'password' && isEditMode)) {
        fieldSchema = fieldSchema.optional();
      }

      acc[field.name] = fieldSchema;
      return acc;
    }, {} as any)
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialData,
  });

  // Fetch options for relation fields
  useEffect(() => {
    const fetchRelationOptions = async () => {
      setLoadingRelations(true);
      const options: Record<string, { value: string; label: string }[]> = {};

      // Find all fields with relations
      const relationFields = fields.filter(field => field.relation);

      // Fetch data for each relation
      await Promise.all(
        relationFields.map(async (field) => {
          if (!field.relation) return;

          try {
            const { model, valueField = 'id', labelField = 'name', labelFields } = field.relation;

            // Fetch data from API - use plural form
            const plural = model === 'category' ? 'categories' : model + 's';
            const response = await modelApi.list(plural, { limit: 1000 });

            // Extract items array from response
            // Backend returns: { data: [...], pagination: {...} }
            let items = response?.data ?? [];

            // Ensure items is an array
            if (!Array.isArray(items)) {
              console.warn(`Expected array for ${field.name}, got:`, items);
              items = [];
            }

            console.log(`[DynamicForm] Fetched ${items.length} items for ${field.name} (${model}):`, items);

            // Transform to options
            options[field.name] = items.map((item: any) => {
              let label: string;

              // If labelFields is provided, combine multiple fields
              if (labelFields && labelFields.length > 0) {
                label = labelFields
                  .map(fieldName => item[fieldName])
                  .filter(Boolean)
                  .join(' ');
              } else {
                label = item[labelField] || item.name || item.id;
              }

              return {
                value: item[valueField],
                label,
              };
            });
          } catch (error) {
            console.error(`Failed to fetch options for ${field.name}:`, error);
            options[field.name] = [];
          }
        })
      );

      setRelationOptions(options);
      setLoadingRelations(false);
    };

    fetchRelationOptions();
  }, [fields]);

  // Fetch file preview data when file relations change
  useEffect(() => {
    const fetchFilePreviews = async () => {
      const fileFields = fields.filter(field => field.relation?.model === 'file');

      for (const field of fileFields) {
        const fileId = initialData?.[field.name] || watch(field.name);
        if (fileId && !filePreview[fileId]) {
          try {
            const response = await apiClient.get(`/files/${fileId}`);
            setFilePreview(prev => ({ ...prev, [fileId]: response.data }));
          } catch (error) {
            console.error(`Failed to fetch file preview for ${field.name}:`, error);
          }
        }
      }
    };

    fetchFilePreviews();
  }, [fields, initialData]);

  const renderField = (field: FieldConfig) => {
    if (field.hidden) return null;

    const commonProps = {
      ...register(field.name),
      disabled: field.readOnly || isLoading,
      className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
        errors[field.name] ? 'border-red-500' : 'border-gray-300'
      } ${field.readOnly || isLoading ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}`,
      placeholder: field.placeholder,
    };

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={field.rows || 3}
            className={`${commonProps.className} resize-none`}
          />
        );

      case 'select':
        // Check if this is a file relation field
        const isFileRelation = field.relation?.model === 'file';
        const selectedFileId = watch(field.name);
        const selectedFile = selectedFileId ? filePreview[selectedFileId] : null;

        if (isFileRelation && field.relation?.filePicker) {
          // Use FilePicker for file relations
          return (
            <div className="space-y-2">
              {selectedFile && field.relation.filePicker.showPreview && (
                <div className="relative inline-block">
                  <img
                    src={selectedFile.url}
                    alt={selectedFile.originalName}
                    className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setValue(field.name, '');
                      setFilePreview(prev => {
                        const newPrev = { ...prev };
                        delete newPrev[selectedFileId];
                        return newPrev;
                      });
                    }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setFilePickerOpen(field.name)}
                disabled={field.readOnly || isLoading}
                className={`w-full px-4 py-2 border rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors ${
                  errors[field.name] ? 'border-red-500' : 'border-gray-300'
                } ${field.readOnly || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <ImageIcon className="w-4 h-4" />
                {selectedFile ? selectedFile.originalName : `Select ${field.label}`}
              </button>

              {/* File Picker Modal */}
              {filePickerOpen === field.name && (
                <FilePicker
                  isOpen={true}
                  onClose={() => setFilePickerOpen(null)}
                  onSelect={async (file) => {
                    setValue(field.name, file.id);
                    setFilePreview(prev => ({ ...prev, [file.id]: file }));
                  }}
                  selectedFileId={selectedFileId}
                  filterMimeTypes={field.relation.filePicker.filterMimeTypes}
                  filterFolders={field.relation.filePicker.filterFolders}
                  defaultUploadFolder={field.relation.filePicker.defaultUploadFolder}
                  title={`Select ${field.label}`}
                />
              )}
            </div>
          );
        }

        // Use relation options if available, otherwise use static options
        const options = field.relation ? relationOptions[field.name] : field.options;
        const isLoadingOptions = field.relation && loadingRelations;

        return (
          <SearchableSelect
            name={field.name}
            options={options || []}
            value={watch(field.name) || ''}
            onChange={(value) => setValue(field.name, value)}
            placeholder={isLoadingOptions ? 'Loading...' : `Select ${field.label}`}
            disabled={field.readOnly || isLoading || isLoadingOptions}
            className={errors[field.name] ? 'border-red-500' : 'border-gray-300'}
          />
        );

      case 'checkbox':
        return (
          <input
            type="checkbox"
            {...register(field.name)}
            disabled={field.readOnly || isLoading}
            className="h-4 w-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
          />
        );

      case 'decimal':
        return (
          <input
            {...commonProps}
            type="number"
            step="0.01"
            min={field.min}
            max={field.max}
          />
        );

      case 'number':
        return (
          <input
            {...commonProps}
            type="number"
            min={field.min}
            max={field.max}
          />
        );

      case 'date':
        return (
          <input
            {...commonProps}
            type="datetime-local"
          />
        );

      case 'password':
        return (
          <input
            {...commonProps}
            type="password"
          />
        );

      case 'email':
        return (
          <input
            {...commonProps}
            type="email"
          />
        );

      case 'array':
        return (
          <input
            {...commonProps}
            placeholder={`Enter ${field.label.toLowerCase()} separated by commas`}
          />
        );

      case 'json':
        return (
          <textarea
            {...commonProps}
            rows={4}
            placeholder="Enter valid JSON"
            className={`${commonProps.className} font-mono text-sm`}
          />
        );

      default:
        return <input {...commonProps} type="text" />;
    }
  };

  const handleFormSubmit = async (data: any) => {
    // Clean up empty strings for optional fields
    const cleanedData = { ...data };
    fields.forEach((field) => {
      if (!field.required && cleanedData[field.name] === '') {
        // Convert empty strings to null for optional fields
        cleanedData[field.name] = null;
      }
    });
    await onSubmit(cleanedData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {fields.map((field) => {
        // Handle field visibility
        // 1. Skip hidden fields (except password which has special logic)
        if (field.hidden && field.type !== 'password') return null;

        // Determine if this specific field is required in the current mode
        const isFieldRequired = field.required && !(field.type === 'password' && isEditMode);

        return (
          <div key={field.name}>
            <label
              htmlFor={field.name}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {field.label}
              {isFieldRequired && <span className="text-red-500 ml-1">*</span>}
              {field.type === 'password' && isEditMode && (
                <span className="text-gray-500 text-xs ml-2">(leave empty to keep current)</span>
              )}
            </label>
            {field.type === 'checkbox' ? (
              <div className="flex items-center">
                {renderField(field)}
                <span className="ml-2 text-sm text-gray-600">{field.label}</span>
              </div>
            ) : (
              renderField(field)
            )}
            {errors[field.name] && (
              <p className="mt-1 text-sm text-red-500">
                {errors[field.name]?.message || `${field.label} is required`}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            submitLabel
          )}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 bg-white text-gray-700 py-2 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  );
}