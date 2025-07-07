import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// --- Data from src/config/proxies.json ---
const proxiesConfig = {
  "proxies": {
    "auto": {
      "name": "Auto Switch",
      "embed": null,
      "priority": 1,
      "health": 100,
      "icon": "fas fa-robot"
    },
    "noproxy": {
      "name": "Direct YouTube",
      "embed": "https://www.youtube.com/embed/",
      "priority": 5,
      "health": 100,
      "icon": "fas fa-shield-alt"
    },
    "nocookie": {
      "name": "YouTube No Cookie",
      "embed": "https://www.youtube-nocookie.com/embed/",
      "priority": 4,
      "health": 100,
      "icon": "fas fa-cookie-bite"
    },
    "piped": {
      "name": "Piped",
      "embed": "https://piped.video/embed/",
      "priority": 3,
      "health": 95,
      "icon": "fas fa-pipe"
    },
    "invidious": {
      "name": "Invidious",
      "embed": "https://invidio.us/embed/",
      "priority": 3,
      "health": 90,
      "icon": "fas fa-eye-slash"
    },
    "proxy1": {
      "name": "Proxy Server 1",
      "embed": "https://www.youtube-nocookie.com/embed/",
      "priority": 2,
      "health": 85,
      "icon": "fas fa-server"
    },
    "proxy2": {
      "name": "Proxy Server 2",
      "embed": "https://piped.kavin.rocks/embed/",
      "priority": 2,
      "health": 80,
      "icon": "fas fa-globe"
    },
    "proxy3": {
      "name": "Proxy Server 3",
      "embed": "https://invidious.io/embed/",
      "priority": 2,
      "health": 75,
      "icon": "fas fa-vpn"
    }
  },
  "userAgents": [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36"
  ]
};


// --- Logic from src/utils/proxyManager.js ---
class ProxyManager {
  constructor() {
    this.proxies = proxiesConfig.proxies;
    this.proxyHealth = {};
    this.initializeProxyHealth();
  }

  initializeProxyHealth() {
    Object.keys(this.proxies).forEach(proxy => {
      if (proxy !== 'auto') {
        this.proxyHealth[proxy] = {
          health: this.proxies[proxy].health,
          lastUsed: 0,
          failures: 0,
          successes: 0,
          avgResponseTime: 0,
          totalRequests: 0
        };
      }
    });
  }

  selectOptimalProxy() {
    const availableProxies = Object.keys(this.proxies).filter(p => p !== 'auto' && this.proxies[p].embed);
    
    const scores = availableProxies.map(proxy => {
      const health = this.proxyHealth[proxy];
      const timeSinceLastUse = Date.now() - health.lastUsed;
      const successRate = health.successes / Math.max(1, health.successes + health.failures);
      const loadBalance = Math.min(timeSinceLastUse / 1000, 100);
      
      return {
        proxy,
        score: (health.health * 0.4) + (successRate * 100 * 0.3) + (loadBalance * 0.3)
      };
    });

    scores.sort((a, b) => b.score - a.score);
    return scores.length > 0 ? scores[0].proxy : 'noproxy';
  }

  updateProxyHealth(proxy, success) {
    if (!this.proxyHealth[proxy]) return;
    
    const health = this.proxyHealth[proxy];
    health.totalRequests++;
    health.lastUsed = Date.now();
    
    if (success) {
      health.successes++;
      health.health = Math.min(100, health.health + 2);
    } else {
      health.failures++;
      health.health = Math.max(0, health.health - 5);
    }
  }

  getProxyHealth() {
    return this.proxyHealth;
  }

  optimizeAllProxies() {
    Object.keys(this.proxyHealth).forEach(proxy => {
      const health = this.proxyHealth[proxy];
      if (health.successes > health.failures) {
        health.health = Math.min(100, health.health + 10);
      }
      if (Date.now() - health.lastUsed > 300000) { // 5 minutes
        health.failures = Math.max(0, health.failures - 1);
      }
    });
  }
}


