import React from 'react';
import { X, Upload, Loader2 } from 'lucide-react';

interface MediaPreviewProps {
    file: File | null;
    preview: string | null;
    onRemove: () => void;
    onUpload: () => void;
    uploading: boolean;
    uploadProgress?: number;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({
    file,
    preview,
    onRemove,
    onUpload,
    uploading,
    uploadProgress = 0
}) => {
    if (!file || !preview) return null;

    const isVideo = file.type.startsWith('video/');
    const fileSize = (file.size / (1024 * 1024)).toFixed(2);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-4 bg-black/30 backdrop-blur-sm">
                <div className="text-white">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-300">{fileSize} MB</p>
                </div>
                <button
                    onClick={onRemove}
                    disabled={uploading}
                    className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
                >
                    <X className="h-6 w-6" />
                </button>
            </div>

            {/* Preview */}
            <div className="flex-1 flex items-center justify-center p-4">
                {isVideo ? (
                    <video
                        src={preview}
                        controls
                        className="max-w-full max-h-full rounded-lg"
                    >
                        <track
                            default
                            kind="captions"
                            srcLang="en"
                            label="English"
                            src="data:text/vtt;base64,W01lZGlhIFByZXZpZXcgQ2FwdGlvbnM="
                        />
                    </video>
                ) : (
                    <img
                        src={preview}
                        alt="Preview"
                        className="max-w-full max-h-full rounded-lg object-contain"
                    />
                )}
            </div>

            {/* Upload Progress */}
            {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center justify-center mb-4">
                            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                        </div>
                        <p className="text-center font-medium mb-2">Uploading...</p>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        <p className="text-center text-sm text-gray-600 mt-2">
                            {uploadProgress}%
                        </p>
                    </div>
                </div>
            )}

            {/* Upload Button */}
            {!uploading && (
                <div className="p-4 bg-black/30 backdrop-blur-sm">
                    <button
                        onClick={onUpload}
                        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center space-x-2"
                    >
                        <Upload className="h-5 w-5" />
                        <span>Upload & Post</span>
                    </button>
                </div>
            )}
        </div>
    );
};