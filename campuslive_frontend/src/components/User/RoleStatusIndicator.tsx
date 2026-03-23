import React, { useEffect } from 'react';
import { useRoleStore } from '../../stores/roleStore';
import { Shield, Camera, Eye } from 'lucide-react';

const RoleStatusIndicator: React.FC = () => {
    const { currentRole, fetchCurrentRole } = useRoleStore();

    useEffect(() => {
        fetchCurrentRole();
    }, [fetchCurrentRole]);

    if (!currentRole) {
        return (
            <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-full">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-xs text-gray-600">No active role</span>
            </div>
        );
    }

    const roleConfig = {
        MODERATOR: {
            icon: Shield,
            color: 'bg-purple-100 text-purple-800 border-purple-300',
            dot: 'bg-purple-500'
        },
        POSTER: {
            icon: Camera,
            color: 'bg-green-100 text-green-800 border-green-300',
            dot: 'bg-green-500'
        },
        WATCHER: {
            icon: Eye,
            color: 'bg-blue-100 text-blue-800 border-blue-300',
            dot: 'bg-blue-500'
        }
    };

    const config = roleConfig[currentRole.roleType] || roleConfig.WATCHER;
    const IconComponent = config?.icon || Eye;

    return (
        <div className={`flex items-center space-x-2 px-3 py-1 border rounded-full ${config?.color}`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${config?.dot}`}></div>
            <IconComponent className="h-3 w-3" />
            <span className="text-xs font-medium">{currentRole.roleType}</span>
        </div>
    );
};

export default RoleStatusIndicator;