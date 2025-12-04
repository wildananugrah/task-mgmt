import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
}

export function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select option',
  disabled = false,
  className = '',
  name,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get selected option label
  const selectedOption = options.find((opt) => opt.value === value);
  const selectedLabel = selectedOption ? selectedOption.label : '';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setSearchTerm('');
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input for form compatibility */}
      <input type="hidden" name={name} value={value || ''} />

      {/* Trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full px-3 py-2 text-left border rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent flex items-center justify-between ${
          disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-gray-400'
        } ${className}`}
      >
        <span className={selectedLabel ? 'text-gray-900' : 'text-gray-500'}>
          {selectedLabel || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <X
              className="h-4 w-4 text-gray-400 hover:text-gray-600"
              onClick={handleClear}
            />
          )}
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${
              isOpen ? 'transform rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200 bg-white sticky top-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto max-h-[200px]">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                    value === option.value ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-700'
                  }`}
                >
                  <span>{option.label}</span>
                  {value === option.value && (
                    <Check className="h-4 w-4 text-gray-900" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
