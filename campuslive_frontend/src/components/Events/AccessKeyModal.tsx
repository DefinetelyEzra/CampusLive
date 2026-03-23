import React from 'react';
import { X, Copy, Check } from 'lucide-react';

interface AccessKeyModalProps {
    accessKeyValue: string;
    eventTitle: string;
    onClose: () => void;
}

const AccessKeyModal: React.FC<AccessKeyModalProps> = ({ accessKeyValue, eventTitle, onClose }) => {
    const [copied, setCopied] = React.useState(false);

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(accessKeyValue);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Private Event Created</h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Your private event "<strong>{eventTitle}</strong>" has been created successfully.
                        </p>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-yellow-800 mb-2">
                                ⚠️ Important: Save this access key
                            </p>
                            <p className="text-xs text-yellow-700">
                                Users will need this 6-character key to join your private event.
                                This key will not be shown again.
                            </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="text-center flex-1">
                                    <p className="text-xs text-gray-500 mb-1">Access Key</p>
                                    <p className="text-3xl font-bold text-purple-600 tracking-wider font-mono">
                                        {accessKeyValue}
                                    </p>
                                </div>
                                <button
                                    onClick={copyToClipboard}
                                    className="ml-4 p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                    title="Copy to clipboard"
                                >
                                    {copied ? (
                                        <Check className="h-5 w-5 text-green-600" />
                                    ) : (
                                        <Copy className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <button
                                onClick={copyToClipboard}
                                className="px-4 py-2 text-purple-600 border border-purple-300 rounded-md hover:bg-purple-50"
                            >
                                {copied ? 'Copied!' : 'Copy Key'}
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccessKeyModal;