/**
 * DNS 子域名服务 - 纯服务器版本
 * 处理 *.lovefreetools.site 和 *.violet27team.xyz 的请求
 */

const http = require('http');
const https = require('https');
const mysql = require('mysql2/promise');
const url = require('url');
require('dotenv').config();

const PORT = 8091;

// 数据库连接池
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'free_email',
    waitForConnections: true,
    connectionLimit: 10
});

// 支持的域名
const SUPPORTED_DOMAINS = ['lovefreetools.site', 'violet27team.xyz'];

// 解析主机名获取子域名和域名
function parseHost(host) {
    for (const domain of SUPPORTED_DOMAINS) {
        if (host.endsWith('.' + domain)) {
            const subdomain = host.slice(0, -(domain.length + 1));
            if (subdomain && !subdomain.includes('.')) {
                return { subdomain, domain };
            }
        }
    }
    return null;
}

// 查询 DNS 记录
async function getDnsRecord(subdomain, domain) {
    try {
        const [rows] = await pool.query(
            `SELECT record_type, record_value, ttl, priority 
             FROM dns_records 
             WHERE subdomain = ? AND domain = ? AND is_active = TRUE 
             ORDER BY priority ASC LIMIT 1`,
            [subdomain, domain]
        );
        return rows[0] || null;
    } catch (error) {
        console.error('Database error:', error);
        return null;
    }
}

// 代理请求到目标服务器
async function proxyRequest(req, res, targetHost, targetPath) {
    return new Promise((resolve) => {
        const options = {
            hostname: targetHost,
            port: 443,
            path: targetPath,
            method: req.method,
            headers: {
                'Host': targetHost,
                'User-Agent': req.headers['user-agent'] || 'FreeTools-DNS-Proxy/1.0',
                'Accept': req.headers['accept'] || '*/*',
                'Accept-Language': req.headers['accept-language'] || 'zh-CN,zh;q=0.9',
                'Connection': 'close'
            },
            timeout: 15000
        };

        const proxyReq = https.request(options, (proxyRes) => {
            // 复制响应头
            const headers = { ...proxyRes.headers };
            headers['X-Proxied-By'] = 'FreeTools-DNS';
            delete headers['content-encoding'];
            
            res.writeHead(proxyRes.statusCode, headers);
            proxyRes.pipe(res);
            resolve();
        });

        proxyReq.on('error', (err) => {
            console.error(`Proxy error to ${targetHost}: ${err.message}`);
            res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getErrorPage(targetHost, err.message));
            resolve();
        });

        proxyReq.on('timeout', () => {
            proxyReq.destroy();
            res.writeHead(504, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getErrorPage(targetHost, '连接超时'));
            resolve();
        });

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            req.pipe(proxyReq);
        } else {
            proxyReq.end();
        }
    });
}

// 错误页面
function getErrorPage(target, error) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>代理错误</title>
<style>body{font-family:system-ui;background:#0a0e17;color:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{text-align:center;padding:40px;max-width:500px}h1{color:#ef4444}code{color:#a78bfa;background:#1e293b;padding:2px 8px;border-radius:4px}</style>
</head><body><div class="box"><h1>无法连接目标服务器</h1><p>目标: <code>${target}</code></p><p>错误: ${error}</p>
<p><a href="https://free.violetteam.cloud" style="color:#00f5d4">返回公益平台</a></p></div></body></html>`;
}

// 子域名不存在页面
function getNotFoundPage(subdomain, domain) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>子域名不存在</title>
<style>body{font-family:system-ui;background:#0a0e17;color:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{text-align:center;padding:40px;max-width:500px}h1{color:#f59e0b}code{color:#00f5d4;font-size:1.2em}</style>
</head><body><div class="box"><h1>子域名不存在</h1><p><code>${subdomain}.${domain}</code></p><p>该子域名尚未注册或已过期</p>
<p><a href="https://free.violetteam.cloud" style="color:#00f5d4">申请免费子域名</a></p></div></body></html>`;
}

// DNS 信息页面
function getDnsInfoPage(subdomain, domain, record) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${subdomain}.${domain}</title>
<style>body{font-family:system-ui;background:#0a0e17;color:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{text-align:center;padding:40px;max-width:500px}h1{color:#00f5d4}
.record{background:#1e293b;padding:20px;border-radius:8px;margin:20px 0;text-align:left}
.label{color:#94a3b8}.value{color:#a78bfa;font-family:monospace}</style>
</head><body><div class="box"><h1>${subdomain}.${domain}</h1>
<div class="record"><p><span class="label">类型:</span> <span class="value">${record.record_type}</span></p>
<p><span class="label">值:</span> <span class="value">${record.record_value}</span></p>
<p><span class="label">TTL:</span> <span class="value">${record.ttl}s</span></p></div>
<p><a href="https://free.violetteam.cloud" style="color:#00f5d4">公益平台</a></p></div></body></html>`;
}

// 创建服务器
const server = http.createServer(async (req, res) => {
    const host = req.headers.host?.toLowerCase().split(':')[0];
    
    // 健康检查
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
        return;
    }
    
    // 解析子域名
    const parsed = parseHost(host);
    if (!parsed) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Invalid domain');
        return;
    }
    
    const { subdomain, domain } = parsed;
    console.log(`[DNS] ${subdomain}.${domain} - ${req.url}`);
    
    // 查询 DNS 记录
    const record = await getDnsRecord(subdomain, domain);
    
    if (!record) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getNotFoundPage(subdomain, domain));
        return;
    }
    
    // 根据记录类型处理
    switch (record.record_type) {
        case 'REDIRECT':
            // 301/302 重定向
            res.writeHead(302, { 'Location': record.record_value });
            res.end();
            break;
            
        case 'CNAME':
            // 反向代理
            const targetPath = req.url || '/';
            await proxyRequest(req, res, record.record_value, targetPath);
            break;
            
        case 'A':
        case 'AAAA':
        case 'TXT':
        case 'MX':
        default:
            // 显示 DNS 信息页面
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getDnsInfoPage(subdomain, domain, record));
            break;
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`DNS Server running on port ${PORT}`);
    console.log(`Supported domains: ${SUPPORTED_DOMAINS.join(', ')}`);
});

