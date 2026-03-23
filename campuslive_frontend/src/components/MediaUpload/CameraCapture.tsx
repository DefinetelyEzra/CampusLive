import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, RotateCw } from 'lucide-react';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onClose: () => void;
    mode: 'photo' | 'video';
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose, mode }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
    const [error, setError] = useState<string>('');

    const startCamera = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: mode === 'video'
            });

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setStream(mediaStream);
            setError('');
        } catch (err) {
            console.error('Camera access error:', err);
            setError('Unable to access camera. Please check permissions.');
        }
    }, [facingMode, mode]);

    useEffect(() => {
        startCamera();

        return () => {
            if (stream) {
                for (const track of stream.getTracks()) {
                    track.stop();
                }
            }
        };
    }, [startCamera, stream]);

    const switchCamera = () => {
        if (stream) {
            for (const track of stream.getTracks()) {
                track.stop();
            }
        }
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;

        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onCapture(file);
                    cleanup();
                }
            }, 'image/jpeg', 0.95);
        }
    };

    const startRecording = () => {
        if (!stream) return;

        const options = { mimeType: 'video/webm;codecs=vp9' };
        const mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                setRecordedChunks(prev => [...prev, event.data]);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
            onCapture(file);
            cleanup();
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const cleanup = () => {
        if (stream) {
            for (const track of stream.getTracks()) {
                track.stop();
            }
        }
        onClose();
    };

    if (error) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-sm">
                    <h3 className="text-lg font-semibold text-red-600 mb-2">Camera Error</h3>
                    <p className="text-gray-700 mb-4">{error}</p>
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black/50 to-transparent">
                <button
                    onClick={cleanup}
                    className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition"
                >
                    <X className="h-6 w-6" />
                </button>

                <button
                    onClick={switchCamera}
                    className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition"
                >
                    <RotateCw className="h-6 w-6" />
                </button>
            </div>

            {/* Video Preview */}
            <div className="flex-1 relative">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                />
            </div>

            {/* Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/50 to-transparent">
                <div className="flex justify-center items-center">
                    {mode === 'photo' ? (
                        <button
                            onClick={capturePhoto}
                            className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 hover:scale-110 transition-transform"
                        >
                            <div className="w-full h-full rounded-full bg-white" />
                        </button>
                    ) : (
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`w-20 h-20 rounded-full border-4 transition-all ${isRecording
                                    ? 'bg-red-600 border-red-400'
                                    : 'bg-white border-gray-300 hover:scale-110'
                                }`}
                        >
                            {isRecording && (
                                <div className="w-full h-full flex items-center justify-center">
                                    <div className="w-6 h-6 bg-white rounded-sm" />
                                </div>
                            )}
                        </button>
                    )}
                </div>

                {isRecording && (
                    <div className="text-center mt-4">
                        <span className="text-white text-sm font-medium">Recording...</span>
                    </div>
                )}
            </div>
        </div>
    );
};