import React, { useState, useEffect } from 'react';
import './App.css';
import proxiesConfigData from './config/proxies.json';
import { 
    getVideoId, 
    validateVideoUrl, 
    buildEmbedUrl, 
    generateUniqueId,
    getUserAgentShort,
    formatViews,
    formatTime,
    getDefaultProxyConfig
} from './utils/videoUtils';
import { 
    initializeProxyManager, 
    selectOptimalProxy, 
    updateProxyHealth,
    getProxyAnalytics,
    optimizeAllProxies,
    getHealthyProxies,
    resetProxy,
    getProxyInfo
} from './utils/proxyManager';
import {
    initializeVideoManager,
    createVideo,
    setupVideoEvents,
    controlVideo,
    controlAllVideos,
    removeVideo,
    getVideoStats,
    getGlobalStats,
    getDetailedStats,
    clearAllVideos,
    addStatsObserver
} from './utils/videoManager';

function App() {
    // State variables
    const [videoUrl, setVideoUrl] = useState('https://youtu.be/niKbEZqusE0?si=hYYdgWoE3sZ6VSUa');
    const [quantity, setQuantity] = useState(3);
    const [startTime, setStartTime] = useState(0);
    const [viewDuration, setViewDuration] = useState(30);
    const [currentProxy, setCurrentProxy] = useState('auto');
    const [videos, setVideos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState('');
    const [isInitialized, setIsInitialized] = useState(false);

    // Global statistics
    const [globalStats, setGlobalStats] = useState({
        totalViews: 0,
        totalWatchTime: 0,
        totalVideos: 0,
        sessionsActive: 0
    });

    // Proxy analytics
    const [proxyAnalytics, setProxyAnalytics] = useState({
        totalRequests: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        successRate: 0,
        healthyProxies: 0,
        blockedProxies: 0
    });

    // Advanced options
    const [options, setOptions] = useState({
        autoplay: true,
        muted: true,
        controls: true,
        humanBehavior: true,
        randomDelay: true,
        proxyRotation: true,
        autoOptimize: true,
        showAnalytics: false
    });

    // Proxy configuration (fallback if import fails)
    const [proxyConfig, setProxyConfig] = useState(null);

    // Initialize managers on component mount
    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Check if proxiesConfigData is available
                let config = proxiesConfigData;
                if (!config || !config.proxies) {
                    console.warn('Using default proxy configuration');
                    config = getDefaultProxyConfig();
                }
                
                setProxyConfig(config);
                
                // Initialize proxy manager
                initializeProxyManager(config);
                
                // Initialize video manager
                initializeVideoManager();
                
                // Setup observer for real-time stats updates
                addStatsObserver((event, data) => {
                    updateAllStats();
                    
                    // Show notifications for key events
                    if (event === 'viewIncrement') {
                        // Don't show notification for every view increment
                    } else if (event === 'videoError') {
                        showNotification('Video error occurred, trying different proxy...', 'error');
                    } else if (event === 'videoRetry') {
                        showNotification('Retrying video with different proxy...', 'warning');
                    }
                });

                updateAllStats();
                setIsInitialized(true);
                
            } catch (error) {
                console.error('Failed to initialize app:', error);
                showNotification('Failed to initialize app. Using default configuration.', 'error');
                
                // Fallback initialization
                const defaultConfig = getDefaultProxyConfig();
                setProxyConfig(defaultConfig);
                initializeProxyManager(defaultConfig);
                initializeVideoManager();
                setIsInitialized(true);
            }
        };

        initializeApp();
    }, []);

    // Auto-optimization and proxy rotation
    useEffect(() => {
        if (!options.autoOptimize || !isInitialized) return;

        const interval = setInterval(() => {
            try {
                optimizeAllProxies();
                updateAllStats();
            } catch (error) {
                console.error('Error in auto-optimization:', error);
            }
        }, 30000); // Every 30 seconds

        return () => clearInterval(interval);
    }, [options.autoOptimize, isInitialized]);

    // Update all statistics
    const updateAllStats = () => {
        try {
            const globalData = getGlobalStats();
            const proxyData = getProxyAnalytics();
            
            setGlobalStats(globalData);
            setProxyAnalytics(proxyData);
            
            // Update video list with current stats
            setVideos(prev => prev.map(video => {
                const stats = getVideoStats(video.id);
                return stats ? { ...video, stats } : video;
            }));
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    };

    // Show notification
    const showNotification = (message, type = 'success') => {
        setNotification(message);
        setTimeout(() => setNotification(''), 3000);
    };

    // Validate and add videos
    const addVideos = async () => {
        if (!isInitialized) {
            showNotification('App is still initializing. Please wait.', 'warning');
            return;
        }

        if (!videoUrl.trim()) {
            showNotification('Please enter a YouTube URL', 'error');
            return;
        }

        const validation = validateVideoUrl(videoUrl);
        if (!validation.valid) {
            showNotification(validation.error, 'error');
            return;
        }

        if (quantity < 1 || quantity > 50) {
            showNotification('Please enter a quantity between 1 and 50', 'error');
            return;
        }

        setIsLoading(true);

        try {
            const config = proxyConfig || getDefaultProxyConfig();
            const newVideos = [];
            
            for (let i = 0; i < quantity; i++) {
                const videoId = generateUniqueId();
                const frameId = `frame-${videoId}`;
                
                // Select optimal proxy
                const selectedProxy = currentProxy === 'auto' 
                    ? selectOptimalProxy() 
                    : currentProxy;

                // Get random user agent
                const userAgent = config.userAgents && config.userAgents.length > 0
                    ? config.userAgents[Math.floor(Math.random() * config.userAgents.length)]
                    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

                // Create video data
                const videoData = {
                    id: videoId,
                    frameId: frameId,
                    videoId: validation.videoId,
                    proxy: selectedProxy,
                    userAgent: userAgent,
                    options: {
                        autoplay: options.autoplay,
                        muted: options.muted,
                        controls: options.controls,
                        humanBehavior: options.humanBehavior,
                        viewDuration: viewDuration,
                        startTime: startTime
                    }
                };

                // Create video in manager
                const video = createVideo(videoData);
                
                if (!video) {
                    console.error('Failed to create video:', videoData);
                    continue;
                }
                
                // Build embed URL
                const embedUrl = buildEmbedUrl(
                    validation.videoId,
                    config.proxies[selectedProxy] && config.proxies[selectedProxy].embed 
                        ? config.proxies[selectedProxy].embed
                        : 'https://www.youtube.com/embed/',
                    {
                        autoplay: options.autoplay ? 1 : 0,
                        muted: options.muted ? 1 : 0,
                        controls: options.controls ? 1 : 0,
                        startTime: startTime,
                        customParams: options.humanBehavior ? {
                            hl: 'en',
                            cc_lang_pref: 'en',
                            cc_load_policy: 0
                        } : {}
                    }
                );

                const videoCard = {
                    id: videoId,
                    frameId: frameId,
                    videoId: validation.videoId,
                    embedUrl: embedUrl,
                    proxy: selectedProxy,
                    userAgent: getUserAgentShort(userAgent),
                    index: i,
                    status: 'loading',
                    stats: {
                        views: 0,
                        watchTime: 0,
                        interactions: 0,
                        isPlaying: false,
                        loadTime: 0,
                        errors: 0
                    }
                };

                newVideos.push(videoCard);
            }

            if (newVideos.length === 0) {
                showNotification('Failed to create any videos. Please try again.', 'error');
                setIsLoading(false);
                return;
            }

            // Add videos with staggered delays if enabled
            for (let i = 0; i < newVideos.length; i++) {
                const video = newVideos[i];
                const delay = options.randomDelay ? i * 1000 : 0;
                
                setTimeout(() => {
                    setVideos(prev => [...prev, video]);
                    
                    // Setup video events after DOM update
                    setTimeout(() => {
                        setupVideoEvents(video, {
                            onLoad: (loadedVideo) => {
                                setVideos(prev => prev.map(v => 
                                    v.id === loadedVideo.id 
                                        ? { ...v, status: 'ready', stats: loadedVideo.stats }
                                        : v
                                ));
                                updateAllStats();
                            },
                            onError: (errorVideo) => {
                                setVideos(prev => prev.map(v => 
                                    v.id === errorVideo.id 
                                        ? { ...v, status: 'error', stats: errorVideo.stats }
                                        : v
                                ));
                                updateAllStats();
                            }
                        });
                    }, 100);
                }, delay);
            }

            showNotification(`Adding ${quantity} videos...`, 'success');
            
            setTimeout(() => {
                setIsLoading(false);
                updateAllStats();
            }, newVideos.length * (options.randomDelay ? 1000 : 0) + 2000);

        } catch (error) {
            console.error('Error adding videos:', error);
            showNotification('Error adding videos. Please try again.', 'error');
            setIsLoading(false);
        }
    };

    // Remove video
    const handleRemoveVideo = (videoId) => {
        try {
            removeVideo(videoId);
            setVideos(prev => prev.filter(v => v.id !== videoId));
            updateAllStats();
            showNotification('Video removed', 'success');
        } catch (error) {
            console.error('Error removing video:', error);
            showNotification('Error removing video', 'error');
        }
    };

    // Toggle play/pause for individual video
    const togglePlayPause = (videoId) => {
        try {
            const video = videos.find(v => v.id === videoId);
            if (!video) return;

            const command = video.stats.isPlaying ? 'pauseVideo' : 'playVideo';
            const success = controlVideo(videoId, command);
            
            if (success) {
                setVideos(prev => prev.map(v => 
                    v.id === videoId 
                        ? { ...v, stats: { ...v.stats, isPlaying: !v.stats.isPlaying } }
                        : v
                ));
            }
        } catch (error) {
            console.error('Error toggling play/pause:', error);
        }
    };

    // Control all videos
    const playAllVideos = () => {
        try {
            const count = controlAllVideos('playVideo');
            showNotification(`Playing ${count} videos`, 'success');
            updateAllStats();
        } catch (error) {
            console.error('Error playing all videos:', error);
            showNotification('Error playing videos', 'error');
        }
    };

    const pauseAllVideos = () => {
        try {
            const count = controlAllVideos('pauseVideo');
            showNotification(`Paused ${count} videos`, 'success');
            updateAllStats();
        } catch (error) {
            console.error('Error pausing all videos:', error);
            showNotification('Error pausing videos', 'error');
        }
    };

    const muteAllVideos = () => {
        try {
            const count = controlAllVideos('mute');
            showNotification(`Muted ${count} videos`, 'success');
        } catch (error) {
            console.error('Error muting all videos:', error);
            showNotification('Error muting videos', 'error');
        }
    };

    const unmuteAllVideos = () => {
        try {
            const count = controlAllVideos('unMute');
            showNotification(`Unmuted ${count} videos`, 'success');
        } catch (error) {
            console.error('Error unmuting all videos:', error);
            showNotification('Error unmuting videos', 'error');
        }
    };

    // Optimize proxies
    const handleOptimizeProxies = () => {
        try {
            optimizeAllProxies();
            updateAllStats();
            showNotification('Proxies optimized successfully!', 'success');
        } catch (error) {
            console.error('Error optimizing proxies:', error);
            showNotification('Error optimizing proxies', 'error');
        }
    };

    // Clear all videos
    const handleClearAllVideos = () => {
        if (window.confirm('Are you sure you want to remove all videos?')) {
            try {
                clearAllVideos();
                setVideos([]);
                updateAllStats();
                showNotification('All videos cleared', 'success');
            } catch (error) {
                console.error('Error clearing all videos:', error);
                showNotification('Error clearing videos', 'error');
            }
        }
    };

    // Reset proxy
    const handleResetProxy = (proxyKey) => {
        try {
            resetProxy(proxyKey);
            updateAllStats();
            showNotification(`Proxy ${proxyKey} reset successfully`, 'success');
        } catch (error) {
            console.error('Error resetting proxy:', error);
            showNotification('Error resetting proxy', 'error');
        }
    };

    // Event handlers
    const handleProxySelection = (proxy) => setCurrentProxy(proxy);
    const handleOptionChange = (option) => setOptions(prev => ({ ...prev, [option]: !prev[option] }));
    const handleKeyPress = (e) => { if (e.key === 'Enter') addVideos(); };

    // Get proxy health color
    const getProxyHealthColor = (proxyKey) => {
        try {
            const proxyInfo = getProxyInfo(proxyKey);
            if (!proxyInfo || proxyInfo.health === undefined) return '#666';
            
            const health = proxyInfo.health;
            if (health > 80) return '#4caf50';
            if (health > 50) return '#ff9800';
            return '#f44336';
        } catch (error) {
            console.error('Error getting proxy health color:', error);
            return '#666';
        }
    };

    // Get proxy name safely
    const getProxyName = (proxyKey) => {
        try {
            const config = proxyConfig || getDefaultProxyConfig();
            return config.proxies[proxyKey]?.name || proxyKey;
        } catch (error) {
            console.error('Error getting proxy name:', error);
            return proxyKey;
        }
    };

    // Get proxy icon safely
    const getProxyIcon = (proxyKey) => {
        try {
            const config = proxyConfig || getDefaultProxyConfig();
            return config.proxies[proxyKey]?.icon || 'fas fa-server';
        } catch (error) {
            console.error('Error getting proxy icon:', error);
            return 'fas fa-server';
        }
    };

    // Show loading state if not initialized
    if (!isInitialized) {
        return (
            <div className="app">
                <div className="container">
                    <div className="loading-overlay">
                        <div className="loading-spinner"></div>
                        <p>Initializing application...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app">
            <div className="container">
                {/* Header */}
                <header className="header">
                    <div className="header-left">
                        <h1>
                            <i className="fab fa-youtube"></i>
                            YouTube Multi-Player
                        </h1>
                        <p>Advanced YouTube Video Management System</p>
                    </div>
                    <div className="header-right">
                        <div className="global-stats">
                            <div className="stat-item">
                                <span className="stat-value">{globalStats.totalViews}</span>
                                <span className="stat-label">Views</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{formatTime(globalStats.totalWatchTime)}</span>
                                <span className="stat-label">Watch Time</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{globalStats.totalVideos}</span>
                                <span className="stat-label">Videos</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{globalStats.sessionsActive}</span>
                                <span className="stat-label">Active</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Notification */}
                {notification && (
                    <div className="notification show">
                        <span>{notification}</span>
                        <button onClick={() => setNotification('')}>×</button>
                    </div>
                )}

                {/* Main Controls */}
                <div className="main-controls">
                    <div className="control-group">
                        <label>YouTube URL</label>
                        <input 
                            type="text" 
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Enter YouTube URL"
                            className="url-input"
                        />
                    </div>

                    <div className="control-row">
                        <div className="control-group">
                            <label>Quantity</label>
                            <input 
                                type="number" 
                                min="1" 
                                max="50" 
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                className="number-input"
                            />
                        </div>

                        <div className="control-group">
                            <label>Start Time (seconds)</label>
                            <input 
                                type="number" 
                                min="0" 
                                value={startTime}
                                onChange={(e) => setStartTime(parseInt(e.target.value) || 0)}
                                className="number-input"
                            />
                        </div>

                        <div className="control-group">
                            <label>View Duration (seconds)</label>
                            <input 
                                type="number" 
                                min="10" 
                                max="3600" 
                                value={viewDuration}
                                onChange={(e) => setViewDuration(parseInt(e.target.value) || 30)}
                                className="number-input"
                            />
                        </div>
                    </div>

                    <div className="control-group">
                        <label>Proxy Selection</label>
                        <div className="proxy-selector">
                            {proxyConfig && Object.keys(proxyConfig.proxies).map(proxyKey => (
                                <button
                                    key={proxyKey}
                                    className={`proxy-btn ${currentProxy === proxyKey ? 'active' : ''}`}
                                    onClick={() => handleProxySelection(proxyKey)}
                                    style={{ borderColor: getProxyHealthColor(proxyKey) }}
                                >
                                    <i className={getProxyIcon(proxyKey)}></i>
                                    {getProxyName(proxyKey)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="options-grid">
                        {Object.entries(options).map(([key, value]) => (
                            <label key={key} className="option-checkbox">
                                <input
                                    type="checkbox"
                                    checked={value}
                                    onChange={() => handleOptionChange(key)}
                                />
                                <span>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                            </label>
                        ))}
                    </div>

                    <div className="action-buttons">
                        <button 
                            onClick={addVideos} 
                            disabled={isLoading}
                            className="btn btn-primary"
                        >
                            {isLoading ? 'Adding...' : 'Add Videos'}
                        </button>

                        <button 
                            onClick={playAllVideos} 
                            disabled={videos.length === 0}
                            className="btn btn-success"
                        >
                            <i className="fas fa-play"></i> Play All
                        </button>

                        <button 
                            onClick={pauseAllVideos} 
                            disabled={videos.length === 0}
                            className="btn btn-warning"
                        >
                            <i className="fas fa-pause"></i> Pause All
                        </button>

                        <button 
                            onClick={muteAllVideos} 
                            disabled={videos.length === 0}
                            className="btn btn-secondary"
                        >
                            <i className="fas fa-volume-mute"></i> Mute All
                        </button>

                        <button 
                            onClick={unmuteAllVideos} 
                            disabled={videos.length === 0}
                            className="btn btn-secondary"
                        >
                            <i className="fas fa-volume-up"></i> Unmute All
                        </button>

                        <button 
                            onClick={handleOptimizeProxies} 
                            className="btn btn-info"
                        >
                            <i className="fas fa-wrench"></i> Optimize Proxies
                        </button>

                        <button 
                            onClick={handleClearAllVideos} 
                            disabled={videos.length === 0}
                            className="btn btn-danger"
                        >
                            <i className="fas fa-trash"></i> Clear All
                        </button>
                    </div>
                </div>

                {/* Analytics Panel */}
                {options.showAnalytics && (
                    <div className="analytics-panel">
                        <h3>Proxy Analytics</h3>
                        <div className="analytics-stats">
                            <div className="stat-card">
                                <div className="stat-title">Total Requests</div>
                                <div className="stat-value">{proxyAnalytics.totalRequests}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-title">Success Rate</div>
                                <div className="stat-value">{proxyAnalytics.successRate}%</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-title">Healthy Proxies</div>
                                <div className="stat-value">{proxyAnalytics.healthyProxies}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-title">Blocked Proxies</div>
                                <div className="stat-value">{proxyAnalytics.blockedProxies}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Video Grid */}
                <div className="video-grid">
                    {videos.map(video => (
                        <div key={video.id} className="video-card">
                            <div className="video-header">
                                <div className="video-info">
                                    <span className="video-id">#{video.index + 1}</span>
                                    <span className={`status ${video.status}`}>{video.status}</span>
                                </div>
                                <div className="video-controls">
                                    <button 
                                        onClick={() => togglePlayPause(video.id)}
                                        className="control-btn"
                                        title={video.stats.isPlaying ? 'Pause' : 'Play'}
                                    >
                                        <i className={`fas ${video.stats.isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                                    </button>
                                    <button 
                                        onClick={() => handleRemoveVideo(video.id)}
                                        className="control-btn remove-btn"
                                        title="Remove Video"
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>

                            <div className="video-container">
                                <iframe
                                    id={video.frameId}
                                    src={video.embedUrl}
                                    title={`YouTube video ${video.index + 1}`}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className="video-frame"
                                ></iframe>
                            </div>

                            <div className="video-stats">
                                <div className="stat-row">
                                    <span>Views: {video.stats.views}</span>
                                    <span>Watch Time: {formatTime(video.stats.watchTime)}</span>
                                </div>
                                <div className="stat-row">
                                    <span>Proxy: {getProxyName(video.proxy)}</span>
                                    <span>Browser: {video.userAgent}</span>
                                </div>
                                <div className="stat-row">
                                    <span>Errors: {video.stats.errors}</span>
                                    <span>Load Time: {video.stats.loadTime}ms</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty State */}
                {videos.length === 0 && !isLoading && (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <i className="fab fa-youtube"></i>
                        </div>
                        <h3>No Videos Added Yet</h3>
                        <p>Enter a YouTube URL above and click "Add Videos" to get started</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;