/**
 * CNAME 代理服务
 * 用于将子域名请求代理到目标网站
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 8090;

const server = http.createServer(async (req, res) => {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    // 处理 OPTIONS 请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 健康检查
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
        return;
    }
    
    // 解析请求
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname !== '/proxy') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
    }
    
    const target = parsedUrl.query.target;
    const targetPath = parsedUrl.query.path || '/';
    
    if (!target) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing target parameter');
        return;
    }
    
    console.log(`[CNAME Proxy] ${target}${targetPath}`);
    
    try {
        // 构建目标 URL
        const targetUrl = new URL(targetPath, `https://${target}`);
        
        // 发起代理请求
        const proxyReq = https.request({
            hostname: targetUrl.hostname,
            port: 443,
            path: targetUrl.pathname + targetUrl.search,
            method: req.method,
            headers: {
                'Host': target,
                'User-Agent': req.headers['user-agent'] || 'FreeTools-CNAME-Proxy/1.0',
                'Accept': req.headers['accept'] || '*/*',
                'Accept-Encoding': 'identity', // 不压缩，方便转发
                'Connection': 'close'
            },
            timeout: 15000
        }, (proxyRes) => {
            // 转发响应头
            const headers = { ...proxyRes.headers };
            headers['X-Proxied-By'] = 'FreeTools-CNAME-Proxy';
            delete headers['content-encoding']; // 移除压缩头
            
            res.writeHead(proxyRes.statusCode, headers);
            proxyRes.pipe(res);
        });
        
        proxyReq.on('error', (err) => {
            console.error(`[CNAME Proxy Error] ${target}: ${err.message}`);
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end(`Proxy Error: ${err.message}`);
        });
        
        proxyReq.on('timeout', () => {
            proxyReq.destroy();
            res.writeHead(504, { 'Content-Type': 'text/plain' });
            res.end('Gateway Timeout');
        });
        
        // 如果有请求体，转发它
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            req.pipe(proxyReq);
        } else {
            proxyReq.end();
        }
        
    } catch (err) {
        console.error(`[CNAME Proxy Error] ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error: ${err.message}`);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`CNAME Proxy Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Proxy: http://localhost:${PORT}/proxy?target=example.com&path=/`);
});

