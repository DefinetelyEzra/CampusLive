import React, { useMemo, useState } from 'react';
import type { UserAppRole } from '../../../types';
import { AdminFilters } from './AdminFilters';

interface ModeratorsTableProps {
    moderators: UserAppRole[];
    formatDate: (date: string) => string;
}

export const ModeratorsTable: React.FC<ModeratorsTableProps> = ({
    moderators,
    formatDate,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const dateOptions = [
        { label: 'All Time', value: '' },
        { label: 'Last 7 Days', value: '7' },
        { label: 'Last 30 Days', value: '30' },
        { label: 'Last 90 Days', value: '90' },
    ];

    const filteredModerators = useMemo(() => {
        return moderators.filter(moderator => {
            const matchesSearch = searchQuery === '' ||
                moderator.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                moderator.moderatorTokenId?.toLowerCase().includes(searchQuery.toLowerCase());

            let matchesDate = true;
            if (dateFilter) {
                const createdDate = new Date(moderator.createdAt);
                const daysAgo = new Date();
                daysAgo.setDate(daysAgo.getDate() - Number.parseInt(dateFilter));
                matchesDate = createdDate >= daysAgo;
            }

            return matchesSearch && matchesDate;
        });
    }, [moderators, searchQuery, dateFilter]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Active Moderators ({filteredModerators.length} of {moderators.length})
                </h3>

                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <AdminFilters
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            showFilter={false}
                        />
                    </div>

                    <div className="sm:w-48">
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            {dateOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token Used</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role Since</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredModerators.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                    No moderators found matching your criteria
                                </td>
                            </tr>
                        ) : (
                            filteredModerators.map(moderator => (
                                <tr key={moderator.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{moderator.userId}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                                        {moderator.moderatorTokenId || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {formatDate(moderator.createdAt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {moderator.expiresAt ? formatDate(moderator.expiresAt) : 'Never'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};