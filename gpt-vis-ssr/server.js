const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { renderChart } = require('./renderer');
const config = require('./config');

const app = express();

// 中间件
app.use(helmet());
app.use(cors({
  origin: config.security.allowedOrigins
}));
app.use(express.json({ limit: '10mb' }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 每15分钟最多100次请求
});
app.use(limiter);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// 图表渲染端点 - 兼容 mcp-server-chart
app.post('/api/render', async (req, res) => {
  try {
    const { spec, width = 800, height = 600, format = 'png' } = req.body;
    
    if (!spec) {
      return res.status(400).json({
        error: 'Missing required parameter: spec'
      });
    }

    // 调用渲染器
    const result = await renderChart(spec, { width, height, format });
    
    // 根据格式返回不同的响应
    if (format === 'json') {
      res.json({
        success: true,
        data: result
      });
    } else {
      // 对于图片格式，返回二进制数据
      res.setHeader('Content-Type', `image/${format}`);
      res.send(result);
    }
    
  } catch (error) {
    console.error('Chart rendering error:', error);
    res.status(500).json({
      error: 'Failed to render chart',
      message: error.message
    });
  }
});

// 兼容旧的端点路径
app.post('/api/chart/render', async (req, res) => {
  // 重定向到新的端点
  req.url = '/api/render';
  app.handle(req, res);
});

// 启动服务
const server = app.listen(config.port, config.host, () => {
  console.log(`GPT-Vis-SSR server running on http://${config.host}:${config.port}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;