// utils/videoUtils.js

// YouTube URL validation and video ID extraction
export const validateVideoUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Please enter a valid YouTube URL' };
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*&v=([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { valid: true, videoId: match[1] };
    }
  }

  return { valid: false, error: 'Invalid YouTube URL format' };
};

export const getVideoId = (url) => {
  const validation = validateVideoUrl(url);
  return validation.valid ? validation.videoId : null;
};

// Build embed URL with proxy and parameters
export const buildEmbedUrl = (videoId, proxyUrl, options = {}) => {
  const params = new URLSearchParams();
  
  // Basic parameters
  params.append('enablejsapi', '1');
  params.append('origin', window.location.origin);
  params.append('widget_referrer', window.location.href);
  
  // Optional parameters
  if (options.autoplay) params.append('autoplay', options.autoplay);
  if (options.muted) params.append('mute', options.muted);
  if (options.controls !== undefined) params.append('controls', options.controls);
  if (options.startTime) params.append('start', options.startTime);
  if (options.loop) params.append('loop', options.loop);
  if (options.playlist && options.loop) params.append('playlist', videoId);
  
  // Custom parameters
  if (options.customParams) {
    Object.entries(options.customParams).forEach(([key, value]) => {
      params.append(key, value);
    });
  }

  // Build final URL
  const baseUrl = proxyUrl || 'https://www.youtube.com/embed/';
  const finalUrl = `${baseUrl}${videoId}?${params.toString()}`;
  
  return finalUrl;
};

// Utility functions
export const generateUniqueId = () => {
  return `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const getUserAgentShort = (userAgent) => {
  if (!userAgent) return 'Unknown';
  
  const patterns = [
    { regex: /Chrome\/(\d+)/, name: 'Chrome' },
    { regex: /Firefox\/(\d+)/, name: 'Firefox' },
    { regex: /Safari\/(\d+)/, name: 'Safari' },
    { regex: /Edge\/(\d+)/, name: 'Edge' },
    { regex: /Opera\/(\d+)/, name: 'Opera' }
  ];

  for (const pattern of patterns) {
    const match = userAgent.match(pattern.regex);
    if (match) {
      return `${pattern.name} ${match[1]}`;
    }
  }

  return 'Unknown Browser';
};

export const formatViews = (views) => {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  } else if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
};

export const formatTime = (seconds) => {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};

// Video control functions
export const sendVideoCommand = (frameId, command, args = []) => {
  try {
    const iframe = document.getElementById(frameId);
    if (!iframe || !iframe.contentWindow) return false;

    const message = {
      event: 'command',
      func: command,
      args: args
    };

    iframe.contentWindow.postMessage(JSON.stringify(message), '*');
    return true;
  } catch (error) {
    console.warn('Failed to send video command:', error);
    return false;
  }
};

// Human behavior simulation
export const simulateHumanBehavior = (frameId, duration) => {
  const actions = [
    { delay: 2000, action: () => simulateMouseMove(frameId) },
    { delay: 5000, action: () => simulateScroll(frameId) },
    { delay: 8000, action: () => simulateMouseMove(frameId) },
    { delay: 12000, action: () => simulateKeyPress(frameId) }
  ];

  actions.forEach(({ delay, action }) => {
    if (delay < duration) {
      setTimeout(action, delay);
    }
  });
};

const simulateMouseMove = (frameId) => {
  const iframe = document.getElementById(frameId);
  if (!iframe) return;

  const rect = iframe.getBoundingClientRect();
  const event = new MouseEvent('mousemove', {
    clientX: rect.left + Math.random() * rect.width,
    clientY: rect.top + Math.random() * rect.height,
    bubbles: true
  });

  iframe.dispatchEvent(event);
};

const simulateScroll = (frameId) => {
  const iframe = document.getElementById(frameId);
  if (!iframe) return;

  const event = new WheelEvent('wheel', {
    deltaY: Math.random() * 100 - 50,
    bubbles: true
  });

  iframe.dispatchEvent(event);
};

const simulateKeyPress = (frameId) => {
  const iframe = document.getElementById(frameId);
  if (!iframe) return;

  const keys = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const randomKey = keys[Math.floor(Math.random() * keys.length)];

  const event = new KeyboardEvent('keydown', {
    key: randomKey,
    bubbles: true
  });

  iframe.dispatchEvent(event);
};

// Utility for random delays
export const getRandomDelay = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Default proxy configuration if not provided
export const getDefaultProxyConfig = () => {
  return {
    proxies: {
      auto: {
        name: 'Auto Select',
        icon: 'fas fa-magic',
        embed: null,
        health: 100
      },
      noproxy: {
        name: 'Direct',
        icon: 'fas fa-globe',
        embed: 'https://www.youtube.com/embed/',
        health: 85
      },
      proxy1: {
        name: 'Proxy 1',
        icon: 'fas fa-server',
        embed: 'https://www.youtube-nocookie.com/embed/',
        health: 75
      }
    },
    userAgents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ],
    settings: {
      maxRetries: 3,
      retryDelay: 2000,
      healthCheckInterval: 30000
    }
  };
};