import React, { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

const LoadingScreen: React.FC = () => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const systemDark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldUseDark = savedTheme === 'dark' || (!savedTheme && systemDark);

        setIsDarkMode(shouldUseDark);
        document.documentElement.classList.toggle('dark', shouldUseDark);
    }, []);

    return (
        <div className={`min-h-screen transition-colors duration-300 flex items-center justify-center ${isDarkMode
                ? 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900'
                : 'bg-gradient-to-br from-blue-50 via-teal-50 to-blue-100'
            }`}>
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl opacity-20 animate-pulse ${isDarkMode ? 'bg-blue-400' : 'bg-blue-300'
                    }`} />
                <div className={`absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full blur-3xl opacity-15 animate-pulse delay-700 ${isDarkMode ? 'bg-teal-400' : 'bg-teal-300'
                    }`} />
            </div>

            <div className="relative text-center">
                {/* Main loading animation */}
                <div className="mb-8 relative">
                    <div className={`mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-4 ${isDarkMode
                            ? 'bg-gradient-to-br from-blue-600 to-teal-600'
                            : 'bg-gradient-to-br from-blue-500 to-teal-500'
                        } shadow-2xl`}>
                        <MapPin className="h-10 w-10 text-white animate-bounce" />
                    </div>

                    {/* Animated rings around the icon */}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
                        <div className={`w-20 h-20 rounded-2xl border-2 animate-ping ${isDarkMode ? 'border-blue-400/30' : 'border-blue-400/50'
                            }`} />
                    </div>
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
                        <div className={`w-24 h-24 -m-2 rounded-2xl border-2 animate-ping animation-delay-300 ${isDarkMode ? 'border-teal-400/20' : 'border-teal-400/30'
                            }`} />
                    </div>
                </div>

                {/* Loading spinner */}
                <div className="mb-6">
                    <div className={`animate-spin rounded-full h-8 w-8 border-3 mx-auto ${isDarkMode
                            ? 'border-slate-600 border-t-blue-400'
                            : 'border-blue-200 border-t-blue-600'
                        }`} />
                </div>

                {/* Text content */}
                <div className="space-y-2">
                    <h1 className={`text-4xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                        CampusLive
                    </h1>
                    <h2 className={`text-xl font-medium mb-4 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'
                        }`}>
                        Pan-Atlantic University
                    </h2>
                    <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                        Loading your campus experience...
                    </p>
                </div>

                {/* Loading progress dots */}
                <div className="flex justify-center space-x-2 mt-8">
                    <div className={`w-2 h-2 rounded-full animate-bounce ${isDarkMode ? 'bg-blue-400' : 'bg-blue-500'
                        }`} />
                    <div className={`w-2 h-2 rounded-full animate-bounce animation-delay-150 ${isDarkMode ? 'bg-teal-400' : 'bg-teal-500'
                        }`} />
                    <div className={`w-2 h-2 rounded-full animate-bounce animation-delay-300 ${isDarkMode ? 'bg-indigo-400' : 'bg-indigo-500'
                        }`} />
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;