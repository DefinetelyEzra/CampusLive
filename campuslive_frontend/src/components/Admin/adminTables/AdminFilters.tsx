import React from 'react';
import { Search, Filter, X } from 'lucide-react';

interface FilterOption {
    label: string;
    value: string;
}

interface AdminFiltersProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    filterType?: string;
    onFilterChange?: (value: string) => void;
    filterOptions?: FilterOption[];
    filterLabel?: string;
    showFilter?: boolean;
}

export const AdminFilters: React.FC<AdminFiltersProps> = ({
    searchQuery,
    onSearchChange,
    filterType,
    onFilterChange,
    filterOptions = [],
    filterLabel = 'Filter',
    showFilter = true,
}) => {
    return (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Global Search */}
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {searchQuery && (
                    <button
                        onClick={() => onSearchChange('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Filter Dropdown */}
            {showFilter && filterOptions.length > 0 && onFilterChange && (
                <div className="sm:w-64">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <select
                            value={filterType}
                            onChange={(e) => onFilterChange(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none bg-white"
                        >
                            <option value="">{filterLabel}</option>
                            {filterOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
};