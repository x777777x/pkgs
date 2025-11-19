const { createRenderer } = require('@antv/gpt-vis-ssr');
const config = require('./config');

class ChartRenderer {
  constructor() {
    this.renderer = null;
    this.cache = new Map();
    this.init();
  }

  async init() {
    try {
      this.renderer = await createRenderer();
      console.log('Chart renderer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize chart renderer:', error);
      throw error;
    }
  }

  async render(spec, options = {}) {
    const cacheKey = this.generateCacheKey(spec, options);
    
    // 检查缓存
    if (config.chart.cache.enabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < config.chart.cache.ttl) {
        return cached.data;
      }
    }

    // 设置超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Render timeout')), config.chart.timeout);
    });

    try {
      const renderPromise = this.renderer.render(spec, options);
      const result = await Promise.race([renderPromise, timeoutPromise]);
      
      // 缓存结果
      if (config.chart.cache.enabled) {
        this.cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
        
        // 清理过期缓存
        this.cleanupCache();
      }
      
      return result;
    } catch (error) {
      throw new Error(`Rendering failed: ${error.message}`);
    }
  }

  generateCacheKey(spec, options) {
    return JSON.stringify({
      spec,
      width: options.width,
      height: options.height,
      format: options.format
    });
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > config.chart.cache.ttl) {
        this.cache.delete(key);
      }
    }
    
    // 如果缓存超过最大数量，删除最旧的
    if (this.cache.size > config.chart.cache.max) {
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.cache.delete(oldestKey);
    }
  }
}

// 创建单例实例
const renderer = new ChartRenderer();

module.exports = {
  renderChart: (spec, options) => renderer.render(spec, options)
};