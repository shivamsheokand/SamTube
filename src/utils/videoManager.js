// utils/videoManager.js

import { sendVideoCommand, simulateHumanBehavior, getRandomDelay } from './videoUtils.js';
import { updateProxyHealth, selectOptimalProxy } from './proxyManager.js';

class VideoManager {
  constructor() {
    this.videos = new Map();
    this.globalStats = {
      totalViews: 0,
      totalWatchTime: 0,
      totalVideos: 0,
      sessionsActive: 0
    };
    this.intervals = new Map();
    this.observers = [];
  }

  createVideo(videoData) {
    const video = {
      id: videoData.id,
      frameId: videoData.frameId,
      videoId: videoData.videoId,
      proxy: videoData.proxy,
      userAgent: videoData.userAgent,
      startTime: Date.now(),
      stats: {
        views: 0,
        watchTime: 0,
        interactions: 0,
        isPlaying: false,
        loadTime: 0,
        errors: 0
      },
      options: videoData.options || {
        autoplay: true,
        muted: true,
        controls: true,
        humanBehavior: true,
        viewDuration: 30,
        startTime: 0
      },
      status: 'loading',
      retryCount: 0
    };

    this.videos.set(video.id, video);
    this.globalStats.totalVideos++;
    this.notifyObservers('videoCreated', video);
    return video;
  }

  setupVideoEvents(video, callbacks = {}) {
    const iframe = document.getElementById(video.frameId);
    if (!iframe) {
      console.warn(`Iframe not found for video ${video.id}`);
      return;
    }

    const startTime = Date.now();
    
    iframe.onload = () => {
      try {
        const loadTime = Date.now() - startTime;
        video.stats.loadTime = loadTime;
        video.status = 'ready';
        
        updateProxyHealth(video.proxy, true, loadTime);
        
        if (callbacks.onLoad) callbacks.onLoad(video);
        this.startVideoSession(video);
        this.notifyObservers('videoLoaded', video);
      } catch (error) {
        console.error('Error in iframe onload:', error);
      }
    };

    iframe.onerror = () => {
      try {
        video.stats.errors++;
        video.status = 'error';
        
        updateProxyHealth(video.proxy, false);
        
        if (video.retryCount < 3) {
          this.retryVideo(video);
        } else {
          if (callbacks.onError) callbacks.onError(video);
          this.notifyObservers('videoError', video);
        }
      } catch (error) {
        console.error('Error in iframe onerror:', error);
      }
    };

    // Timeout handling
    setTimeout(() => {
      if (video.status === 'loading') {
        iframe.onerror();
      }
    }, 15000);
  }

  startVideoSession(video) {
    if (this.intervals.has(video.id)) return;

    // Ensure video options exist with defaults
    if (!video.options) {
      video.options = {
        autoplay: true,
        muted: true,
        controls: true,
        humanBehavior: true,
        viewDuration: 30,
        startTime: 0
      };
    }

    const interval = setInterval(() => {
      try {
        if (video.stats.isPlaying) {
          video.stats.watchTime++;
          this.globalStats.totalWatchTime++;
          
          // Count as view every 30 seconds
          if (video.stats.watchTime % 30 === 0) {
            video.stats.views++;
            this.globalStats.totalViews++;
            this.notifyObservers('viewIncrement', video);
          }
        }
      } catch (error) {
        console.error('Error in video session interval:', error);
      }
    }, 1000);

    this.intervals.set(video.id, interval);
    this.globalStats.sessionsActive++;

    // Auto-stop after duration
    if (video.options.viewDuration && video.options.viewDuration > 0) {
      setTimeout(() => {
        this.stopVideoSession(video.id);
      }, video.options.viewDuration * 1000);
    }

    // Simulate human behavior
    if (video.options.humanBehavior && video.options.viewDuration) {
      try {
        simulateHumanBehavior(video.frameId, video.options.viewDuration * 1000);
      } catch (error) {
        console.error('Error simulating human behavior:', error);
      }
    }
  }

  stopVideoSession(videoId) {
    const interval = this.intervals.get(videoId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(videoId);
      this.globalStats.sessionsActive = Math.max(0, this.globalStats.sessionsActive - 1);
    }
  }

  retryVideo(video) {
    try {
      video.retryCount++;
      video.status = 'retrying';
      
      // Try different proxy
      const newProxy = selectOptimalProxy([video.proxy]);
      if (newProxy) {
        video.proxy = newProxy;
      }
      
      setTimeout(() => {
        video.status = 'loading';
        this.notifyObservers('videoRetry', video);
      }, getRandomDelay(2000, 5000));
    } catch (error) {
      console.error('Error retrying video:', error);
      video.status = 'error';
    }
  }

  controlVideo(videoId, command, args = []) {
    try {
      const video = this.videos.get(videoId);
      if (!video) return false;

      const success = sendVideoCommand(video.frameId, command, args);
      
      if (success) {
        video.stats.interactions++;
        
        // Update playing status
        if (command === 'playVideo') {
          video.stats.isPlaying = true;
        } else if (command === 'pauseVideo') {
          video.stats.isPlaying = false;
        }
        
        this.notifyObservers('videoCommand', { video, command, args });
      }
      
      return success;
    } catch (error) {
      console.error('Error controlling video:', error);
      return false;
    }
  }

