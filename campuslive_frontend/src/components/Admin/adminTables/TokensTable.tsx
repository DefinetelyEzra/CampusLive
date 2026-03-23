import React, { useMemo, useState } from 'react';
import { Copy, CheckCircle, XCircle, Clock, Plus, RefreshCw } from 'lucide-react';
import type { ModeratorToken } from '../../../types';
import { AdminFilters } from './AdminFilters';

interface ModeratorTokenWithUser extends ModeratorToken {
    usedByUser?: {
        id: string;
        username: string;
        email: string;
    };
}

interface TokensTableProps {
    tokens: ModeratorTokenWithUser[];
    formatDate: (date: string) => string;
    onCopyToken: (token: string) => void;
    copiedToken: string;
    onGenerate: () => void;
    isGenerating: boolean;
    newTokenCount: number;
    onTokenCountChange: (count: number) => void;
}

export const TokensTable: React.FC<TokensTableProps> = ({
    tokens,
    formatDate,
    onCopyToken,
    copiedToken,
    onGenerate,
    isGenerating,
    newTokenCount,
    onTokenCountChange,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const statusOptions = [
        { label: 'All Statuses', value: '' },
        { label: 'Available', value: 'available' },
        { label: 'Used', value: 'used' },
        { label: 'Expired', value: 'expired' },
    ];

    const dateOptions = [
        { label: 'All Time', value: '' },
        { label: 'Last 7 Days', value: '7' },
        { label: 'Last 30 Days', value: '30' },
        { label: 'Last 90 Days', value: '90' },
    ];

    const getTokenStatus = (token: ModeratorTokenWithUser): 'available' | 'used' | 'expired' => {
        if (token.isUsed) return 'used';
        if (new Date(token.expiresAt) < new Date()) return 'expired';
        return 'available';
    };

    const renderTokenStatus = (token: ModeratorTokenWithUser) => {
        const status = getTokenStatus(token);

        if (status === 'used') {
            return (
                <span className="flex items-center text-red-600">
                    <XCircle className="h-4 w-4 mr-1" />
                    Used
                </span>
            );
        }
        if (status === 'expired') {
            return (
                <span className="flex items-center text-gray-600">
                    <Clock className="h-4 w-4 mr-1" />
                    Expired
                </span>
            );
        }
        return (
            <span className="flex items-center text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                Available
            </span>
        );
    };

    const renderUsedByInfo = (token: ModeratorTokenWithUser) => {
        if (!token.usedByUserId) {
            return <span className="text-gray-400">Not used</span>;
        }

        if (token.usedByUser) {
            return (
                <div>
                    <div className="font-medium">{token.usedByUser.username}</div>
                    <div className="text-gray-500">{token.usedByUser.email}</div>
                </div>
            );
        }

        return <div className="font-medium">{token.usedByUserId}</div>;
    };

    const filteredTokens = useMemo(() => {
        return tokens.filter(token => {
            const matchesSearch = searchQuery === '' ||
                token.token.toLowerCase().includes(searchQuery.toLowerCase()) ||
                token.usedByUser?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                token.usedByUser?.email.toLowerCase().includes(searchQuery.toLowerCase());

            const tokenStatus = getTokenStatus(token);
            const matchesStatus = statusFilter === '' || tokenStatus === statusFilter;

            let matchesDate = true;
            if (dateFilter) {
                const createdDate = new Date(token.createdAt);
                const daysAgo = new Date();
                daysAgo.setDate(daysAgo.getDate() - Number.parseInt(dateFilter));
                matchesDate = createdDate >= daysAgo;
            }

            return matchesSearch && matchesStatus && matchesDate;
        });
    }, [tokens, searchQuery, statusFilter, dateFilter]);

    return (
        <div className="space-y-6">
            {/* Token Generation Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Moderator Tokens</h3>
                <div className="flex items-center space-x-4">
                    <div>
                        <label htmlFor="token-count" className="block text-sm font-medium text-gray-700 mb-1">
                            Number of tokens
                        </label>
                        <input
                            id="token-count"
                            type="number"
                            min="1"
                            max="10"
                            value={newTokenCount}
                            onChange={(e) => onTokenCountChange(Number.parseInt(e.target.value))}
                            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <div>
                        <div className="block text-sm font-medium text-gray-700 mb-1">Generate Tokens</div>
                        <button
                            onClick={onGenerate}
                            disabled={isGenerating}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            <span>{isGenerating ? 'Generating...' : 'Generate'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tokens Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Moderator Tokens ({filteredTokens.length} of {tokens.length})
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
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                {statusOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used By</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredTokens.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        No tokens found matching your criteria
                                    </td>
                                </tr>
                            ) : (
                                filteredTokens.map(token => (
                                    <tr key={token.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center space-x-2">
                                                <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{token.token}</code>
                                                <button
                                                    onClick={() => onCopyToken(token.token)}
                                                    className="text-gray-400 hover:text-gray-600"
                                                    title="Copy to clipboard"
                                                >
                                                    {copiedToken === token.token ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">{renderTokenStatus(token)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {renderUsedByInfo(token)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(token.createdAt)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <span className={new Date(token.expiresAt) < new Date() ? 'text-red-600' : 'text-green-600'}>
                                                {formatDate(token.expiresAt)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};