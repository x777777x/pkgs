// simple-server.js - 最简版本
const express = require('express');
const gptVisSSR = require('@antv/gpt-vis-ssr');

const app = express();
app.use(express.json({ limit: '10mb' }));

// 直接使用包的导出
app.post('/api/render', async (req, res) => {
  try {
    const { spec, width = 800, height = 600, format = 'png' } = req.body;
    
    if (!spec) {
      return res.status(400).json({ error: 'Missing spec' });
    }

    let result;
    
    // 尝试不同的调用方式
    if (typeof gptVisSSR === 'function') {
      result = await gptVisSSR(spec, { width, height, format });
    } else if (gptVisSSR.render && typeof gptVisSSR.render === 'function') {
      result = await gptVisSSR.render(spec, { width, height, format });
    } else if (gptVisSSR.default && typeof gptVisSSR.default === 'function') {
      result = await gptVisSSR.default(spec, { width, height, format });
    } else {
      // 查找任何可用的渲染函数
      const renderFn = Object.values(gptVisSSR).find(fn => 
        typeof fn === 'function' && fn.length >= 1
      );
      
      if (renderFn) {
        result = await renderFn(spec, { width, height, format });
      } else {
        throw new Error('No render function found in @antv/gpt-vis-ssr');
      }
    }

    res.setHeader('Content-Type', `image/${format}`);
    res.send(result);
    
  } catch (error) {
    console.error('Render error:', error);
    res.status(500).json({ 
      error: 'Render failed', 
      message: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(7001, () => {
  console.log('Server running on port 7001');
});