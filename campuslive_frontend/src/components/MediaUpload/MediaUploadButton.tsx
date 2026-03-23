import React, { useRef, useState } from 'react';
import { Camera, Image, Video, Upload } from 'lucide-react';
import { CameraCapture } from './CameraCapture';
import { MediaPreview } from './MediaPreview';

interface MediaUploadButtonProps {
    onFileSelect: (file: File) => void;
    disabled?: boolean;
    compact?: boolean;
}

export const MediaUploadButton: React.FC<MediaUploadButtonProps> = ({
    onFileSelect,
    disabled = false,
    compact = false
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelection(file);
        }
    };

    const handleFileSelection = (file: File) => {
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        setShowMenu(false);
    };

    const handleCameraCapture = (file: File) => {
        handleFileSelection(file);
        setShowCamera(false);
    };

    const handleUpload = () => {
        if (selectedFile) {
            onFileSelect(selectedFile);
            setSelectedFile(null);
            setPreview(null);
        }
    };

    const handleRemove = () => {
        setSelectedFile(null);
        setPreview(null);
    };

    const openCamera = (mode: 'photo' | 'video') => {
        setCameraMode(mode);
        setShowCamera(true);
        setShowMenu(false);
    };

    const openFilePicker = (accept: string) => {
        if (fileInputRef.current) {
            fileInputRef.current.accept = accept;
            fileInputRef.current.click();
        }
        setShowMenu(false);
    };

    if (compact) {
        return (
            <>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    disabled={disabled}
                    className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    title="Upload media"
                >
                    <Camera className="h-5 w-5" />
                </button>

                {/* Compact Menu */}
                {showMenu && (
                    <div className="absolute bottom-14 right-0 bg-white rounded-lg shadow-lg p-2 z-10">
                        <button
                            onClick={() => openCamera('photo')}
                            className="w-full flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition"
                        >
                            <Camera className="h-5 w-5" />
                            <span>Take Photo</span>
                        </button>
                        <button
                            onClick={() => openCamera('video')}
                            className="w-full flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition"
                        >
                            <Video className="h-5 w-5" />
                            <span>Record Video</span>
                        </button>
                        <button
                            onClick={() => openFilePicker('image/*')}
                            className="w-full flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition"
                        >
                            <Image className="h-5 w-5" />
                            <span>Choose Photo</span>
                        </button>
                        <button
                            onClick={() => openFilePicker('video/*')}
                            className="w-full flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition"
                        >
                            <Video className="h-5 w-5" />
                            <span>Choose Video</span>
                        </button>
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileInput}
                    className="hidden"
                />

                {showCamera && (
                    <CameraCapture
                        mode={cameraMode}
                        onCapture={handleCameraCapture}
                        onClose={() => setShowCamera(false)}
                    />
                )}

                {selectedFile && preview && (
                    <MediaPreview
                        file={selectedFile}
                        preview={preview}
                        onRemove={handleRemove}
                        onUpload={handleUpload}
                        uploading={false}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <div className="relative">
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    disabled={disabled}
                    className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    <Upload className="h-5 w-5" />
                    <span>Upload Media</span>
                </button>

                {/* Full Menu */}
                {showMenu && (
                    <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-10">
                        <div className="grid grid-cols-2 gap-2 p-4">
                            <button
                                onClick={() => openCamera('photo')}
                                className="flex flex-col items-center justify-center space-y-2 p-4 hover:bg-blue-50 rounded-lg transition border border-gray-200"
                            >
                                <Camera className="h-8 w-8 text-blue-600" />
                                <span className="text-sm font-medium">Take Photo</span>
                            </button>

                            <button
                                onClick={() => openCamera('video')}
                                className="flex flex-col items-center justify-center space-y-2 p-4 hover:bg-blue-50 rounded-lg transition border border-gray-200"
                            >
                                <Video className="h-8 w-8 text-blue-600" />
                                <span className="text-sm font-medium">Record Video</span>
                            </button>

                            <button
                                onClick={() => openFilePicker('image/*')}
                                className="flex flex-col items-center justify-center space-y-2 p-4 hover:bg-blue-50 rounded-lg transition border border-gray-200"
                            >
                                <Image className="h-8 w-8 text-blue-600" />
                                <span className="text-sm font-medium">Choose Photo</span>
                            </button>

                            <button
                                onClick={() => openFilePicker('video/*')}
                                className="flex flex-col items-center justify-center space-y-2 p-4 hover:bg-blue-50 rounded-lg transition border border-gray-200"
                            >
                                <Video className="h-8 w-8 text-blue-600" />
                                <span className="text-sm font-medium">Choose Video</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInput}
                className="hidden"
            />

            {showCamera && (
                <CameraCapture
                    mode={cameraMode}
                    onCapture={handleCameraCapture}
                    onClose={() => setShowCamera(false)}
                />
            )}

            {selectedFile && preview && (
                <MediaPreview
                    file={selectedFile}
                    preview={preview}
                    onRemove={handleRemove}
                    onUpload={handleUpload}
                    uploading={false}
                />
            )}
        </>
    );
};