是的，可以修改成 HTTPS 协议。以下是几种实现方式：

## 方案一：使用内置 HTTPS 模块（推荐用于生产环境）

```javascript
import express from 'express';
import https from 'https';
import fs from 'fs';
import { render } from '@antv/gpt-vis-ssr';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 443; // HTTPS 默认端口 443
const IMAGES_DIR = path.join(__dirname, 'images');

// HTTPS 配置
const SSL_CONFIG = {
  key: process.env.SSL_KEY_PATH ? fs.readFileSync(process.env.SSL_KEY_PATH) : null,
  cert: process.env.SSL_CERT_PATH ? fs.readFileSync(process.env.SSL_CERT_PATH) : null,
  ca: process.env.SSL_CA_PATH ? fs.readFileSync(process.env.SSL_CA_PATH) : null
};

// 本地存储配置 - 更新 baseUrl 为 HTTPS
const STORAGE_CONFIG = {
  baseUrl: process.env.BASE_URL || `https://localhost:${PORT}`,
  imagesDir: IMAGES_DIR,
  maxFileAge: process.env.MAX_FILE_AGE || 7 * 24 * 60 * 60 * 1000
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
  
  // 返回可访问的HTTPS URL
  const imageUrl = `${STORAGE_CONFIG.baseUrl}/images/${filename}`;
  
  console.log(`💾 图表保存到本地: ${filepath}`);
  console.log(`🔒 可访问HTTPS URL: ${imageUrl}`);
  
  return {
    url: imageUrl,
    localPath: filepath
  };
}

// ... 其他中间件和路由保持不变 ...

// 启动 HTTPS 服务器
async function startServer() {
  try {
    await ensureImagesDir();
    
    // 检查 SSL 证书
    if (!SSL_CONFIG.key || !SSL_CONFIG.cert) {
      console.error('❌ 缺少 SSL 证书文件');
      console.log('请设置以下环境变量:');
      console.log('SSL_KEY_PATH - SSL 私钥文件路径');
      console.log('SSL_CERT_PATH - SSL 证书文件路径');
      console.log('SSL_CA_PATH - CA 证书文件路径（可选）');
      process.exit(1);
    }
    
    const httpsOptions = {
      key: SSL_CONFIG.key,
      cert: SSL_CONFIG.cert
    };
    
    if (SSL_CONFIG.ca) {
      httpsOptions.ca = SSL_CONFIG.ca;
    }
    
    // 启动时清理旧文件（可选）
    if (process.env.CLEANUP_ON_START === 'true') {
      await cleanupOldFiles();
    }
    
    // 设置定时清理（可选）
    if (process.env.AUTO_CLEANUP === 'true') {
      setInterval(cleanupOldFiles, 24 * 60 * 60 * 1000);
    }
    
    https.createServer(httpsOptions, app).listen(PORT, () => {
      console.log(`🔒 GPT-Vis HTTPS 服务器运行在端口 ${PORT}`);
      console.log(`🌐 健康检查: https://localhost:${PORT}/health`);
      console.log(`📊 图表API: POST https://localhost:${PORT}/api/gpt-vis`);
      console.log(`📁 本地存储: ${STORAGE_CONFIG.imagesDir}`);
      console.log(`🖼️  图片访问地址: https://localhost:${PORT}/images/`);
      console.log(`📋 图片管理API: GET https://localhost:${PORT}/api/images`);
      
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

## 方案二：使用环境变量配置（更灵活）

创建 `.env` 文件：

```env
PORT=443
BASE_URL=https://yourdomain.com
SSL_KEY_PATH=/path/to/private.key
SSL_CERT_PATH=/path/to/certificate.crt
SSL_CA_PATH=/path/to/ca_bundle.crt
MAX_FILE_AGE=604800000
AUTO_CLEANUP=true
CLEANUP_ON_START=true
```

## 方案三：同时支持 HTTP 和 HTTPS

```javascript
import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';

// ... 其他导入保持不变 ...

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 80;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;

// 配置
const SSL_CONFIG = {
  key: process.env.SSL_KEY_PATH ? fs.readFileSync(process.env.SSL_KEY_PATH) : null,
  cert: process.env.SSL_CERT_PATH ? fs.readFileSync(process.env.SSL_CERT_PATH) : null
};

// 启动服务器函数
async function startServers() {
  try {
    await ensureImagesDir();
    
    // 启动 HTTP 服务器（可选，用于重定向）
    http.createServer(app).listen(HTTP_PORT, () => {
      console.log(`🌐 GPT-Vis HTTP 服务器运行在端口 ${HTTP_PORT}`);
    });
    
    // 启动 HTTPS 服务器
    if (SSL_CONFIG.key && SSL_CONFIG.cert) {
      const httpsOptions = {
        key: SSL_CONFIG.key,
        cert: SSL_CONFIG.cert
      };
      
      https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
        console.log(`🔒 GPT-Vis HTTPS 服务器运行在端口 ${HTTPS_PORT}`);
        console.log(`📊 主要API: https://localhost:${HTTPS_PORT}/api/gpt-vis`);
      });
    } else {
      console.warn('⚠️  SSL证书未配置，HTTPS服务器未启动');
    }
    
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServers();
```

## 方案四：使用反向代理（最推荐的生产环境方案）

使用 Nginx 作为反向代理：

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 静态文件缓存
    location /images/ {
        proxy_pass http://localhost:3000;
        expires 1h;
        add_header Cache-Control "public";
    }
}
```

## 获取 SSL 证书的几种方式：

### 1. 自签名证书（开发环境）
```bash
# 生成自签名证书
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

### 2. Let's Encrypt（免费，生产环境）
```bash
# 使用 certbot
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com
```

### 3. 云服务商证书
- AWS Certificate Manager
- 阿里云 SSL 证书
- 腾讯云 SSL 证书

## 部署说明：

1. **开发环境**：使用方案一 + 自签名证书
2. **生产环境**：使用方案四（Nginx反向代理） + Let's Encrypt证书
3. **容器化部署**：在 Docker 中使用方案二，通过负载均衡器处理 SSL

选择哪种方案取决于你的具体部署环境和需求。