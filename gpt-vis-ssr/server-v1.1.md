我将为您修改代码，移除 S3 存储依赖，完全使用本地存储。以下是调整后的代码：

```javascript
import express from 'express';
import { render } from '@antv/gpt-vis-ssr';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const IMAGES_DIR = path.join(__dirname, 'images');

// 本地存储配置
const STORAGE_CONFIG = {
  baseUrl: process.env.BASE_URL || `http://localhost:${PORT}`,
  imagesDir: IMAGES_DIR,
  maxFileAge: process.env.MAX_FILE_AGE || 7 * 24 * 60 * 60 * 1000 // 默认7天
};

// 确保图片目录存在
async function ensureImagesDir() {
  try {
    await fs.access(STORAGE_CONFIG.imagesDir);
  } catch {
    await fs.mkdir(STORAGE_CONFIG.imagesDir, { recursive: true });
    console.log(`📁 创建图片目录: ${STORAGE_CONFIG.imagesDir}`);
  }
}

// 保存文件到本地
async function saveToLocal(buffer, filename) {
  await ensureImagesDir();
  
  const filepath = path.join(STORAGE_CONFIG.imagesDir, filename);
  await fs.writeFile(filepath, buffer);
  
  // 返回可访问的URL
  const imageUrl = `${STORAGE_CONFIG.baseUrl}/images/${filename}`;
  
  console.log(`💾 图表保存到本地: ${filepath}`);
  console.log(`🌐 可访问URL: ${imageUrl}`);
  
  return {
    url: imageUrl,
    localPath: filepath
  };
}