// --- Logic from src/utils/videoUtils.js ---
const videoUtils = {
    getVideoId: (url) => {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/watch\?.*v=([^&\n?#]+)/
        ];
        for (let pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    },
    getUserAgentShort: (userAgent) => {
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        if (userAgent.includes('Edge')) return 'Edge';
        return 'Unknown';
    },
    sendCommandToVideo: (frameId, command, args = '') => {
        const frame = document.getElementById(frameId);
        if (frame && frame.contentWindow) {
            try {
                const message = JSON.stringify({ event: 'command', func: command, args: args });
                frame.contentWindow.postMessage(message, '*');
            } catch (error) {
                console.warn(`Could not send command to video ${frameId}:`, error);
            }
        }
    }
};


// --- Main App Component ---
function App() {
    // State variables
    const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    const [quantity, setQuantity] = useState(3);
    const [startTime, setStartTime] = useState(0);
    const [viewDuration, setViewDuration] = useState(30);
    const [currentProxy, setCurrentProxy] = useState('auto');
    const [videos, setVideos] = useState([]);
    const [stats, setStats] = useState({ totalVideos: 0, totalViews: 0, activeProxies: 0, avgViewTime: 0 });
    const [isLoading, setIsLoading] = useState(false);
    
    // Options state
    const [options, setOptions] = useState({
        autoplay: true,
        randomDelay: true,
        realUserSim: true,
        viewCounting: true,
        proxyRotation: true,
        muted: true,
        controls: true
    });

    // UseRef to hold manager instances to prevent re-creation on re-renders
    const proxyManager = useRef(new ProxyManager());
    const videoData = useRef({}); // To store non-reactive data for each video
    const totalViews = useRef(0);
    const videoCounter = useRef(0);

    // Update statistics
    const updateStats = useCallback(() => {
        const currentVideoData = videoData.current;
        const activeVideos = Object.values(currentVideoData);
        const totalViewTime = activeVideos.reduce((sum, v) => sum + (v.totalTime || 0), 0);
        const proxyHealth = proxyManager.current.getProxyHealth();
        const healthyProxies = Object.values(proxyHealth).filter(p => p.health > 50).length;
        const avgTime = activeVideos.length > 0 ? Math.round(totalViewTime / activeVideos.length) : 0;

        setStats({
            totalVideos: activeVideos.length,
            totalViews: totalViews.current,
            activeProxies: healthyProxies,
            avgViewTime: avgTime
        });
    }, []);

    // Function to add new videos
    const addVideos = () => {
        if (!videoUrl.trim()) {
            alert('Please enter a YouTube URL');
            return;
        }
        const videoId = videoUtils.getVideoId(videoUrl);
        if (!videoId) {
            alert('Invalid YouTube URL. Please check the URL and try again.');
            return;
        }
        if (quantity < 1 || quantity > 50) {
            alert('Please enter a quantity between 1 and 50');
            return;
        }

        setIsLoading(true);
        const newVideos = [];

        for (let i = 0; i < quantity; i++) {
            const cardId = `video-card-${videoCounter.current + i}`;
            const frameId = `frame-${videoCounter.current + i}`;
            const selectedProxy = currentProxy === 'auto' ? proxyManager.current.selectOptimalProxy() : currentProxy;
            const userAgent = proxiesConfig.userAgents[Math.floor(Math.random() * proxiesConfig.userAgents.length)];

            const embedUrl = new URL(proxiesConfig.proxies[selectedProxy].embed + videoId);
            embedUrl.searchParams.set('autoplay', options.autoplay ? 1 : 0);
            embedUrl.searchParams.set('mute', options.muted ? 1 : 0);
            embedUrl.searchParams.set('controls', options.controls ? 1 : 0);
            embedUrl.searchParams.set('start', startTime);
            embedUrl.searchParams.set('origin', window.location.origin);
            embedUrl.searchParams.set('enablejsapi', 1);

            const videoCard = {
                id: cardId,
                frameId: frameId,
                videoId: videoId,
                embedUrl: embedUrl.toString(),
                proxy: selectedProxy,
                userAgent: videoUtils.getUserAgentShort(userAgent),
                index: videoCounter.current + i,
                isLoading: true,
                hasError: false,
                views: 0
            };
            
            videoData.current[cardId] = {
                proxy: selectedProxy,
                userAgent: userAgent,
                totalTime: 0,
                views: 0,
                isPlaying: options.autoplay,
                viewDuration: viewDuration,
            };

            newVideos.push(videoCard);
        }
        
        setVideos(prev => [...prev, ...newVideos]);
        videoCounter.current += quantity;

        setTimeout(() => {
            setIsLoading(false);
            updateStats();
        }, quantity * (options.randomDelay ? 500 : 0) + 1000);
    };

    const handleVideoLoad = (cardId, proxy) => {
        proxyManager.current.updateProxyHealth(proxy, true);
        setVideos(prev => prev.map(v => v.id === cardId ? { ...v, isLoading: false } : v));
        
        const data = videoData.current[cardId];
        if (options.viewCounting && data) {
            data.interval = setInterval(() => {
                if (data.isPlaying) {
                    data.totalTime += 1;
                    if (data.totalTime > 0 && data.totalTime % 30 === 0) {
                        data.views++;
                        totalViews.current++;
                        setVideos(prev => prev.map(v => v.id === cardId ? { ...v, views: data.views } : v));
                        updateStats();
                    }
                }
                if (data.totalTime >= data.viewDuration) {
                    clearInterval(data.interval);
                }
            }, 1000);
        }
        updateStats();
    };

    const handleVideoError = (cardId, proxy) => {
        proxyManager.current.updateProxyHealth(proxy, false);
        setVideos(prev => prev.map(v => v.id === cardId ? { ...v, isLoading: false, hasError: true } : v));
        updateStats();
    };

    const removeVideo = (cardId) => {
        const data = videoData.current[cardId];
        if (data && data.interval) {
            clearInterval(data.interval);
        }
        delete videoData.current[cardId];
        setVideos(prev => prev.filter(v => v.id !== cardId));
        updateStats();
    };
    
    const sendCommandToAll = (command) => {
        Object.keys(videoData.current).forEach(cardId => {
            const frameId = `frame-${cardId.split('-')[2]}`;
            videoUtils.sendCommandToVideo(frameId, command);
            if(command === 'playVideo') videoData.current[cardId].isPlaying = true;
            if(command === 'pauseVideo') videoData.current[cardId].isPlaying = false;
        });
    };

    const clearAllVideos = () => {
        if (window.confirm('Are you sure you want to remove all videos?')) {
            Object.values(videoData.current).forEach(data => {
                if (data.interval) clearInterval(data.interval);
            });
            videoData.current = {};
            totalViews.current = 0;
            setVideos([]);
            updateStats();
        }
    };

    const optimizeProxies = () => {
        proxyManager.current.optimizeAllProxies();
        updateStats();
        alert('Proxies optimized successfully!');
    };

    useEffect(() => {
        updateStats();
    }, [videos, updateStats]);


    return (
        <div className="app">
            <div className="container">
                <div className="header">
                    <h1 className="title">🎬 YouTube Multi-Player Pro Advanced</h1>
                    <p className="subtitle">Advanced YouTube player with intelligent proxy switching & real user simulation</p>
                </div>

                <div className="stats-bar">
                    <div className="stat-item"><div className="stat-number">{stats.totalVideos}</div><div className="stat-label">Total Videos</div></div>
                    <div className="stat-item"><div className="stat-number">{stats.totalViews}</div><div className="stat-label">Total Views</div></div>
                    <div className="stat-item"><div className="stat-number">{stats.activeProxies}</div><div className="stat-label">Active Proxies</div></div>
                    <div className="stat-item"><div className="stat-number">{stats.avgViewTime}s</div><div className="stat-label">Avg View Time</div></div>
                </div>

                <div className="input-section">
                    <div className="input-grid">
                        <div className="input-group">
                            <label className="label">YouTube Video URL</label>
                            <input type="text" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="input" placeholder="https://www.youtube.com/watch?v=..." />
                        </div>
                        <div className="input-group">
                            <label className="label">Quantity</label>
                            <input type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value))} className="input" min="1" max="50" />
                        </div>
                        <div className="input-group">
                            <label className="label">Start Time (s)</label>
                            <input type="number" value={startTime} onChange={(e) => setStartTime(parseInt(e.target.value))} className="input" min="0" />
                        </div>
                        <div className="input-group">
                            <label className="label">View Duration (s)</label>
                            <input type="number" value={viewDuration} onChange={(e) => setViewDuration(parseInt(e.target.value))} className="input" min="5" />
                        </div>
                        <button onClick={addVideos} disabled={isLoading} className="btn btn-primary">
                            {isLoading ? 'Adding...' : 'Add Videos'}
                        </button>
                    </div>

                    <div>
                        <label className="label">Proxy Management:</label>
                        <div className="proxy-selector">
                            {Object.entries(proxiesConfig.proxies).map(([key, proxy]) => (
                                <div key={key} className={`proxy-option ${currentProxy === key ? 'active' : ''}`} onClick={() => setCurrentProxy(key)}>
                                    <i className={proxy.icon}></i> {proxy.name}
                                    {key === 'auto' && <span className="auto-switch-indicator">AI</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="advanced-options">
                        <label className="label"><i className="fas fa-cog"></i> Advanced Options</label>
                        <div className="checkbox-group">
                            {Object.entries(options).map(([key, value]) => (
                                <div key={key} className="checkbox-item">
                                    <input type="checkbox" id={key} checked={value} onChange={() => setOptions(p => ({...p, [key]: !p[key]}))} className="checkbox" />
                                    <label htmlFor={key}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {videos.length > 0 && (
                    <div className="control-buttons active">
                        <button onClick={() => sendCommandToAll('playVideo')} className="btn btn-success"><i className="fas fa-play"></i> Play All</button>
                        <button onClick={() => sendCommandToAll('pauseVideo')} className="btn btn-danger"><i className="fas fa-pause"></i> Pause All</button>
                        <button onClick={() => sendCommandToAll('mute')} className="btn btn-secondary"><i className="fas fa-volume-mute"></i> Mute All</button>
                        <button onClick={() => sendCommandToAll('unMute')} className="btn btn-secondary"><i className="fas fa-volume-up"></i> Unmute All</button>
                        <button onClick={optimizeProxies} className="btn btn-secondary"><i className="fas fa-magic"></i> Optimize Proxies</button>
                        <button onClick={clearAllVideos} className="btn btn-secondary"><i className="fas fa-trash"></i> Clear All</button>
                    </div>
                )}

                <div className="video-grid">
                    {videos.map((video, i) => (
                        <div key={video.id} className="video-card visible" style={{ transitionDelay: `${options.randomDelay ? i * 100 : 0}ms` }}>
                            <div className="video-wrapper">
                                {video.isLoading && <div className="loading-overlay"><div className="loading-spinner"></div></div>}
                                <iframe
                                    id={video.frameId}
                                    className={`video-frame ${!video.isLoading ? 'loaded' : ''}`}
                                    src={video.embedUrl}
                                    onLoad={() => handleVideoLoad(video.id, video.proxy)}
                                    onError={() => handleVideoError(video.id, video.proxy)}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    loading="lazy"
                                />
                                <div className="video-controls">
                                    <button className="close-btn" onClick={() => removeVideo(video.id)} title="Remove"><i className="fas fa-times"></i></button>
                                </div>
                                <div className="proxy-indicator"><i className="fas fa-server"></i> {proxiesConfig.proxies[video.proxy].name}</div>
                                <div className="view-counter"><i className="fas fa-eye"></i> {video.views} views</div>
                                <div className="user-agent-indicator"><i className="fas fa-desktop"></i> {video.userAgent}</div>
                            </div>
                            <div className="video-info">
                                <span className="video-title">Video {video.index + 1}</span>
                                <span className={`video-status ${video.isLoading ? 'status-loading' : video.hasError ? 'status-error' : 'status-ready'}`}>
                                    {video.isLoading && 'Loading'}
                                    {video.hasError && 'Error'}
                                    {!video.isLoading && !video.hasError && 'Ready'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {videos.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-icon"><i className="fas fa-video"></i></div>
                        <h3 className="empty-title">No Videos Yet</h3>
                        <p>Add some YouTube videos to get started!</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
