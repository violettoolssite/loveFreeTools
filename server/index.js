/**
 * 公益平台 - MySQL API 后端
 * 替代 Cloudflare Workers KV，使用 MySQL 存储数据
 * 所有操作均无需管理员密钥
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { Resend } = require('resend');
const UAParser = require('ua-parser-js');

// 用户密钥哈希函数
const hashUserKey = (key) => {
    return crypto.createHash('sha256').update(key).digest('hex');
};

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== 数据库配置 ====================
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'free_email',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// Resend 配置
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// 测试数据库连接
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('MySQL 数据库连接成功');
        connection.release();
    } catch (error) {
        console.error('MySQL 数据库连接失败:', error.message);
        process.exit(1);
    }
}

// ==================== 中间件配置 ====================

// 信任代理（用于 Nginx 反向代理，只信任第一层代理）
app.set('trust proxy', 1);

// 安全头
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS 配置
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Admin-Key']
}));

// JSON 解析
app.use(express.json({ limit: '10mb' }));

// 请求日志（中国时间 UTC+8）
app.use((req, res, next) => {
    const now = new Date();
    const chinaTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
    const timeStr = chinaTime.toISOString().replace('T', ' ').replace('Z', ' +08:00');
    console.log(`${timeStr} ${req.method} ${req.path}`);
    next();
});

// 全局速率限制
const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: { success: false, error: '请求过于频繁，请稍后再试' },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true // 明确指定信任代理，配合 app.set('trust proxy', 1)
});
app.use(globalLimiter);

// ==================== 管理员验证中间件 ====================

const ADMIN_KEY = process.env.ADMIN_KEY || '';

function requireAdminKey(req, res, next) {
    const adminKey = req.headers['x-admin-key'];
    
    if (!ADMIN_KEY) {
        return res.status(503).json({ 
            success: false, 
            error: '管理员功能未配置，请设置 ADMIN_KEY 环境变量' 
        });
    }
    
    if (!adminKey) {
        return res.status(401).json({ 
            success: false, 
            error: '需要管理员密钥，请在请求头中添加 X-Admin-Key' 
        });
    }
    
    if (adminKey !== ADMIN_KEY) {
        return res.status(403).json({ 
            success: false, 
            error: '管理员密钥无效' 
        });
    }
    
    next();
}

// ==================== API 路由 ====================

// 根路径 - 返回 API 文档页面（通过 Worker 处理）
// 如果直接访问后端，返回 JSON 状态
app.get('/', (req, res) => {
    // 检查是否是 API 请求（有 Accept: application/json 头）
    const acceptJson = req.headers.accept && req.headers.accept.includes('application/json');
    
    if (acceptJson) {
        res.json({
            service: '公益平台 - 免费公益服务',
            status: 'running',
            backend: 'MySQL',
            features: ['临时邮箱', '域名管理', 'GitHub 代理', '文件加速'],
            endpoints: [
                'GET /api/domains',
                'POST /api/domains',
                'DELETE /api/domains/:name',
                'GET /api/emails/:email',
                'POST /api/emails',
                'DELETE /api/emails/:email/:id',
                'POST /api/send-email'
            ],
            note: '访问根路径可查看完整的 API 文档页面'
        });
    } else {
        // 返回 HTML 重定向提示（实际文档在 Worker 中）
        res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>公益平台 API</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0a0e17;
            color: #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        .container {
            text-align: center;
            max-width: 600px;
        }
        h1 { color: #00f5d4; margin-bottom: 20px; }
        p { color: #94a3b8; line-height: 1.8; margin: 15px 0; }
        .note {
            background: #111827;
            border: 1px solid #1e293b;
            border-radius: 8px;
            padding: 20px;
            margin-top: 30px;
        }
        code {
            background: #060912;
            padding: 2px 8px;
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
            color: #00f5d4;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>∞ 公益平台</h1>
        <p>这是 API 后端服务器。完整的 API 文档请访问前端 Worker 地址。</p>
        <div class="note">
            <p><strong>API 状态：</strong>运行中</p>
            <p><strong>后端：</strong>MySQL</p>
            <p><strong>功能：</strong>临时邮箱、域名管理、GitHub 代理、文件加速</p>
        </div>
        <p style="margin-top: 30px; font-size: 14px; color: #64748b;">
            访问前端域名可查看完整的 API 使用文档
        </p>
    </div>
</body>
</html>
        `);
    }
});

// ==================== 域名 API ====================

// 获取域名列表
app.get('/api/domains', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT name, api FROM domains ORDER BY id');
        res.json({ success: true, domains: rows });
    } catch (error) {
        console.error('获取域名失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 添加域名（无需验证）
app.post('/api/domains', async (req, res) => {
    const { name, api } = req.body;
    if (!name || !api) {
        return res.status(400).json({ success: false, error: '缺少 name 或 api 参数' });
    }

    try {
        await pool.query('INSERT INTO domains (name, api) VALUES (?, ?)', [name, api]);
        const [rows] = await pool.query('SELECT name, api FROM domains ORDER BY id');
        res.json({ success: true, domains: rows });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: '域名已存在' });
        }
        console.error('添加域名失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 删除域名（需要管理员密钥）
app.delete('/api/domains/:name', requireAdminKey, async (req, res) => {
    const domainName = decodeURIComponent(req.params.name);

    try {
        const [result] = await pool.query('DELETE FROM domains WHERE name = ?', [domainName]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: '域名不存在' });
        }
        const [rows] = await pool.query('SELECT name, api FROM domains ORDER BY id');
        res.json({ success: true, domains: rows });
    } catch (error) {
        console.error('删除域名失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== 邮件 API ====================

// 获取邮件列表
app.get('/api/emails/:email', async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const hideSpam = req.query.hideSpam === 'true';

    try {
        let query = `SELECT 
                id,
                email_from as \`from\`, 
                email_to as \`to\`, 
                subject, 
                text_content as text, 
                html_content as html, 
                received_at as date,
                verification_code as verificationCode,
                summary,
                is_spam as isSpam,
                detected_language as language
            FROM emails 
            WHERE email_to = ?`;
        
        // 可选：过滤垃圾邮件
        if (hideSpam) {
            query += ' AND (is_spam = FALSE OR is_spam IS NULL)';
        }
        
        query += ' ORDER BY received_at DESC LIMIT 50';
        
        const [rows] = await pool.query(query, [email]);

        res.json({
            email: email,
            emails: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('获取邮件失败:', error);
        res.status(500).json({ error: '获取邮件失败', message: error.message });
    }
});

// 接收邮件（供 Cloudflare Worker 调用）
app.post('/api/emails', async (req, res) => {
    const { 
        to, from, subject, text, html, raw,
        // AI 分析字段
        verificationCode, summary, isSpam, language 
    } = req.body;
    
    // 调试：打印接收到的 AI 字段
    console.log(`[DEBUG] POST /api/emails - AI fields: verificationCode=${verificationCode}, summary=${summary?.substring(0, 30)}, isSpam=${isSpam}, language=${language}`);

    if (!to || !from) {
        return res.status(400).json({ success: false, error: '缺少 to 或 from 参数' });
    }

    try {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await pool.query(
            `INSERT INTO emails (email_to, email_from, subject, text_content, html_content, raw_content, expires_at, 
             verification_code, summary, is_spam, detected_language) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                to, from, subject || '', text || '', html || '', raw || '', expiresAt,
                verificationCode || null, summary || null, isSpam || false, language || null
            ]
        );

        console.log(`邮件已存储: ${from} -> ${to}${verificationCode ? `, 验证码: ${verificationCode}` : ''}`);
        res.json({ success: true, message: '邮件已存储' });
    } catch (error) {
        console.error('存储邮件失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 删除邮件
app.delete('/api/emails/:email/:id', async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const id = req.params.id;

    try {
        // 先验证邮件是否属于该邮箱
        const [rows] = await pool.query(
            'SELECT id FROM emails WHERE id = ? AND email_to = ?',
            [id, email]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: '邮件不存在' });
        }

        // 删除邮件
        await pool.query('DELETE FROM emails WHERE id = ? AND email_to = ?', [id, email]);

        console.log(`邮件已删除: ${email} (ID: ${id})`);
        res.json({ success: true, message: '邮件已删除' });
    } catch (error) {
        console.error('删除邮件失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== 发送邮件 API ====================

// 发送邮件
app.post('/api/send-email', async (req, res) => {
    const { from, to, subject, text, html, replyTo } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!resend) {
        return res.status(503).json({ 
            success: false, 
            error: '邮件发送服务未配置，请设置 RESEND_API_KEY 环境变量' 
        });
    }

    if (!from || !to || !subject) {
        return res.status(400).json({ 
            success: false, 
            error: '缺少必要参数：from, to, subject' 
        });
    }

    // 验证发件人邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(from) || !emailRegex.test(to)) {
        return res.status(400).json({ 
            success: false, 
            error: '邮箱格式无效' 
        });
    }

    try {
        const { data, error } = await resend.emails.send({
            from: from,
            to: to,
            subject: subject,
            text: text || '',
            html: html || text || '',
            replyTo: replyTo || from
        });

        // 记录发送日志（无论成功失败都记录）
        const status = error ? 'failed' : 'success';
        const errorMsg = error ? (error.message || JSON.stringify(error)) : null;
        const resendId = data?.id || null;
        
        try {
            await pool.query(
                `INSERT INTO send_logs (email_from, email_to, subject, status, resend_id, error_message, client_ip, user_agent) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [from, to, subject, status, resendId, errorMsg, clientIp, userAgent]
            );
        } catch (logError) {
            console.error('记录发送日志失败:', logError);
        }

        if (error) {
            console.error('Resend 发送失败:', error);
            return res.status(500).json({ 
                success: false, 
                error: error.message || '邮件发送失败' 
            });
        }

        // 获取 IP 地理位置
        let location = null;
        try {
            const ipToQuery = clientIp.replace('::ffff:', ''); // 移除 IPv6 前缀
            const geoResponse = await fetch(`http://ip-api.com/json/${ipToQuery}?lang=zh-CN&fields=status,country,regionName,city`);
            const geoData = await geoResponse.json();
            if (geoData.status === 'success') {
                if (geoData.country === '中国' || geoData.country === 'China') {
                    location = `${geoData.regionName || ''}${geoData.city || ''}`;
                } else {
                    location = `${geoData.country || ''} ${geoData.city || ''}`.trim();
                }
            }
        } catch (geoError) {
            console.error('获取 IP 位置失败:', geoError.message);
        }

        // 解析详细设备信息
        let device = '未知设备';
        let deviceDetails = '';
        if (userAgent) {
            const parser = new UAParser(userAgent);
            const ua = parser.getResult();
            
            const deviceInfo = ua.device;
            const osInfo = ua.os;
            const browserInfo = ua.browser;
            
            // 构建设备信息
            const parts = [];
            
            // iPhone 型号映射表
            const iPhoneModels = {
                'iPhone14,7': 'iPhone 13 mini',
                'iPhone14,8': 'iPhone 13',
                'iPhone14,2': 'iPhone 13 Pro',
                'iPhone14,3': 'iPhone 13 Pro Max',
                'iPhone15,2': 'iPhone 14 Pro',
                'iPhone15,3': 'iPhone 14 Pro Max',
                'iPhone15,4': 'iPhone 14',
                'iPhone15,5': 'iPhone 14 Plus',
                'iPhone16,1': 'iPhone 15 Pro',
                'iPhone16,2': 'iPhone 15 Pro Max',
                'iPhone16,3': 'iPhone 15',
                'iPhone16,4': 'iPhone 15 Plus',
                'iPhone17,1': 'iPhone 16',
                'iPhone17,2': 'iPhone 16 Plus',
                'iPhone17,3': 'iPhone 16 Pro',
                'iPhone17,4': 'iPhone 16 Pro Max'
            };
            
            // 检查是否是 iPhone 并提取型号
            let deviceModel = '';
            if (userAgent.includes('iPhone')) {
                const modelMatch = userAgent.match(/iPhone(\d+,\d+)/);
                if (modelMatch && iPhoneModels[modelMatch[0]]) {
                    deviceModel = iPhoneModels[modelMatch[0]];
                } else if (modelMatch) {
                    deviceModel = `iPhone ${modelMatch[1].replace(',', '.')}`;
                } else {
                    deviceModel = 'iPhone';
                }
            } else if (userAgent.includes('Android')) {
                // Android 设备，尝试从 User-Agent 提取详细型号
                // 常见格式: Mozilla/5.0 (Linux; Android 13; iQOO Neo9 Build/...) ...
                // 或者: Mozilla/5.0 (Linux; Android 13; V2309A Build/TP1A.220624.014) ...
                
                // 方法1: 从 Android 版本后的设备信息中提取（在 Build 之前）
                // 匹配格式: Android X.X; 设备型号 Build/...
                const androidDeviceMatch = userAgent.match(/Android\s+[\d.]+[;)]\s*([^)]+?)\s+Build/i);
                if (androidDeviceMatch) {
                    let buildInfo = androidDeviceMatch[1].trim();
                    
                    // 清理常见的 Build 标识符和版本号
                    buildInfo = buildInfo
                        .replace(/\s*Build.*$/i, '')
                        .replace(/TP\d+\.\d+\.\d+\.\d+/, '')
                        .replace(/RKQ\d+\.\d+\.\d+/, '')
                        .replace(/V\d+[A-Z]\d*/, '')
                        .replace(/Kernel.*$/i, '')
                        .trim();
                    
                    // 如果提取到的信息看起来像设备型号（不是太短也不是太长，且包含字母）
                    if (buildInfo && buildInfo.length >= 3 && buildInfo.length <= 50 && /[a-zA-Z]/.test(buildInfo)) {
                        deviceModel = buildInfo;
                    }
                }
                
                // 方法2: 如果 ua-parser-js 提供了型号
                if (!deviceModel && deviceInfo.model) {
                    deviceModel = deviceInfo.model;
                }
                
                // 方法3: 尝试从 User-Agent 中直接匹配常见品牌和型号
                if (!deviceModel) {
                    // iQOO 设备（优先匹配，因为用户特别提到）
                    const iqooMatch = userAgent.match(/iQOO\s+([^\s)]+)/i);
                    if (iqooMatch) {
                        deviceModel = `iQOO ${iqooMatch[1]}`;
                    }
                    
                    // 其他常见品牌
                    if (!deviceModel) {
                        const brandPatterns = [
                            { brand: 'Xiaomi', pattern: /(?:Xiaomi|Redmi|POCO)\s+([^\s)]+)/i },
                            { brand: 'Huawei', pattern: /(?:HUAWEI|Honor)\s+([^\s)]+)/i },
                            { brand: 'OPPO', pattern: /OPPO\s+([^\s)]+)/i },
                            { brand: 'vivo', pattern: /vivo\s+([^\s)]+)/i },
                            { brand: 'OnePlus', pattern: /OnePlus\s+([^\s)]+)/i },
                            { brand: 'Samsung', pattern: /SM-[A-Z]\d+/i },
                            { brand: 'Realme', pattern: /RMX\d+/i }
                        ];
                        
                        for (const { brand, pattern } of brandPatterns) {
                            const match = userAgent.match(pattern);
                            if (match) {
                                if (brand === 'Samsung') {
                                    deviceModel = match[0];
                                } else {
                                    deviceModel = `${brand} ${match[1]}`;
                                }
                                break;
                            }
                        }
                    }
                }
                
                // 如果还是没有，使用通用 Android
                if (!deviceModel) {
                    deviceModel = 'Android';
                }
            } else if (deviceInfo.model) {
                deviceModel = deviceInfo.model;
            } else if (deviceInfo.type) {
                deviceModel = deviceInfo.type;
            }
            
            if (deviceModel) {
                parts.push(deviceModel);
            }
            
            // 操作系统和版本
            if (osInfo.name) {
                let osName = osInfo.name;
                if (osName === 'iOS' && !userAgent.includes('iPhone') && !userAgent.includes('iPad')) {
                    // 保持 iOS
                } else if (osName === 'iOS' && userAgent.includes('iPad')) {
                    osName = 'iPadOS';
                }
                if (osInfo.version) {
                    const osVersion = osInfo.version.split('.')[0] + '.' + osInfo.version.split('.')[1];
                    parts.push(`${osName} ${osVersion}`);
                } else {
                    parts.push(osName);
                }
            }
            
            // 浏览器信息
            if (browserInfo.name) {
                const browserName = browserInfo.name;
                if (browserInfo.version) {
                    const majorVersion = browserInfo.version.split('.')[0];
                    parts.push(`${browserName} ${majorVersion}`);
                } else {
                    parts.push(browserName);
                }
            }
            
            if (parts.length > 0) {
                device = parts.join(' ');
            } else {
                // 降级处理
                if (userAgent.includes('iPhone')) {
                    // 尝试提取 iPhone 型号
                    const iphoneMatch = userAgent.match(/iPhone(\d+,\d+)/);
                    if (iphoneMatch) {
                        device = `iPhone ${iphoneMatch[1].replace(',', '.')}`;
                    } else {
                        device = 'iPhone';
                    }
                } else if (userAgent.includes('iPad')) {
                    device = 'iPad';
                } else if (userAgent.includes('Android')) {
                    const androidMatch = userAgent.match(/Android\s+([\d.]+)/);
                    device = androidMatch ? `Android ${androidMatch[1]}` : 'Android';
                } else if (userAgent.includes('Windows')) {
                    device = 'Windows';
                } else if (userAgent.includes('Mac')) {
                    device = 'Mac';
                } else if (userAgent.includes('Linux')) {
                    device = 'Linux';
                }
            }
        }

        console.log(`邮件已发送: ${from} -> ${to}, ID: ${data?.id || 'unknown'}, IP: ${clientIp}, 位置: ${location || '未知'}, 设备: ${device}`);
        res.json({ 
            success: true, 
            message: '邮件发送成功',
            id: data?.id,
            clientIp: clientIp.replace('::ffff:', ''),
            location: location,
            device: device
        });
    } catch (error) {
        console.error('发送邮件失败:', error);
        
        // 记录失败日志
        try {
            await pool.query(
                `INSERT INTO send_logs (email_from, email_to, subject, status, error_message, client_ip, user_agent) 
                 VALUES (?, ?, ?, 'failed', ?, ?, ?)`,
                [from, to, subject, error.message, clientIp, userAgent]
            );
        } catch (logError) {
            console.error('记录发送日志失败:', logError);
        }
        
        res.status(500).json({ 
            success: false, 
            error: error.message || '邮件发送失败' 
        });
    }
});

