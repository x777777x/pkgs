// server.js - 修复版本
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// 中间件配置
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

// 图表渲染器类
class ChartRenderer {
  constructor() {
    this.renderer = null;
    this.initialized = false;
  }

  async init() {
    try {
      // 尝试不同的导入方式
      const gptVisSSR = require('@antv/gpt-vis-ssr');
      
      // 方式1: 如果包导出的是类
      if (typeof gptVisSSR === 'function') {
        this.renderer = new gptVisSSR();
      } 
      // 方式2: 如果有默认导出
      else if (gptVisSSR.default) {
        this.renderer = new gptVisSSR.default();
      }
      // 方式3: 如果有createRenderer方法
      else if (typeof gptVisSSR.createRenderer === 'function') {
        this.renderer = await gptVisSSR.createRenderer();
      }
      // 方式4: 如果直接就是渲染器实例
      else if (gptVisSSR.render) {
        this.renderer = gptVisSSR;
      }
      else {
        // 尝试查找任何可用的渲染方法
        const renderMethod = Object.values(gptVisSSR).find(
          value => typeof value === 'function' && value.name.includes('render')
        );
        
        if (renderMethod) {
          this.renderer = { render: renderMethod };
        } else {
          throw new Error('No valid render method found in @antv/gpt-vis-ssr');
        }
      }
      
      this.initialized = true;
      console.log('Chart renderer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize chart renderer:', error);
      throw error;
    }
  }

  async render(spec, options = {}) {
    if (!this.initialized) {
      await this.init();
    }

    if (!this.renderer) {
      throw new Error('Renderer not available');
    }

    try {
      // 调用渲染方法
      const result = await this.renderer.render(spec, options);
      return result;
    } catch (error) {
      console.error('Rendering error:', error);
      throw new Error(`Chart rendering failed: ${error.message}`);
    }
  }
}

// 创建渲染器实例
const chartRenderer = new ChartRenderer();

// 图表渲染端点
app.post('/api/render', async (req, res) => {
  try {
    const { spec, width = 800, height = 600, format = 'png' } = req.body;
    
    if (!spec) {
      return res.status(400).json({
        error: 'Missing required parameter: spec'
      });
    }

    console.log('Received render request:', { 
      specType: typeof spec,
      width, 
      height, 
      format 
    });

    const result = await chartRenderer.render(spec, { width, height, format });
    
    if (format === 'json') {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.setHeader('Content-Type', `image/${format}`);
      res.send(result);
    }
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Failed to render chart',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 兼容性端点
app.post('/api/chart/render', async (req, res) => {
  req.url = '/api/render';
  app.handle(req, res);
});

// 启动服务
const PORT = process.env.PORT || 7001;
const HOST = process.env.HOST || '0.0.0.0';

// 初始化并启动服务
async function startServer() {
  try {
    // 预初始化渲染器
    await chartRenderer.init();
    
    app.listen(PORT, HOST, () => {
      console.log(`GPT-Vis-SSR server running on http://${HOST}:${PORT}`);
      console.log('Health check: http://' + HOST + ':' + PORT + '/health');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;