  controlAllVideos(command, args = []) {
    let successCount = 0;
    
    try {
      this.videos.forEach((video) => {
        if (this.controlVideo(video.id, command, args)) {
          successCount++;
        }
      });
    } catch (error) {
      console.error('Error controlling all videos:', error);
    }
    
    return successCount;
  }

  removeVideo(videoId) {
    try {
      const video = this.videos.get(videoId);
      if (!video) return false;

      this.stopVideoSession(videoId);
      this.videos.delete(videoId);
      this.globalStats.totalVideos = Math.max(0, this.globalStats.totalVideos - 1);
      
      this.notifyObservers('videoRemoved', video);
      return true;
    } catch (error) {
      console.error('Error removing video:', error);
      return false;
    }
  }

  getVideoStats(videoId) {
    const video = this.videos.get(videoId);
    return video ? { ...video.stats } : null;
  }

  getGlobalStats() {
    return { ...this.globalStats };
  }

  getDetailedStats() {
    try {
      const videos = Array.from(this.videos.values());
      const proxyUsage = {};
      const statusCounts = {};

      videos.forEach(video => {
        proxyUsage[video.proxy] = (proxyUsage[video.proxy] || 0) + 1;
        statusCounts[video.status] = (statusCounts[video.status] || 0) + 1;
      });

      return {
        global: this.globalStats,
        proxyUsage,
        statusCounts,
        averageWatchTime: this.globalStats.totalVideos > 0 ? 
          Math.round(this.globalStats.totalWatchTime / this.globalStats.totalVideos) : 0,
        averageViews: this.globalStats.totalVideos > 0 ? 
          Math.round(this.globalStats.totalViews / this.globalStats.totalVideos) : 0
      };
    } catch (error) {
      console.error('Error getting detailed stats:', error);
      return {
        global: this.globalStats,
        proxyUsage: {},
        statusCounts: {},
        averageWatchTime: 0,
        averageViews: 0
      };
    }
  }

  clearAll() {
    try {
      this.videos.forEach((video) => {
        this.stopVideoSession(video.id);
      });
      
      this.videos.clear();
      this.intervals.clear();
      this.globalStats = {
        totalViews: 0,
        totalWatchTime: 0,
        totalVideos: 0,
        sessionsActive: 0
      };
      
      this.notifyObservers('allCleared');
    } catch (error) {
      console.error('Error clearing all videos:', error);
    }
  }

  // Observer pattern for UI updates
  addObserver(callback) {
    if (typeof callback === 'function') {
      this.observers.push(callback);
    }
  }

  removeObserver(callback) {
    this.observers = this.observers.filter(obs => obs !== callback);
  }

  notifyObservers(event, data) {
    this.observers.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Observer callback error:', error);
      }
    });
  }
}

// Export singleton instance
let videoManager = null;

export const initializeVideoManager = () => {
  try {
    videoManager = new VideoManager();
    console.log('VideoManager initialized successfully');
    return videoManager;
  } catch (error) {
    console.error('Failed to initialize VideoManager:', error);
    videoManager = new VideoManager();
    return videoManager;
  }
};

export const getVideoManager = () => {
  if (!videoManager) {
    videoManager = initializeVideoManager();
  }
  return videoManager;
};

// Convenience exports with error handling
export const createVideo = (videoData) => {
  try {
    return getVideoManager().createVideo(videoData);
  } catch (error) {
    console.error('Error creating video:', error);
    return null;
  }
};

export const setupVideoEvents = (video, callbacks) => {
  try {
    return getVideoManager().setupVideoEvents(video, callbacks);
  } catch (error) {
    console.error('Error setting up video events:', error);
  }
};

export const controlVideo = (videoId, command, args) => {
  try {
    return getVideoManager().controlVideo(videoId, command, args);
  } catch (error) {
    console.error('Error controlling video:', error);
    return false;
  }
};

export const controlAllVideos = (command, args) => {
  try {
    return getVideoManager().controlAllVideos(command, args);
  } catch (error) {
    console.error('Error controlling all videos:', error);
    return 0;
  }
};

export const removeVideo = (videoId) => {
  try {
    return getVideoManager().removeVideo(videoId);
  } catch (error) {
    console.error('Error removing video:', error);
    return false;
  }
};

export const getVideoStats = (videoId) => {
  try {
    return getVideoManager().getVideoStats(videoId);
  } catch (error) {
    console.error('Error getting video stats:', error);
    return null;
  }
};

export const getGlobalStats = () => {
  try {
    return getVideoManager().getGlobalStats();
  } catch (error) {
    console.error('Error getting global stats:', error);
    return {
      totalViews: 0,
      totalWatchTime: 0,
      totalVideos: 0,
      sessionsActive: 0
    };
  }
};

export const getDetailedStats = () => {
  try {
    return getVideoManager().getDetailedStats();
  } catch (error) {
    console.error('Error getting detailed stats:', error);
    return {
      global: {
        totalViews: 0,
        totalWatchTime: 0,
        totalVideos: 0,
        sessionsActive: 0
      },
      proxyUsage: {},
      statusCounts: {},
      averageWatchTime: 0,
      averageViews: 0
    };
  }
};

export const clearAllVideos = () => {
  try {
    return getVideoManager().clearAll();
  } catch (error) {
    console.error('Error clearing all videos:', error);
  }
};

export const addStatsObserver = (callback) => {
  try {
    return getVideoManager().addObserver(callback);
  } catch (error) {
    console.error('Error adding stats observer:', error);
  }
};