// ==================== 短链接 API ====================

// 生成短码的字符集
const BASE62_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// 生成随机短码
function generateShortCode(length = 6) {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += BASE62_CHARS.charAt(Math.floor(Math.random() * BASE62_CHARS.length));
    }
    return code;
}

// 创建短链接
app.post('/api/links', async (req, res) => {
    const { url, title, customCode, expiresIn } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (!url) {
        return res.status(400).json({ success: false, error: '缺少 url 参数' });
    }

    // 验证 URL 格式
    try {
        new URL(url);
    } catch (e) {
        return res.status(400).json({ success: false, error: '无效的 URL 格式' });
    }

    try {
        let code = customCode;
        
        // 如果提供了自定义短码，验证格式
        if (customCode) {
            if (!/^[a-zA-Z0-9_-]{3,20}$/.test(customCode)) {
                return res.status(400).json({ 
                    success: false, 
                    error: '自定义短码只能包含字母、数字、下划线和连字符，长度 3-20 字符' 
                });
            }
            
            // 检查是否已存在
            const [existing] = await pool.query('SELECT id FROM short_links WHERE code = ?', [customCode]);
            if (existing.length > 0) {
                return res.status(409).json({ success: false, error: '该短码已被使用' });
            }
        } else {
            // 生成随机短码，确保唯一
            let attempts = 0;
            while (attempts < 10) {
                code = generateShortCode();
                const [existing] = await pool.query('SELECT id FROM short_links WHERE code = ?', [code]);
                if (existing.length === 0) break;
                attempts++;
            }
            if (attempts >= 10) {
                return res.status(500).json({ success: false, error: '无法生成唯一短码，请重试' });
            }
        }

        // 计算过期时间
        let expiresAt = null;
        if (expiresIn) {
            const hours = parseInt(expiresIn);
            if (hours > 0) {
                expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
            }
        }

        // 插入数据库
        await pool.query(
            `INSERT INTO short_links (code, original_url, title, expires_at, client_ip) VALUES (?, ?, ?, ?, ?)`,
            [code, url, title || '', expiresAt, clientIp]
        );

        console.log(`短链接已创建: ${code} -> ${url.substring(0, 50)}...`);
        res.json({ 
            success: true, 
            code: code,
            shortUrl: `${req.protocol}://${req.get('host')}/s/${code}`,
            originalUrl: url,
            expiresAt: expiresAt
        });
    } catch (error) {
        console.error('创建短链接失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取短链接信息（用于跳转）
app.get('/api/links/:code', async (req, res) => {
    const { code } = req.params;

    try {
        const [rows] = await pool.query(
            'SELECT id, code, original_url, title, clicks, created_at, expires_at FROM short_links WHERE code = ?',
            [code]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: '短链接不存在' });
        }

        const link = rows[0];

        // 检查是否过期
        if (link.expires_at && new Date(link.expires_at) < new Date()) {
            return res.status(410).json({ success: false, error: '短链接已过期' });
        }

        res.json({ 
            success: true, 
            link: {
                code: link.code,
                originalUrl: link.original_url,
                title: link.title,
                clicks: link.clicks,
                createdAt: link.created_at,
                expiresAt: link.expires_at
            }
        });
    } catch (error) {
        console.error('获取短链接失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 访问短链接（增加点击次数并返回原始 URL）
app.get('/api/links/:code/redirect', async (req, res) => {
    const { code } = req.params;

    try {
        const [rows] = await pool.query(
            'SELECT id, original_url, expires_at FROM short_links WHERE code = ?',
            [code]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: '短链接不存在' });
        }

        const link = rows[0];

        // 检查是否过期
        if (link.expires_at && new Date(link.expires_at) < new Date()) {
            return res.status(410).json({ success: false, error: '短链接已过期' });
        }

        // 增加点击次数
        await pool.query('UPDATE short_links SET clicks = clicks + 1 WHERE id = ?', [link.id]);

        res.json({ 
            success: true, 
            url: link.original_url
        });
    } catch (error) {
        console.error('访问短链接失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取短链接统计
app.get('/api/links/:code/stats', async (req, res) => {
    const { code } = req.params;

    try {
        const [rows] = await pool.query(
            'SELECT code, original_url, title, clicks, created_at, expires_at FROM short_links WHERE code = ?',
            [code]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: '短链接不存在' });
        }

        const link = rows[0];
        res.json({ 
            success: true, 
            stats: {
                code: link.code,
                originalUrl: link.original_url,
                title: link.title,
                clicks: link.clicks,
                createdAt: link.created_at,
                expiresAt: link.expires_at,
                isExpired: link.expires_at ? new Date(link.expires_at) < new Date() : false
            }
        });
    } catch (error) {
        console.error('获取短链接统计失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== DNS 记录 API ====================

const VALID_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'REDIRECT'];

// 验证 DNS 记录值
function validateDnsValue(type, value) {
    switch (type) {
        case 'A':
            // IPv4 地址
            return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) && 
                   value.split('.').every(n => parseInt(n) <= 255);
        case 'AAAA':
            // IPv6 地址（简化验证）
            return /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(value) ||
                   /^([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/.test(value);
        case 'CNAME':
        case 'NS':
            // 域名格式
            return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.?$/i.test(value);
        case 'MX':
            // 邮件服务器域名
            return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.?$/i.test(value);
        case 'TXT':
            // 任意文本，长度限制
            return value.length <= 1024;
        case 'REDIRECT':
            // URL 格式
            try { new URL(value); return true; } catch { return false; }
        case 'SRV':
            // SRV 格式: priority weight port target
            return /^\d+\s+\d+\s+\d+\s+[a-z0-9.-]+$/i.test(value);
        case 'CAA':
            // CAA 格式: flags tag value
            return /^\d+\s+(issue|issuewild|iodef)\s+.+$/i.test(value);
        default:
            return false;
    }
}

// 检查子域名是否可用
app.get('/api/dns/check/:subdomain', async (req, res) => {
    const { subdomain } = req.params;
    const { domain = 'lovefreetools.site' } = req.query;
    const subdomainLower = subdomain.toLowerCase().trim();
    
    // @ 表示根域名
    if (subdomainLower !== '@') {
        if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(subdomainLower)) {
            return res.json({ 
                success: true, 
                available: false, 
                reason: '子域名格式无效，只能包含字母、数字和连字符' 
            });
        }
        
        if (subdomainLower.length < 2) {
            return res.json({ 
                success: true, 
                available: false, 
                reason: '子域名至少需要 2 个字符' 
            });
        }
    }
    
    try {
        // 检查是否为保留子域名
        const [reserved] = await pool.query(
            'SELECT subdomain FROM reserved_subdomains WHERE subdomain = ?',
            [subdomainLower]
        );
        
        if (reserved.length > 0) {
            return res.json({ 
                success: true, 
                available: false, 
                reason: '该子域名为系统保留' 
            });
        }
        
        // 检查是否已有记录（按域名区分）
        const [existing] = await pool.query(
            'SELECT subdomain FROM dns_records WHERE subdomain = ? AND domain = ? LIMIT 1',
            [subdomainLower, domain]
        );
        
        res.json({ 
            success: true, 
            available: existing.length === 0,
            reason: existing.length > 0 ? '该子域名已有 DNS 记录' : null
        });
    } catch (error) {
        console.error('检查子域名失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取子域名的所有 DNS 记录
app.get('/api/dns/:subdomain', async (req, res) => {
    const { subdomain } = req.params;
    
    try {
        const [rows] = await pool.query(
            `SELECT id, subdomain, record_type, record_value, ttl, priority, proxied, created_at, is_active 
             FROM dns_records WHERE subdomain = ? AND is_active = TRUE ORDER BY record_type, priority`,
            [subdomain.toLowerCase()]
        );
        
        res.json({
            success: true,
            subdomain: subdomain.toLowerCase(),
            fullDomain: subdomain === '@' ? 'yljdteam.com' : `${subdomain.toLowerCase()}.yljdteam.com`,
            records: rows.map(r => ({
                id: r.id,
                type: r.record_type,
                value: r.record_value,
                ttl: r.ttl,
                priority: r.priority,
                proxied: r.proxied,
                createdAt: r.created_at
            })),
            count: rows.length
        });
    } catch (error) {
        console.error('获取 DNS 记录失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 创建 DNS 记录
app.post('/api/dns', async (req, res) => {
    const { subdomain, domain = 'lovefreetools.site', type, value, ttl = 3600, priority = 0, ownerEmail, proxied = true, userKey } = req.body;
    
    // 验证用户管理密钥
    if (!userKey || userKey.length < 6) {
        return res.status(400).json({ success: false, error: '请输入至少6位的管理密钥' });
    }
    
    // 验证域名
    const allowedDomains = ['lovefreetools.site', 'violet27team.xyz'];
    if (!allowedDomains.includes(domain)) {
        return res.status(400).json({ success: false, error: '不支持的域名' });
    }
    
    if (!subdomain || !type || !value) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    const subdomainLower = subdomain.toLowerCase().trim();
    const typeUpper = type.toUpperCase();
    
    // 验证记录类型
    if (!VALID_RECORD_TYPES.includes(typeUpper)) {
        return res.status(400).json({ 
            success: false, 
            error: `不支持的记录类型，支持: ${VALID_RECORD_TYPES.join(', ')}` 
        });
    }
    
    // 验证子域名格式（@ 表示根域名）
    if (subdomainLower !== '@' && !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(subdomainLower)) {
        return res.status(400).json({ 
            success: false, 
            error: '子域名格式无效' 
        });
    }
    
    // 验证记录值
    if (!validateDnsValue(typeUpper, value)) {
        return res.status(400).json({ 
            success: false, 
            error: `${typeUpper} 记录值格式无效` 
        });
    }
    
    // 验证 TTL
    if (ttl < 60 || ttl > 86400) {
        return res.status(400).json({ 
            success: false, 
            error: 'TTL 必须在 60-86400 秒之间' 
        });
    }
    
    try {
        // 检查是否为保留子域名
        const [reserved] = await pool.query(
            'SELECT subdomain FROM reserved_subdomains WHERE subdomain = ?',
            [subdomainLower]
        );
        
        if (reserved.length > 0) {
            return res.status(400).json({ success: false, error: '该子域名为系统保留' });
        }
        
        // CNAME 记录不能与其他记录共存
        if (typeUpper === 'CNAME') {
            const [existing] = await pool.query(
                'SELECT id FROM dns_records WHERE subdomain = ? AND record_type != "CNAME"',
                [subdomainLower]
            );
            if (existing.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'CNAME 记录不能与其他记录类型共存' 
                });
            }
        } else {
            const [existingCname] = await pool.query(
                'SELECT id FROM dns_records WHERE subdomain = ? AND record_type = "CNAME"',
                [subdomainLower]
            );
            if (existingCname.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: '该子域名已有 CNAME 记录，不能添加其他类型' 
                });
            }
        }
        
        const fullDomain = subdomainLower === '@' ? domain : `${subdomainLower}.${domain}`;
        let cfRecordId = null;
        
        // 对于 A, AAAA, CNAME 记录，同时在 Cloudflare 创建真实 DNS 记录
        const cfSupportedTypes = ['A', 'AAAA', 'CNAME', 'TXT', 'MX'];
        // TXT 和 MX 记录不能开启代理
        const canProxy = ['A', 'AAAA', 'CNAME'].includes(typeUpper);
        const shouldProxy = canProxy && proxied;
        
        if (cfSupportedTypes.includes(typeUpper) && process.env.CF_DNS_API_TOKEN) {
            try {
                const cfDns = require('./cloudflare-dns');
                const cfRecord = await cfDns.createDnsRecord(
                    domain, 
                    subdomainLower, 
                    typeUpper, 
                    value, 
                    shouldProxy ? 1 : ttl, // 代理模式下 TTL 自动设为 Auto (1)
                    shouldProxy // 根据用户选择决定是否开启代理
                );
                cfRecordId = cfRecord.id;
                console.log(`Cloudflare DNS 记录已创建: ${cfRecord.name} -> ${value} (ID: ${cfRecordId}, Proxied: ${shouldProxy})`);
            } catch (cfError) {
                console.error('Cloudflare DNS 创建失败:', cfError.message);
                // 如果 Cloudflare 创建失败，仍然继续在数据库创建记录（作为备份）
            }
        }
        
        // 创建数据库记录（包含用户密钥哈希）
        const userKeyHash = hashUserKey(userKey);
        const [result] = await pool.query(
            `INSERT INTO dns_records (subdomain, domain, record_type, record_value, ttl, priority, owner_email, user_key_hash, cf_record_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [subdomainLower, domain, typeUpper, value, ttl, priority, ownerEmail || null, userKeyHash, cfRecordId]
        );
        
        console.log(`DNS 记录已创建: ${typeUpper} ${fullDomain} -> ${value}`);
        
        res.json({
            success: true,
            record: {
                id: result.insertId,
                subdomain: subdomainLower,
                fullDomain,
                type: typeUpper,
                value,
                ttl,
                priority,
                cfRecordId,
                realDns: !!cfRecordId
            }
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: '该 DNS 记录已存在' });
        }
        console.error('创建 DNS 记录失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 用户删除 DNS 记录（需验证用户密钥）
app.delete('/api/dns/user/:id', async (req, res) => {
    const { id } = req.params;
    const { userKey } = req.body;
    
    if (!userKey) {
        return res.status(400).json({ success: false, error: '请提供管理密钥' });
    }
    
    try {
        // 获取记录并验证密钥
        const [records] = await pool.query('SELECT * FROM dns_records WHERE id = ?', [id]);
        
        if (records.length === 0) {
            return res.status(404).json({ success: false, error: '记录不存在' });
        }
        
        const record = records[0];
        const userKeyHash = hashUserKey(userKey);
        
        if (record.user_key_hash !== userKeyHash) {
            return res.status(403).json({ success: false, error: '管理密钥错误' });
        }
        
        // 如果有 Cloudflare 记录，先删除
        if (record.cf_record_id && process.env.CF_DNS_API_TOKEN) {
            try {
                const cfDns = require('./cloudflare-dns');
                await cfDns.deleteDnsRecord(record.domain, record.cf_record_id);
                console.log(`Cloudflare DNS 记录已删除: ${record.cf_record_id}`);
            } catch (cfError) {
                console.error('Cloudflare DNS 删除失败:', cfError.message);
            }
        }
        
        // 删除数据库记录
        await pool.query('DELETE FROM dns_records WHERE id = ?', [id]);
        
        console.log(`DNS 记录已删除: ID ${id}`);
        res.json({ success: true, message: '记录已删除' });
    } catch (error) {
        console.error('删除 DNS 记录失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 更新 DNS 记录
app.put('/api/dns/:id', async (req, res) => {
    const { id } = req.params;
    const { value, ttl, priority, proxied } = req.body;
    
    try {
        // 获取现有记录
        const [existing] = await pool.query('SELECT * FROM dns_records WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: '记录不存在' });
        }
        
        const record = existing[0];
        const newValue = value || record.record_value;
        
        // 验证新值
        if (value && !validateDnsValue(record.record_type, value)) {
            return res.status(400).json({ 
                success: false, 
                error: `${record.record_type} 记录值格式无效` 
            });
        }
        
        await pool.query(
            `UPDATE dns_records SET 
                record_value = ?, 
                ttl = ?, 
                priority = ?, 
                proxied = ?,
                updated_at = NOW()
             WHERE id = ?`,
            [newValue, ttl || record.ttl, priority ?? record.priority, proxied ?? record.proxied, id]
        );
        
        res.json({ success: true, message: '记录已更新' });
    } catch (error) {
        console.error('更新 DNS 记录失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 删除 DNS 记录
app.delete('/api/dns/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        // 先获取记录信息（包含 Cloudflare 记录 ID）
        const [records] = await pool.query(
            'SELECT domain, cf_record_id FROM dns_records WHERE id = ?', 
            [id]
        );
        
        if (records.length === 0) {
            return res.status(404).json({ success: false, error: '记录不存在' });
        }
        
        const record = records[0];
        
        // 如果有 Cloudflare 记录，先删除
        if (record.cf_record_id && process.env.CF_DNS_API_TOKEN) {
            try {
                const cfDns = require('./cloudflare-dns');
                await cfDns.deleteDnsRecord(record.domain, record.cf_record_id);
                console.log(`Cloudflare DNS 记录已删除: ${record.cf_record_id}`);
            } catch (cfError) {
                console.error('Cloudflare DNS 删除失败:', cfError.message);
                // 继续删除数据库记录
            }
        }
        
        // 删除数据库记录
        await pool.query('DELETE FROM dns_records WHERE id = ?', [id]);
        
        res.json({ success: true, message: '记录已删除' });
    } catch (error) {
        console.error('删除 DNS 记录失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取所有 DNS 记录（公开，值部分隐藏）
app.get('/api/dns/public/list', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, subdomain, domain, record_type, record_value, ttl, created_at,
                    CASE WHEN cf_record_id IS NOT NULL THEN TRUE ELSE FALSE END as real_dns
             FROM dns_records 
             WHERE is_active = TRUE 
             ORDER BY created_at DESC 
             LIMIT 100`
        );
        
        // 隐藏部分值
        const maskValue = (value, type) => {
            if (!value) return '***';
            if (type === 'TXT') {
                // TXT 记录显示前10个字符
                return value.length > 10 ? value.substring(0, 10) + '...' : value;
            }
            if (type === 'A' || type === 'AAAA') {
                // IP 地址隐藏中间部分
                const parts = value.split('.');
                if (parts.length === 4) {
                    return `${parts[0]}.***.***.${parts[3]}`;
                }
                return value.substring(0, 4) + '***';
            }
            if (type === 'CNAME' || type === 'REDIRECT') {
                // 域名隐藏中间部分
                if (value.length > 15) {
                    return value.substring(0, 6) + '***' + value.substring(value.length - 6);
                }
                return value.substring(0, 3) + '***';
            }
            return value.length > 8 ? value.substring(0, 4) + '***' : '***';
        };
        
        const records = rows.map(row => ({
            id: row.id,
            subdomain: row.subdomain,
            domain: row.domain,
            fullDomain: row.subdomain === '@' ? row.domain : `${row.subdomain}.${row.domain}`,
            type: row.record_type,
            value: maskValue(row.record_value, row.record_type),
            ttl: row.ttl,
            realDns: row.real_dns,
            createdAt: row.created_at
        }));
        
        res.json({ success: true, records, total: records.length });
    } catch (error) {
        console.error('获取 DNS 记录列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DNS 解析查询（Worker 调用）
app.get('/api/dns/:subdomain/resolve', async (req, res) => {
    const { subdomain } = req.params;
    const { type, domain } = req.query;
    
    try {
        let query = 'SELECT * FROM dns_records WHERE subdomain = ? AND is_active = TRUE';
        const params = [subdomain.toLowerCase()];
        
        if (domain) {
            query += ' AND domain = ?';
            params.push(domain);
        }
        
        if (type) {
            query += ' AND record_type = ?';
            params.push(type.toUpperCase());
        }
        
        query += ' ORDER BY priority ASC';
        
        const [rows] = await pool.query(query, params);
        
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: '无 DNS 记录' });
        }
        
        res.json({
            success: true,
            records: rows.map(r => ({
                type: r.record_type,
                value: r.record_value,
                ttl: r.ttl,
                priority: r.priority,
                proxied: r.proxied
            }))
        });
    } catch (error) {
        console.error('DNS 解析失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== 清理任务 ====================

async function cleanupExpiredData() {
    try {
        // 清理过期邮件
        const [emailResult] = await pool.query(
            'DELETE FROM emails WHERE received_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)'
        );
        if (emailResult.affectedRows > 0) {
            console.log(`已清理 ${emailResult.affectedRows} 封过期邮件`);
        }
        
        // 清理过期短链接
        const [linkResult] = await pool.query(
            'DELETE FROM short_links WHERE expires_at IS NOT NULL AND expires_at < NOW()'
        );
        if (linkResult.affectedRows > 0) {
            console.log(`已清理 ${linkResult.affectedRows} 个过期短链接`);
        }
        
        // 清理过期子域名
        const [subdomainResult] = await pool.query(
            'DELETE FROM subdomains WHERE expires_at IS NOT NULL AND expires_at < NOW()'
        );
        if (subdomainResult.affectedRows > 0) {
            console.log(`已清理 ${subdomainResult.affectedRows} 个过期子域名`);
        }
    } catch (error) {
        console.error('清理过期数据失败:', error);
    }
}

setInterval(cleanupExpiredData, 60 * 60 * 1000);

// ==================== 错误处理 ====================

app.use((req, res) => {
    res.status(404).json({ success: false, error: '接口不存在' });
});

app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
});

// ==================== 启动服务器 ====================

async function start() {
    await testConnection();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`
╔════════════════════════════════════════════════════════╗
║           公益平台 - MySQL API 后端                     ║
╠════════════════════════════════════════════════════════╣
║  服务已启动: http://0.0.0.0:${PORT.toString().padEnd(24, ' ')}║
║  数据库: ${(dbConfig.host + ':' + dbConfig.port).padEnd(34, ' ')}║
║  数据库名: ${dbConfig.database.padEnd(32, ' ')}║
╚════════════════════════════════════════════════════════╝
        `);
    });
}

start().catch(console.error);
