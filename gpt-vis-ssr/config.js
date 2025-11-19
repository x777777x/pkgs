module.exports = {
  port: process.env.PORT || 7001,
  host: process.env.HOST || '0.0.0.0',
  
  // 图表渲染配置
  chart: {
    // 渲染超时时间（毫秒）
    timeout: 30000,
    // 并发渲染数量
    concurrency: 5,
    // 缓存配置
    cache: {
      enabled: true,
      ttl: 3600000, // 1小时
      max: 1000 // 最大缓存图表数量
    }
  },
  
  // 安全配置
  security: {
    // API 密钥（可选）
    apiKey: process.env.API_KEY,
    // 允许的域名（CORS）
    allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*']
  },
  
  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json'
  }
};