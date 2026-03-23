import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSocketStore } from '../../stores/socketStore';
import { useToast } from '../toastContext';
import { Heart, MessageCircle, Share2, User, Clock, MapPin } from 'lucide-react';
import type { Post } from '../../types';
import apiService from '../../services/api';

interface LiveFeedProps {
    eventId: string;
    eventTitle: string;
}

export const LiveFeed: React.FC<LiveFeedProps> = ({ eventId, eventTitle }) => {
    const { socket } = useSocketStore();
    const { showToast } = useToast();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const feedEndRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    // Load initial posts
    const loadPosts = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiService.getPostsByEvent(eventId);
            if (Array.isArray(response)) {
                setPosts(response);
            } else if (response && typeof response === 'object' && 'posts' in response) {
                setPosts((response as { posts: Post[] }).posts || []);
            } else {
                setPosts([]);
            }
        } catch (error) {
            console.error('Failed to load posts:', error);
            showToast('Failed to load feed', 'error');
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }, [eventId, showToast]);

    useEffect(() => {
        loadPosts();
    }, [loadPosts]);

    // Listen for new posts
    useEffect(() => {
        if (!socket) return;

        const handleNewPost = (data: { eventId: string; timestamp: string }) => {
            if (data.eventId === eventId) {
                loadPosts();
                showToast('New post added to feed', 'success');
            }
        };

        socket.on('new-event-post', handleNewPost);

        return () => {
            socket.off('new-event-post', handleNewPost);
        };
    }, [socket, eventId, loadPosts, showToast]);

    // Auto-scroll to bottom when new posts arrive
    useEffect(() => {
        if (autoScroll && feedEndRef.current) {
            feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [posts, autoScroll]);

    const formatTimeAgo = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const element = e.currentTarget;
        const isAtBottom = element.scrollHeight - element.scrollTop === element.clientHeight;
        setAutoScroll(isAtBottom);
    };

    // Helper function to render media content
    const renderMediaContent = (post: Post) => {
        if (!post.mediaUrl) return null;

        if (post.mediaType === 'IMAGE') {
            return (
                <img
                    src={post.mediaUrl}
                    alt="Post content"
                    className="w-full object-cover max-h-96"
                    loading="lazy"
                />
            );
        }

        if (post.mediaType === 'VIDEO') {
            return (
                <video
                    src={post.mediaUrl}
                    controls
                    className="w-full max-h-96"
                    preload="metadata"
                >
                    <track kind="captions" />
                    Your browser does not support the video tag.
                </video>
            );
        }

        return null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (posts.length === 0) {
        return (
            <div className="text-center py-12">
                <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No posts yet</p>
                <p className="text-gray-400 text-sm">Be the first to share something!</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
                <h2 className="font-bold text-lg text-gray-900">{eventTitle}</h2>
                <p className="text-sm text-gray-500">{posts.length} posts</p>
            </div>

            {/* Feed */}
            <div
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
                onScroll={handleScroll}
            >
                {posts.map((post) => (
                    <div key={post.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                        {/* Post Header */}
                        <div className="px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <User className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{post.user.username}</p>
                                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                                        <Clock className="h-3 w-3" />
                                        <span>{formatTimeAgo(post.createdAt)}</span>
                                        {post.location && (
                                            <>
                                                <span>•</span>
                                                <MapPin className="h-3 w-3" />
                                                <span>{post.location.name}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Post Content */}
                        {post.content && (
                            <div className="px-4 py-2">
                                <p className="text-gray-800">{post.content}</p>
                            </div>
                        )}

                        {/* Post Media */}
                        {post.mediaUrl && (
                            <div className="relative">
                                {renderMediaContent(post)}
                            </div>
                        )}

                        {/* Post Actions */}
                        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100">
                            <button className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition">
                                <Heart className="h-5 w-5" />
                                <span className="text-sm">Like</span>
                            </button>
                            <button className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition">
                                <MessageCircle className="h-5 w-5" />
                                <span className="text-sm">Comment</span>
                            </button>
                            <button className="flex items-center space-x-2 text-gray-600 hover:text-green-600 transition">
                                <Share2 className="h-5 w-5" />
                                <span className="text-sm">Share</span>
                            </button>
                        </div>
                    </div>
                ))}
                <div ref={feedEndRef} />
            </div>

            {/* Scroll to bottom indicator */}
            {!autoScroll && (
                <button
                    onClick={() => {
                        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                        setAutoScroll(true);
                    }}
                    className="fixed bottom-20 right-4 bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 transition"
                >
                    <span className="text-sm font-medium">New posts ↓</span>
                </button>
            )}
        </div>
    );
};