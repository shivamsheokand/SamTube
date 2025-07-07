// utils/proxyManager.js

class ProxyManager {
  constructor(proxyConfig) {
    this.proxies = proxyConfig?.proxies || {};
    this.settings = proxyConfig?.settings || {};
    this.userAgents = proxyConfig?.userAgents || [];
    this.health = {};
    this.analytics = {};
    this.initialize();
  }

  initialize() {
    Object.keys(this.proxies).forEach(key => {
      if (key !== 'auto') {
        this.health[key] = {
          health: this.proxies[key]?.health || 50,
          lastUsed: 0,
          failures: 0,
          successes: 0,
          avgResponseTime: 0,
          totalRequests: 0,
          consecutiveFailures: 0,
          isBlocked: false
        };
      }
    });
  }

  selectOptimalProxy(excludeProxies = []) {
    const available = Object.keys(this.proxies)
      .filter(key => 
        key !== 'auto' && 
        this.proxies[key]?.embed && 
        !excludeProxies.includes(key) &&
        !this.health[key]?.isBlocked
      );

    if (available.length === 0) {
      // Return fallback proxy if none available
      return Object.keys(this.proxies).find(key => key !== 'auto') || 'noproxy';
    }

    const scored = available.map(key => ({
      key,
      score: this.calculateProxyScore(key)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].key;
  }

  calculateProxyScore(proxyKey) {
    const proxy = this.health[proxyKey];
    if (!proxy) return 0;

    const timeSinceLastUse = Date.now() - proxy.lastUsed;
    const successRate = proxy.totalRequests > 0 ? 
      (proxy.successes / proxy.totalRequests) * 100 : 50;
    
    // Load balancing factor
    const loadBalance = Math.min(timeSinceLastUse / 10000, 50);
    
    // Penalty for consecutive failures
    const failurePenalty = Math.max(0, 20 - (proxy.consecutiveFailures * 10));
    
    // Response time factor (lower is better)
    const speedFactor = proxy.avgResponseTime > 0 ? 
      Math.max(0, 30 - (proxy.avgResponseTime / 1000)) : 15;

    return (
      (proxy.health * 0.3) +
      (successRate * 0.25) +
      (loadBalance * 0.2) +
      (failurePenalty * 0.15) +
      (speedFactor * 0.1)
    );
  }

  updateHealth(proxyKey, success, responseTime = 0) {
    const proxy = this.health[proxyKey];
    if (!proxy) return;

    proxy.totalRequests++;
    proxy.lastUsed = Date.now();

    if (success) {
      proxy.successes++;
      proxy.consecutiveFailures = 0;
      proxy.health = Math.min(100, proxy.health + 3);
      proxy.isBlocked = false;
      
      if (responseTime > 0) {
        proxy.avgResponseTime = proxy.avgResponseTime === 0 ? 
          responseTime : (proxy.avgResponseTime + responseTime) / 2;
      }
    } else {
      proxy.failures++;
      proxy.consecutiveFailures++;
      proxy.health = Math.max(0, proxy.health - 8);
      
      // Mark as blocked if too many consecutive failures
      if (proxy.consecutiveFailures >= 3) {
        proxy.isBlocked = true;
        setTimeout(() => {
          if (proxy.isBlocked) {
            proxy.isBlocked = false;
            proxy.consecutiveFailures = 0;
          }
        }, 60000); // Unblock after 1 minute
      }
    }
  }

  getHealthyProxies() {
    return Object.keys(this.health)
      .filter(key => this.health[key]?.health > 30 && !this.health[key]?.isBlocked)
      .sort((a, b) => (this.health[b]?.health || 0) - (this.health[a]?.health || 0));
  }

  optimizeAll() {
    Object.keys(this.health).forEach(key => {
      const proxy = this.health[key];
      if (!proxy) return;
      
      // Gradual health recovery for unused proxies
      if (Date.now() - proxy.lastUsed > 300000) { // 5 minutes
        proxy.health = Math.min(100, proxy.health + 5);
        proxy.consecutiveFailures = Math.max(0, proxy.consecutiveFailures - 1);
      }
      
      // Boost successful proxies
      if (proxy.successes > proxy.failures * 2) {
        proxy.health = Math.min(100, proxy.health + 2);
      }
    });
  }

  getAnalytics() {
    const total = Object.values(this.health).reduce((acc, proxy) => ({
      totalRequests: acc.totalRequests + (proxy?.totalRequests || 0),
      totalSuccesses: acc.totalSuccesses + (proxy?.successes || 0),
      totalFailures: acc.totalFailures + (proxy?.failures || 0)
    }), { totalRequests: 0, totalSuccesses: 0, totalFailures: 0 });

    return {
      ...total,
      successRate: total.totalRequests > 0 ? 
        parseFloat(((total.totalSuccesses / total.totalRequests) * 100).toFixed(1)) : 0,
      healthyProxies: this.getHealthyProxies().length,
      blockedProxies: Object.values(this.health).filter(p => p?.isBlocked).length
    };
  }

  resetProxy(proxyKey) {
    if (this.health[proxyKey]) {
      this.health[proxyKey] = {
        health: this.proxies[proxyKey]?.health || 50,
        lastUsed: 0,
        failures: 0,
        successes: 0,
        avgResponseTime: 0,
        totalRequests: 0,
        consecutiveFailures: 0,
        isBlocked: false
      };
    }
  }

  getProxyInfo(proxyKey) {
    if (!this.proxies[proxyKey]) return null;
    
    return {
      ...this.proxies[proxyKey],
      ...(this.health[proxyKey] || {})
    };
  }
}

// Export singleton instance
let proxyManager = null;

export const initializeProxyManager = (config) => {
  try {
    proxyManager = new ProxyManager(config);
    console.log('ProxyManager initialized successfully');
    return proxyManager;
  } catch (error) {
    console.error('Failed to initialize ProxyManager:', error);
    // Initialize with default config
    proxyManager = new ProxyManager({
      proxies: {
        auto: { name: 'Auto Select', icon: 'fas fa-magic', embed: null, health: 100 },
        noproxy: { name: 'Direct', icon: 'fas fa-globe', embed: 'https://www.youtube.com/embed/', health: 85 }
      },
      userAgents: ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'],
      settings: { maxRetries: 3, retryDelay: 2000 }
    });
    return proxyManager;
  }
};

export const getProxyManager = () => {
  if (!proxyManager) {
    console.warn('ProxyManager not initialized, initializing with defaults');
    return initializeProxyManager({});
  }
  return proxyManager;
};

// Safe convenience exports with null checks
export const selectOptimalProxy = (excludeProxies = []) => {
  try {
    const manager = getProxyManager();
    return manager.selectOptimalProxy(excludeProxies);
  } catch (error) {
    console.warn('Error selecting optimal proxy:', error);
    return 'noproxy';
  }
};

export const updateProxyHealth = (proxyKey, success, responseTime = 0) => {
  try {
    const manager = getProxyManager();
    return manager.updateHealth(proxyKey, success, responseTime);
  } catch (error) {
    console.warn('Error updating proxy health:', error);
  }
};

export const getHealthyProxies = () => {
  try {
    const manager = getProxyManager();
    return manager.getHealthyProxies();
  } catch (error) {
    console.warn('Error getting healthy proxies:', error);
    return [];
  }
};

export const optimizeAllProxies = () => {
  try {
    const manager = getProxyManager();
    return manager.optimizeAll();
  } catch (error) {
    console.warn('Error optimizing proxies:', error);
  }
};

export const getProxyAnalytics = () => {
  try {
    const manager = getProxyManager();
    return manager.getAnalytics();
  } catch (error) {
    console.warn('Error getting proxy analytics:', error);
    return {
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      successRate: 0,
      healthyProxies: 0,
      blockedProxies: 0
    };
  }
};

export const resetProxy = (proxyKey) => {
  try {
    const manager = getProxyManager();
    return manager.resetProxy(proxyKey);
  } catch (error) {
    console.warn('Error resetting proxy:', error);
  }
};

export const getProxyInfo = (proxyKey) => {
  try {
    const manager = getProxyManager();
    return manager.getProxyInfo(proxyKey);
  } catch (error) {
    console.warn('Error getting proxy info:', error);
    return null;
  }
};