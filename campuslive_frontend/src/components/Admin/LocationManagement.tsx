import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../../services/api';
import { useToast } from '../toastContext';
import {
    MapPin,
    Plus,
    Trash2,
    Edit2,
    Upload,
    Download,
    RefreshCw,
    Save,
    X,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
import type { Location, CreateLocationRequest } from '../../types';
import { AdminFilters } from './adminTables/AdminFilters';

interface LocationManagementProps {
    onLocationCreated?: (location: Location) => void;
}

interface BulkLocationData {
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    category: string;
}

const LocationManagement: React.FC<LocationManagementProps> = ({ onLocationCreated }) => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showBulkForm, setShowBulkForm] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);
    const [bulkText, setBulkText] = useState('');
    const [bulkResults, setBulkResults] = useState<{ success: number; errors: string[] } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const { showToast } = useToast();

    const [formData, setFormData] = useState<CreateLocationRequest>({
        name: '',
        description: '',
        latitude: 0,
        longitude: 0,
        category: 'academic'
    });

    const categories = [
        'academic',
        'administrative',
        'residential',
        'recreational',
        'dining',
        'parking',
        'medical',
        'other'
    ];

    const categoryOptions = categories.map(cat => ({
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
        value: cat
    }));

    const loadLocations = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await apiService.getAllLocations();
            setLocations(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load locations:', error);
            showToast('Failed to load locations', 'error');
            setLocations([]);
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        loadLocations();
    }, [loadLocations]);

    // Filter locations based on search and category
    const filteredLocations = useMemo(() => {
        return locations.filter(location => {
            const matchesSearch = searchQuery === '' ||
                location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                location.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                location.category.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory = categoryFilter === '' || location.category === categoryFilter;

            return matchesSearch && matchesCategory;
        });
    }, [locations, searchQuery, categoryFilter]);

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            latitude: 0,
            longitude: 0,
            category: 'academic'
        });
        setEditingLocation(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (Math.abs(formData.latitude) > 90 || Math.abs(formData.longitude) > 180) {
            showToast('Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180', 'error');
            return;
        }

        try {
            setIsLoading(true);
            if (editingLocation) {
                await apiService.updateLocation(editingLocation.id, formData);
                showToast('Location updated successfully', 'success');
            } else {
                const result = await apiService.createLocation(formData);
                showToast('Location created successfully', 'success');
                onLocationCreated?.(result);
            }
            await loadLocations();
            setShowCreateForm(false);
            resetForm();
        } catch (error) {
            console.error('Failed to save location:', error);
            showToast(`Failed to ${editingLocation ? 'update' : 'create'} location: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (location: Location) => {
        setEditingLocation(location);
        setFormData({
            name: location.name,
            description: location.description || '',
            latitude: location.latitude,
            longitude: location.longitude,
            category: location.category
        });
        setShowCreateForm(true);
    };

    const handleDelete = async (locationId: string, locationName: string) => {
        if (!confirm(`Are you sure you want to delete "${locationName}"? This action cannot be undone.`)) return;

        try {
            await apiService.deleteLocation(locationId);
            showToast('Location deleted successfully', 'success');
            await loadLocations();
        } catch (error) {
            console.error('Failed to delete location:', error);
            showToast(`Failed to delete location: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    };

    const parseBulkData = (text: string): BulkLocationData[] => {
        const lines = text.trim().split('\n');
        const locations: BulkLocationData[] = [];
        const errors: string[] = [];

        for (const [index, line] of lines.entries()) {
            if (!line.trim()) continue;

            const parts = line.split(',').map(p => p.trim());
            if (parts.length < 5) {
                errors.push(`Line ${index + 1}: Expected 5 columns (name, description, latitude, longitude, category)`);
                continue;
            }

            const [name, description, latStr, lngStr, category] = parts;
            const latitude = Number.parseFloat(latStr);
            const longitude = Number.parseFloat(lngStr);

            if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
                errors.push(`Line ${index + 1}: Invalid coordinates`);
                continue;
            }

            if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
                errors.push(`Line ${index + 1}: Coordinates out of range`);
                continue;
            }

            if (!categories.includes(category)) {
                errors.push(`Line ${index + 1}: Invalid category "${category}"`);
                continue;
            }

            locations.push({ name, description, latitude, longitude, category });
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }

        return locations;
    };

    const handleBulkSubmit = async () => {
        try {
            setIsLoading(true);
            setBulkResults(null);

            const locations = parseBulkData(bulkText);
            let success = 0;
            const errors: string[] = [];

            for (const locationData of locations) {
                try {
                    await apiService.createLocation(locationData);
                    success++;
                } catch (error) {
                    errors.push(`Failed to create "${locationData.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            setBulkResults({ success, errors });

            if (success > 0) {
                showToast(`Successfully created ${success} locations`, 'success');
                await loadLocations();
            }

            if (errors.length > 0) {
                showToast(`${errors.length} locations failed to create`, 'error');
            }

        } catch (error) {
            showToast(`Bulk import failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const generateTemplate = () => {
        const template = [
            'Name,Description,Latitude,Longitude,Category',
            'Main Library,Central campus library,6.5244,3.3792,academic',
            'Student Center,Student activities and services,6.5240,3.3800,recreational',
            'Admin Building,University administration offices,6.5250,3.3785,administrative'
        ].join('\n');

        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'locations_template.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* Header with actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <MapPin className="h-6 w-6 text-blue-500 mr-2" />
                    Location Management ({filteredLocations.length} of {locations.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => { resetForm(); setShowCreateForm(true); }}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Add Location</span>
                    </button>
                    <button
                        onClick={() => setShowBulkForm(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                        <Upload className="h-4 w-4" />
                        <span>Bulk Import</span>
                    </button>
                    <button
                        onClick={loadLocations}
                        disabled={isLoading}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Search and Filter */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <AdminFilters
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    filterType={categoryFilter}
                    onFilterChange={setCategoryFilter}
                    filterOptions={categoryOptions}
                    filterLabel="All Categories"
                    showFilter={true}
                />
            </div>

            {/* Create/Edit Form Modal */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {editingLocation ? 'Edit Location' : 'Create New Location'}
                                </h3>
                                <button
                                    onClick={() => { setShowCreateForm(false); resetForm(); }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="location-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <input
                                        id="location-name"
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="location-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <textarea
                                        id="location-description"
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows={3}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="location-latitude" className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                                        <input
                                            id="location-latitude"
                                            type="number"
                                            step="any"
                                            value={formData.latitude}
                                            onChange={(e) => setFormData(prev => ({ ...prev, latitude: Number.parseFloat(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="location-longitude" className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                                        <input
                                            id="location-longitude"
                                            type="number"
                                            step="any"
                                            value={formData.longitude}
                                            onChange={(e) => setFormData(prev => ({ ...prev, longitude: Number.parseFloat(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="location-category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <select
                                        id="location-category"
                                        value={formData.category}
                                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>
                                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex justify-end space-x-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => { setShowCreateForm(false); resetForm(); }}
                                        className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        <Save className="h-4 w-4" />
                                        <span>{editingLocation ? 'Update' : 'Create'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showBulkForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Bulk Import Locations</h3>
                                <button
                                    onClick={() => { setShowBulkForm(false); setBulkText(''); setBulkResults(null); }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <p className="text-sm text-blue-800 mb-2">
                                        Format: Name, Description, Latitude, Longitude, Category (one per line)
                                    </p>
                                    <p className="text-xs text-blue-600 mb-2">
                                        Valid categories: {categories.join(', ')}
                                    </p>
                                    <button
                                        onClick={generateTemplate}
                                        className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
                                    >
                                        <Download className="h-4 w-4" />
                                        <span>Download Template</span>
                                    </button>
                                </div>

                                <div>
                                    <label htmlFor="bulk-location-data" className="block text-sm font-medium text-gray-700 mb-1">Location Data</label>
                                    <textarea
                                        id="bulk-location-data"
                                        value={bulkText}
                                        onChange={(e) => setBulkText(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows={10}
                                        placeholder="Main Library,Central campus library,6.5244,3.3792,academic&#10;Student Center,Student activities and services,6.5240,3.3800,recreational"
                                    />
                                </div>

                                {bulkResults && (
                                    <div className="space-y-2">
                                        <div className="flex items-center space-x-2 text-green-600">
                                            <CheckCircle className="h-4 w-4" />
                                            <span>{bulkResults.success} locations created successfully</span>
                                        </div>
                                        {bulkResults.errors.length > 0 && (
                                            <div className="bg-red-50 p-3 rounded-lg">
                                                <div className="flex items-center space-x-2 text-red-600 mb-2">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <span>{bulkResults.errors.length} errors:</span>
                                                </div>
                                                <ul className="text-sm text-red-600 space-y-1 max-h-32 overflow-y-auto">
                                                    {bulkResults.errors.map((error, idx) => (
                                                        <li key={`error-${idx}-${error.substring(0, 20).replaceAll(/\s+/g, '-')}`}>• {error}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-end space-x-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => { setShowBulkForm(false); setBulkText(''); setBulkResults(null); }}
                                        className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleBulkSubmit}
                                        disabled={isLoading || !bulkText.trim()}
                                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                        <span>Import Locations</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Locations Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coordinates</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredLocations.length === 0 && !isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        {searchQuery || categoryFilter
                                            ? 'No locations found matching your criteria'
                                            : 'No locations found. Create your first location to get started.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredLocations.map(location => (
                                    <tr key={location.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{location.name}</div>
                                                {location.description && (
                                                    <div className="text-sm text-gray-500">{location.description}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {location.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${location.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {location.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                            <button
                                                onClick={() => handleEdit(location)}
                                                className="text-blue-600 hover:text-blue-900"
                                                title="Edit location"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(location.id, location.name)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Delete location"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {isLoading && (
                        <div className="text-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                            <p className="text-gray-500 mt-2">Loading locations...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LocationManagement;