// 清理旧文件（可选功能）
async function cleanupOldFiles() {
  try {
    const files = await fs.readdir(STORAGE_CONFIG.imagesDir);
    const now = Date.now();
    
    for (const file of files) {
      const filepath = path.join(STORAGE_CONFIG.imagesDir, file);
      const stats = await fs.stat(filepath);
      
      if (now - stats.mtimeMs > STORAGE_CONFIG.maxFileAge) {
        await fs.unlink(filepath);
        console.log(`🗑️  清理旧文件: ${file}`);
      }
    }
  } catch (error) {
    console.error('清理文件时出错:', error);
  }
}

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// 生成图表图片端点
app.post('/api/gpt-vis', async (req, res) => {
  try {
    const options = req.body;
    
    // 验证请求
    if (!options || typeof options !== 'object') {
      return res.status(400).json({
        success: false,
        errorMessage: '无效的选项参数'
      });
    }

    // 添加源标识符
    const chartOptions = {
      ...options,
      source: 'dify-plugin-visualization'
    };

    // 使用 gpt-vis-ssr 生成图表
    const vis = await render(chartOptions);
    const buffer = vis.toBuffer();

    // 生成唯一文件名
    const filename = `chart-${uuidv4()}.png`;
    
    // 保存到本地存储
    const { url: imageUrl, localPath } = await saveToLocal(buffer, filename);

    // 返回成功响应
    const response = {
      success: true,
      resultObj: imageUrl,
      message: '图表生成成功',
      storage: 'local',
      localPath: localPath,
      filename: filename
    };

    res.json(response);

  } catch (error) {
    console.error('图表生成错误:', error);
    
    res.status(500).json({
      success: false,
      errorMessage: error.message || '生成图表失败',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 提供图片静态访问
app.use('/images', express.static(STORAGE_CONFIG.imagesDir));

// 获取图片列表端点（可选，用于管理）
app.get('/api/images', async (req, res) => {
  try {
    await ensureImagesDir();
    const files = await fs.readdir(STORAGE_CONFIG.imagesDir);
    
    const imageList = await Promise.all(
      files.map(async (file) => {
        const filepath = path.join(STORAGE_CONFIG.imagesDir, file);
        const stats = await fs.stat(filepath);
        return {
          filename: file,
          url: `${STORAGE_CONFIG.baseUrl}/images/${file}`,
          size: stats.size,
          created: stats.mtime,
          path: filepath
        };
      })
    );
    
    res.json({
      success: true,
      count: imageList.length,
      images: imageList
    });
  } catch (error) {
    console.error('获取图片列表错误:', error);
    res.status(500).json({
      success: false,
      errorMessage: '获取图片列表失败'
    });
  }
});

// 删除图片端点（可选，用于管理）
app.delete('/api/images/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // 安全检查：确保文件名合法
    if (!filename || filename.includes('..') || !filename.startsWith('chart-')) {
      return res.status(400).json({
        success: false,
        errorMessage: '无效的文件名'
      });
    }
    
    const filepath = path.join(STORAGE_CONFIG.imagesDir, filename);
    
    // 检查文件是否存在
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({
        success: false,
        errorMessage: '文件不存在'
      });
    }
    
    await fs.unlink(filepath);
    
    res.json({
      success: true,
      message: '文件删除成功',
      filename: filename
    });
  } catch (error) {
    console.error('删除文件错误:', error);
    res.status(500).json({
      success: false,
      errorMessage: '删除文件失败'
    });
  }
});

// 健康检查端点
app.get('/health', async (_, res) => {
  try {
    await ensureImagesDir();
    const stats = await fs.stat(STORAGE_CONFIG.imagesDir);
    
    const healthInfo = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      storage: 'local',
      storageInfo: {
        imagesDir: STORAGE_CONFIG.imagesDir,
        baseUrl: STORAGE_CONFIG.baseUrl,
        writable: true,
        directoryCreated: stats.isDirectory()
      }
    };
    
    res.json(healthInfo);
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// 错误处理中间件
app.use((err, _, res, __) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    errorMessage: '内部服务器错误'
  });
});

// 404 处理器
app.use((_, res) => {
  res.status(404).json({
    success: false,
    errorMessage: '端点不存在'
  });
});

// 启动服务器
async function startServer() {
  try {
    await ensureImagesDir();
    
    // 启动时清理旧文件（可选）
    if (process.env.CLEANUP_ON_START === 'true') {
      await cleanupOldFiles();
    }
    
    // 设置定时清理（可选）
    if (process.env.AUTO_CLEANUP === 'true') {
      setInterval(cleanupOldFiles, 24 * 60 * 60 * 1000); // 每天清理一次
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 GPT-Vis SSR 服务器运行在端口 ${PORT}`);
      console.log(`🌐 健康检查: http://localhost:${PORT}/health`);
      console.log(`📊 图表API: POST http://localhost:${PORT}/api/gpt-vis`);
      console.log(`📁 本地存储: ${STORAGE_CONFIG.imagesDir}`);
      console.log(`🖼️  图片访问地址: http://localhost:${PORT}/images/`);
      console.log(`📋 图片管理API: GET http://localhost:${PORT}/api/images`);
      
      if (process.env.AUTO_CLEANUP === 'true') {
        console.log(`🧹 自动清理: 已启用 (${STORAGE_CONFIG.maxFileAge / (24 * 60 * 60 * 1000)}天)`);
      }
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
```

## 主要修改内容：

### 1. **移除 S3 相关代码**
- 删除了 `@aws-sdk/client-s3` 导入
- 移除了所有 S3 配置和上传逻辑
- 删除了 S3 客户端初始化代码

### 2. **简化存储配置**
- 使用简单的本地存储配置
- 图片保存在项目根目录的 `images` 文件夹中
- 通过静态文件服务提供图片访问

### 3. **增强本地存储功能**
- **文件管理 API**: 添加了获取图片列表和删除图片的端点
- **自动清理**: 可选的文件清理功能，防止磁盘空间被占满
- **更好的错误处理**: 针对本地文件操作的错误处理

### 4. **环境变量配置**
```bash
# 基础URL（如果使用反向代理时需要设置）
BASE_URL=http://your-domain.com

# 文件清理配置（可选）
MAX_FILE_AGE=604800000  # 文件最大保存时间（毫秒）
AUTO_CLEANUP=true       # 是否启用自动清理
CLEANUP_ON_START=true   # 启动时是否清理旧文件
```

### 5. **API 端点**
- `POST /api/gpt-vis` - 生成图表
- `GET /images/:filename` - 访问生成的图片
- `GET /api/images` - 获取图片列表（管理用）
- `DELETE /api/images/:filename` - 删除图片（管理用）
- `GET /health` - 健康检查

这样的设计让代码更简洁，完全依赖本地文件系统，同时提供了必要的文件管理功能。