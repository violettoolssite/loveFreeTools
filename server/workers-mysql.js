/**
 * Cloudflare Email Worker - MySQL 版本
 * 
 * 与原 KV 版本功能完全一致，只是存储改为 MySQL API 后端
 * 
 * 部署说明：
 * 1. 在 Cloudflare Workers 中创建新 Worker
 * 2. 复制此代码到 Worker
 * 3. 设置环境变量：
 *    - API_BASE: MySQL API 后端地址 (如 http://35.220.142.223:3001)
 *    - ADMIN_KEY: 管理员密钥（可选）
 * 4. 在域名设置中启用 Email Routing
 * 5. 添加 Catch-all 规则，将所有邮件发送到此 Worker
 * 
 * 注意：不再需要绑定 KV 命名空间
 */

// API 后端地址（需要在 Worker 环境变量中设置）
const getApiBase = (env) => {
  if (env && env.API_BASE) return env.API_BASE;
  if (typeof API_BASE !== 'undefined') return API_BASE;
  return 'http://35.220.142.223:3001'; // 默认值
};

// 获取管理员密钥
const getAdminKey = (env) => {
  if (env && env.ADMIN_KEY) return env.ADMIN_KEY;
  if (typeof ADMIN_KEY !== 'undefined') return ADMIN_KEY;
  return '';
};

// ==================== AI 服务模块 ====================
// 使用 Cloudflare Workers AI 提供智能分析功能
// 需要在 Cloudflare Dashboard 中启用 Workers AI

const AIService = {
  // AI 模型配置
  MODEL: '@cf/meta/llama-3-8b-instruct',
  
  // AI 功能开关（可通过环境变量控制）
  isEnabled: () => {
    if (typeof AI_ENABLED !== 'undefined') return AI_ENABLED === 'true';
    return true; // 默认启用
  },
  
  // ModelScope 备用 API 配置
  MODELSCOPE_API: 'https://api-inference.modelscope.cn/v1/chat/completions',
  MODELSCOPE_MODEL: 'deepseek-ai/DeepSeek-V3.2',
  
  /**
   * 调用 ModelScope API（备用）
   * @param {object} env - Worker 环境对象
   * @param {string} prompt - 提示词
   * @returns {Promise<string>} AI 响应
   */
  async callModelScope(env, prompt) {
    const apiKey = env.MODELSCOPE_KEY || 'ms-7c9a95a1-bbfe-4011-8eba-11162b1dd120';
    
    try {
      const response = await fetch(this.MODELSCOPE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.MODELSCOPE_MODEL,
          messages: [
            { role: 'system', content: '你是一个专业的邮件分析助手。请根据要求简洁准确地回答，只输出结果，不要解释。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 500,
          stream: false
        })
      });
      
      if (!response.ok) {
        console.error('ModelScope API error:', response.status);
        return null;
      }
      
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('ModelScope call failed:', error);
      return null;
    }
  },
  
  /**
   * 调用 AI 模型（优先 Cloudflare，失败后切换 ModelScope）
   * @param {object} env - Worker 环境对象
   * @param {string} prompt - 提示词
   * @returns {Promise<string>} AI 响应
   */
  async callAI(env, prompt) {
    // 优先使用 Cloudflare Workers AI
    if (env.AI) {
      try {
        const response = await env.AI.run(this.MODEL, {
          messages: [
            { role: 'system', content: '你是一个专业的邮件分析助手。请根据要求简洁准确地回答，只输出结果，不要解释。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 500
        });
        if (response.response) {
          return response.response;
        }
      } catch (error) {
        console.error('Cloudflare AI failed, switching to ModelScope:', error.message);
      }
    }
    
    // 备用：使用 ModelScope API
    console.log('Using ModelScope API as fallback');
    return await this.callModelScope(env, prompt);
  },
  
  /**
   * 从邮件中提取验证码
   * @param {object} env - Worker 环境对象
   * @param {string} text - 邮件文本内容
   * @param {string} subject - 邮件主题
   * @returns {Promise<string|null>} 验证码
   */
  async extractVerificationCode(env, text, subject) {
    if (!this.isEnabled()) return null;
    
    const content = `${subject}\n${text}`.substring(0, 2000);
    const prompt = `从以下邮件内容中提取验证码。验证码通常是4-8位的数字或字母数字组合。
如果找到验证码，只输出验证码本身（如：123456 或 ABC123）。
如果没有找到验证码，输出：无

邮件内容：
${content}`;
    
    const result = await this.callAI(env, prompt);
    if (!result || result.includes('无') || result.length > 10) {
      return null;
    }
    // 清理结果，只保留有效字符
    const code = result.trim().replace(/[^a-zA-Z0-9]/g, '');
    return code.length >= 4 && code.length <= 8 ? code : null;
  },
  
  /**
   * 生成邮件摘要
   * @param {object} env - Worker 环境对象
   * @param {string} text - 邮件文本内容
   * @param {string} subject - 邮件主题
   * @returns {Promise<string|null>} 摘要
   */
  async generateSummary(env, text, subject) {
    if (!this.isEnabled()) return null;
    
    const content = `${subject}\n${text}`.substring(0, 3000);
    const prompt = `用中英双语各一句话概括以下邮件内容。
格式：中文内容 | English content
不要加任何前缀标签，直接输出内容，用|分隔。每种语言不超过30字。

${content}`;
    
    const result = await this.callAI(env, prompt);
    if (!result) return null;
    return result.trim().substring(0, 150);
  },
  
  /**
   * 检测是否为垃圾邮件
   * @param {object} env - Worker 环境对象
   * @param {string} text - 邮件文本内容
   * @param {string} subject - 邮件主题
   * @param {string} from - 发件人
   * @returns {Promise<boolean>} 是否为垃圾邮件
   */
  async detectSpam(env, text, subject, from) {
    if (!this.isEnabled()) return false;
    
    const content = `发件人: ${from}\n主题: ${subject}\n内容: ${text}`.substring(0, 2000);
    const prompt = `判断以下邮件是否为垃圾邮件或钓鱼邮件。
只回答"是"或"否"。

${content}`;
    
    const result = await this.callAI(env, prompt);
    if (!result) return false;
    return result.includes('是');
  },
  
  /**
   * 检测邮件语言
   * @param {object} env - Worker 环境对象
   * @param {string} text - 邮件文本内容
   * @returns {Promise<string>} 语言代码 (zh/en/ja/ko/...)
   */
  async detectLanguage(env, text) {
    if (!this.isEnabled()) return 'unknown';
    
    const content = text.substring(0, 500);
    const prompt = `检测以下文本的语言，只输出语言代码（如：zh、en、ja、ko、fr、de、es、ru）：

${content}`;
    
    const result = await this.callAI(env, prompt);
    if (!result) return 'unknown';
    const lang = result.trim().toLowerCase().replace(/[^a-z]/g, '');
    return lang.length === 2 ? lang : 'unknown';
  },
  
  /**
   * 翻译文本内容
   * @param {object} env - Worker 环境对象
   * @param {string} text - 要翻译的文本
   * @param {string} targetLang - 目标语言 (zh/en/ja/ko/...)
   * @returns {Promise<string|null>} 翻译结果
   */
  async translate(env, text, targetLang = 'zh') {
    if (!this.isEnabled()) return null;
    
    const langMap = {
      'zh': '中文',
      'en': '英文',
      'ja': '日文',
      'ko': '韩文',
      'fr': '法文',
      'de': '德文',
      'es': '西班牙文',
      'ru': '俄文'
    };
    
    const targetName = langMap[targetLang] || '中文';
    const content = text.substring(0, 3000);
    const prompt = `将以下文本翻译成${targetName}，只输出翻译结果：

${content}`;
    
    const result = await this.callAI(env, prompt);
    return result ? result.trim() : null;
  },
  
  /**
   * 检测 URL 安全性
   * @param {object} env - Worker 环境对象
   * @param {string} url - 要检测的 URL
   * @returns {Promise<{safe: boolean, reason: string}>} 安全检测结果
   */
  async checkUrlSafety(env, url) {
    if (!this.isEnabled()) {
      return { safe: true, reason: 'AI 功能已禁用' };
    }
    
    const prompt = `分析以下 URL 是否可能是恶意链接（钓鱼、诈骗、恶意软件等）。
输出格式：安全/可疑/危险 - 原因

URL: ${url}`;
    
    const result = await this.callAI(env, prompt);
    if (!result) {
      return { safe: true, reason: '无法分析' };
    }
    
    const isSafe = result.includes('安全') && !result.includes('不安全');
    const reason = result.replace(/^(安全|可疑|危险)\s*[-:：]?\s*/, '').trim();
    
    return {
      safe: isSafe,
      reason: reason || (isSafe ? '未发现可疑特征' : '存在潜在风险')
    };
  },
  
  /**
   * 综合分析邮件（验证码提取 + 摘要 + 垃圾检测 + 语言检测）
   * @param {object} env - Worker 环境对象
   * @param {object} email - 邮件对象 {subject, text, html, from}
   * @returns {Promise<object>} 分析结果
   */
  async analyzeEmail(env, email) {
    if (!this.isEnabled()) {
      return {
        verificationCode: null,
        summary: null,
        isSpam: false,
        language: 'unknown',
        aiEnabled: false
      };
    }
    
    const { subject = '', text = '', from = '' } = email;
    
    // 并行执行 AI 分析任务
    const [verificationCode, summary, isSpamResult, language] = await Promise.all([
      this.extractVerificationCode(env, text, subject),
      this.generateSummary(env, text, subject),
      this.detectSpam(env, text, subject, from),
      this.detectLanguage(env, text)
    ]);
    
    // 如果检测到验证码，则不标记为垃圾邮件（验证码邮件优先级高于垃圾邮件检测）
    const isSpam = verificationCode ? false : isSpamResult;
    
    return {
      verificationCode,
      summary,
      isSpam,
      language,
      aiEnabled: true
    };
  }
};

// ES 模块导出格式（支持 AI 绑定）
export default {
  async email(message, env, ctx) {
    ctx.waitUntil(handleEmail(message, env));
  },
  
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};

/**
 * 处理接收到的邮件
 */
async function handleEmail(message, env) {
  try {
    // 提取邮件信息
    const to = message.to;
    const from = message.from;
    const subject = message.headers.get('subject') || '(无主题)';
    const date = new Date().toISOString();
    
    // 读取原始邮件内容
    const rawEmail = await new Response(message.raw).text();
    
    // 提取纯文本和 HTML 内容
    const { text, html } = await extractEmailContent(rawEmail);
    
    // AI 分析邮件（验证码提取、摘要、垃圾检测、语言检测）
    let aiResult = {
      verificationCode: null,
      summary: null,
      isSpam: false,
      language: 'unknown',
      aiEnabled: false
    };
    
    try {
      aiResult = await AIService.analyzeEmail(env, {
        subject,
        text: text || '',
        from
      });
      console.log(`AI analysis: code=${aiResult.verificationCode || 'none'}, summary=${aiResult.summary ? 'yes' : 'no'}, spam=${aiResult.isSpam}, lang=${aiResult.language}`);
    } catch (aiError) {
      console.error('AI analysis failed:', aiError);
    }
    
    // 构造邮件对象（包含 AI 分析结果）
    const emailData = {
      from,
      to,
      subject,
      date,
      text: text || '',
      html: html || '',
      raw: rawEmail.substring(0, 10000), // 限制大小
      // AI 分析字段
      verificationCode: aiResult.verificationCode,
      summary: aiResult.summary,
      isSpam: aiResult.isSpam,
      language: aiResult.language
    };
    
    // 发送到 MySQL API 后端存储
    const response = await fetch(`${getApiBase(env)}/api/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });
    
    if (response.ok) {
      console.log(`Email stored for ${to}, text length: ${text?.length || 0}, html length: ${html?.length || 0}`);
    } else {
      const error = await response.text();
      console.error(`Failed to store email: ${error}`);
    }
  } catch (error) {
    console.error('Error handling email:', error);
  }
}

/**
 * 处理短链接跳转
 */
async function handleShortLinkRedirect(code, origin, env) {
  try {
    // 调用后端 API 获取短链接信息并增加点击次数
    const response = await fetch(`${getApiBase(env)}/api/links/${code}/redirect`);
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      // 短链接不存在或已过期，显示错误页面
      return new Response(getShortLinkErrorHTML(data.error || '短链接不存在', origin), {
        status: response.status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
      });
    }
    
    // 302 跳转到原始 URL
    return Response.redirect(data.url, 302);
  } catch (error) {
    console.error('Short link redirect error:', error);
    return new Response(getShortLinkErrorHTML('服务暂时不可用', origin), {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  }
}

/**
 * 生成短链接错误页面
 */
function getShortLinkErrorHTML(errorMessage, origin) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>短链接错误 - 公益平台</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0a0e17;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 40px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #ef4444;
      font-size: 24px;
      margin-bottom: 10px;
    }
    p {
      color: #94a3b8;
      margin-bottom: 30px;
    }
    a {
      display: inline-block;
      padding: 12px 24px;
      background: #00f5d4;
      color: #0a0e17;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
    }
    a:hover {
      background: #00c4aa;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">:(</div>
    <h1>${errorMessage}</h1>
    <p>请检查链接是否正确，或联系链接创建者</p>
    <a href="https://free.violetteam.cloud">返回首页</a>
  </div>
</body>
</html>`;
}

/**
 * 生成 API 文档 HTML 页面
 */
function getApiDocumentationHTML(origin) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API 使用说明 - 公益平台</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
      :root {
          --primary: #00f5d4;
          --primary-dim: #00c4aa;
          --primary-glow: rgba(0, 245, 212, 0.3);
          --secondary: #9b5de5;
          --secondary-dim: #7b3ec5;
          --accent: #f15bb5;
          --bg-dark: #0a0e17;
          --bg-darker: #060912;
          --bg-card: #111827;
          --bg-card-hover: #1a2332;
          --bg-elevated: #1e293b;
          --text-primary: #f1f5f9;
          --text-secondary: #94a3b8;
          --text-muted: #64748b;
          --border: #1e293b;
          --border-glow: rgba(0, 245, 212, 0.2);
          --success: #10b981;
          --warning: #f59e0b;
          --error: #ef4444;
          --font-mono: 'JetBrains Mono', 'Consolas', monospace;
          --font-sans: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
      }
      body {
          font-family: var(--font-sans);
          background: var(--bg-dark);
          color: var(--text-primary);
          line-height: 1.6;
          min-height: 100vh;
          padding: 20px;
      }
      .container {
          max-width: 1200px;
          margin: 0 auto;
      }
      .header {
          text-align: center;
          padding: 40px 20px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 40px;
      }
      .logo {
          font-size: 48px;
          font-weight: 700;
          color: var(--primary);
          margin-bottom: 10px;
          text-shadow: 0 0 20px var(--primary-glow);
      }
      .subtitle {
          color: var(--text-secondary);
          font-size: 18px;
          margin-top: 10px;
      }
      .card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 30px;
          transition: all 0.3s ease;
      }
      .card:hover {
          border-color: var(--primary);
          box-shadow: 0 0 20px var(--primary-glow);
      }
      .card-title {
          font-size: 24px;
          color: var(--primary);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
      }
      .card-title::before {
          content: '';
          width: 4px;
          height: 24px;
          background: var(--primary);
          border-radius: 2px;
      }
      .endpoint {
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 15px;
      }
      .endpoint-method {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          font-family: var(--font-mono);
          margin-right: 10px;
      }
      .method-get { background: var(--success); color: white; }
      .method-post { background: var(--primary); color: var(--bg-dark); }
      .method-delete { background: var(--error); color: white; }
      .endpoint-path {
          font-family: var(--font-mono);
          color: var(--text-primary);
          font-size: 16px;
          margin: 10px 0;
      }
      .endpoint-desc {
          color: var(--text-secondary);
          margin-top: 10px;
          line-height: 1.8;
      }
      .code-block {
          background: var(--bg-darker);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 20px;
          margin: 15px 0;
          overflow-x: auto;
      }
      .code-block code {
          font-family: var(--font-mono);
          font-size: 14px;
          color: var(--text-primary);
          white-space: pre;
      }
      .highlight {
          color: var(--primary);
      }
      .example {
          background: var(--bg-elevated);
          border-left: 3px solid var(--primary);
          padding: 15px 20px;
          margin: 15px 0;
          border-radius: 4px;
      }
      .example-title {
          color: var(--primary);
          font-weight: 600;
          margin-bottom: 10px;
      }
      .badge {
          display: inline-block;
          padding: 4px 10px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 12px;
          color: var(--text-secondary);
          margin-left: 10px;
      }
      .footer {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-muted);
          border-top: 1px solid var(--border);
          margin-top: 60px;
      }
      a {
          color: var(--primary);
          text-decoration: none;
      }
      a:hover {
          text-decoration: underline;
      }
  </style>
</head>
<body>
  <div class="container">
      <div class="header">
          <div class="logo">∞ 公益平台</div>
          <div class="subtitle">API 使用说明文档</div>
          <div class="subtitle" style="font-size: 14px; margin-top: 5px; color: var(--text-muted);">
              当前域名: <span class="highlight">${origin}</span>
          </div>
      </div>

      <div class="card">
          <div class="card-title">服务简介</div>
          <p style="color: var(--text-secondary); line-height: 1.8;">
              公益平台是一个完全免费的公益服务项目，致力于为开发者提供便捷的工具和服务。
              我们提供临时邮箱、GitHub 代理、文件加速下载等多项免费服务，所有服务均通过 Cloudflare Workers 部署，
              支持高并发、低延迟访问。邮件数据会在 24 小时后自动删除，确保隐私安全。
          </p>
          <div style="margin-top: 20px; padding: 20px; background: var(--bg-elevated); border-radius: 8px; border-left: 4px solid var(--primary);">
              <p style="color: var(--text-primary); font-weight: 600; margin-bottom: 10px;">平台特色</p>
              <ul style="color: var(--text-secondary); padding-left: 20px; line-height: 2;">
                  <li>完全免费，无需注册</li>
                  <li>高可用性，全球 CDN 加速</li>
                  <li>隐私保护，数据自动清理</li>
                  <li>开源透明，代码公开可查</li>
              </ul>
          </div>
      </div>

      <div class="card">
          <div class="card-title">邮件 API</div>
          
          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/api/emails/:email</span>
              <div class="endpoint-desc">
                  获取指定邮箱地址的所有邮件列表（公开接口）
                  <div class="example">
                      <div class="example-title">请求示例</div>
                      <code>GET ${origin}/api/emails/test@example.com</code>
                  </div>
                  <div class="example">
                      <div class="example-title">响应格式</div>
                      <code>{
  "email": "test@example.com",
  "emails": [
    {
      "id": 1,
      "from": "sender@example.com",
      "to": "test@example.com",
      "subject": "邮件主题",
      "date": "2025-12-29T00:00:00.000Z",
      "text": "纯文本内容",
      "html": "HTML 内容"
    }
  ],
  "count": 1
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-delete">DELETE</span>
              <span class="endpoint-path">/api/emails/:email/:id</span>
              <div class="endpoint-desc">
                  删除指定邮件（公开接口）
                  <div class="example">
                      <div class="example-title">请求示例</div>
                      <code>DELETE ${origin}/api/emails/test@example.com/1</code>
                  </div>
              </div>
          </div>
      </div>

      <div class="card">
          <div class="card-title">域名管理 API</div>
          
          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/api/domains</span>
              <div class="endpoint-desc">
                  获取所有可用的域名列表（公开接口）
                  <div class="example">
                      <div class="example-title">请求示例</div>
                      <code>GET ${origin}/api/domains</code>
                  </div>
                  <div class="example">
                      <div class="example-title">响应格式</div>
                      <code>{
  "success": true,
  "domains": [
    {
      "name": "example.com",
      "api": "https://example.com"
    }
  ]
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/domains</span>
              <div class="endpoint-desc">
                  添加新域名（公开接口，无需管理员密钥）
                  <div class="example">
                      <div class="example-title">请求示例</div>
                      <code>POST ${origin}/api/domains
Headers: {
"Content-Type": "application/json"
}
Body: {
"name": "example.com",
"api": "https://example.com"
}</code>
                  </div>
                  <div style="margin-top: 10px; padding: 10px; background: var(--bg-elevated); border-radius: 4px; font-size: 13px; color: var(--text-secondary);">
                      提示：任何人都可以添加域名，这有助于扩展平台服务范围
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-delete">DELETE</span>
              <span class="endpoint-path">/api/domains/:name</span>
              <div class="endpoint-desc">
                  删除指定域名 <span class="badge">需要管理员密钥</span>
                  <div class="example">
                      <div class="example-title">请求示例</div>
                      <code>DELETE ${origin}/api/domains/example.com
Headers: {
"X-Admin-Key": "your-admin-key"
}</code>
                  </div>
                  <div style="margin-top: 10px; padding: 10px; background: var(--bg-elevated); border-radius: 4px; font-size: 13px; color: var(--text-secondary);">
                      注意：删除操作需要管理员密钥，防止误删
                  </div>
              </div>
          </div>
      </div>

      <div class="card">
          <div class="card-title">发送邮件 API</div>
          
          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/send-email</span>
              <div class="endpoint-desc">
                  发送邮件（需要配置 RESEND_API_KEY）
                  <div class="example">
                      <div class="example-title">请求示例</div>
                      <code>POST ${origin}/api/send-email
Headers: {
"Content-Type": "application/json"
}
Body: {
"from": "sender@example.com",
"to": "recipient@example.com",
"subject": "邮件主题",
"text": "纯文本内容",
"html": "HTML 内容（可选）"
}</code>
                  </div>
              </div>
          </div>
      </div>

      <div class="card">
          <div class="card-title">短链接服务</div>
          <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
              免费的短链接生成服务，将长 URL 转换为短链接，支持自定义短码和访问统计。
          </p>
          
          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/links</span>
              <div class="endpoint-desc">
                  创建短链接
                  <div class="example">
                      <div class="example-title">请求示例</div>
                      <code>POST ${origin}/api/links
Headers: {
"Content-Type": "application/json"
}
Body: {
"url": "https://example.com/very/long/url",
"title": "链接标题（可选）",
"customCode": "mylink（可选，自定义短码）",
"expiresIn": 24（可选，过期时间，单位：小时）
}</code>
                  </div>
                  <div class="example">
                      <div class="example-title">响应格式</div>
                      <code>{
  "success": true,
  "code": "abc123",
  "shortUrl": "${origin}/s/abc123",
  "originalUrl": "https://example.com/very/long/url",
  "expiresAt": "2025-01-01T12:00:00.000Z"
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/s/:code</span>
              <div class="endpoint-desc">
                  访问短链接，自动跳转到原始 URL
                  <div class="example">
                      <div class="example-title">使用示例</div>
                      <code># 直接访问短链接
${origin}/s/abc123

# 将自动跳转到原始 URL</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/api/links/:code/stats</span>
              <div class="endpoint-desc">
                  获取短链接统计信息
                  <div class="example">
                      <div class="example-title">响应格式</div>
                      <code>{
  "success": true,
  "stats": {
    "code": "abc123",
    "originalUrl": "https://example.com/...",
    "clicks": 42,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "expiresAt": null,
    "isExpired": false
  }
}</code>
                  </div>
              </div>
          </div>

          <div style="margin-top: 15px; padding: 15px; background: var(--bg-elevated); border-radius: 6px; border-left: 3px solid var(--primary);">
              <strong style="color: var(--primary);">功能特性：</strong>
              <ul style="margin-top: 10px; padding-left: 20px; color: var(--text-secondary);">
                  <li>支持自定义短码（3-20 字符）</li>
                  <li>可设置过期时间</li>
                  <li>访问次数统计</li>
                  <li>完全免费，无需注册</li>
              </ul>
          </div>
      </div>

      <div class="card">
          <div class="card-title">GitHub 代理服务</div>
          <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
              通过本域名代理访问 GitHub，支持 Git 克隆、下载等操作。自动将 <span class="highlight">github.com</span> 替换为当前域名。
          </p>
          
          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/{user}/{repo}[.git]</span>
              <div class="endpoint-desc">
                  GitHub 仓库代理访问
                  <div class="example">
                      <div class="example-title">使用示例</div>
                      <code># Git 克隆
git clone ${origin}/username/repository.git

# 访问仓库页面
curl ${origin}/username/repository

# 下载文件
curl ${origin}/username/repository/raw/main/file.txt</code>
                  </div>
                  <div style="margin-top: 15px; padding: 15px; background: var(--bg-elevated); border-radius: 6px; border-left: 3px solid var(--warning);">
                      <strong style="color: var(--warning);">限制说明：</strong>
                      <ul style="margin-top: 10px; padding-left: 20px; color: var(--text-secondary);">
                          <li>仅允许 Git/Curl/Wget 等工具访问</li>
                          <li>每 IP 每分钟最多 60 次请求</li>
                          <li>禁止访问登录、设置等敏感路径</li>
                      </ul>
                  </div>
              </div>
          </div>
      </div>

      <div class="card">
          <div class="card-title">文件加速下载</div>
          <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
              通过 Cloudflare 加速下载各类文件，支持 GitHub Releases、npm、PyPI 等任意 HTTPS 文件，无大小限制。
          </p>
          
          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/proxy/?url={文件URL}</span>
              <div class="endpoint-desc">
                  代理下载指定 URL 的文件
                  <div class="example">
                      <div class="example-title">使用示例</div>
                      <code># 加速下载 GitHub Release 文件
\${origin}/proxy/?url=https://github.com/ollama/ollama/releases/download/v0.13.5/ollama-linux-arm64.tgz

# 加速下载 npm 包
\${origin}/proxy/?url=https://registry.npmjs.org/package/-/package-1.0.0.tgz

# 加速下载任意 HTTPS 文件
\${origin}/proxy/?url=https://example.com/file.zip</code>
                  </div>
                  <div style="margin-top: 15px; padding: 15px; background: var(--bg-elevated); border-radius: 6px; border-left: 3px solid var(--success);">
                      <strong style="color: var(--success);">功能特性：</strong>
                      <ul style="margin-top: 10px; padding-left: 20px; color: var(--text-secondary);">
                          <li>支持断点续传（Range 请求）</li>
                          <li>无文件大小限制</li>
                          <li>自动跟随重定向</li>
                          <li>保留原始文件名</li>
                      </ul>
                  </div>
              </div>
          </div>
      </div>

      <div class="card">
          <div class="card-title">CORS 支持</div>
          <p style="color: var(--text-secondary); line-height: 1.8;">
              所有 API 接口均支持跨域访问（CORS），允许从任何域名调用。响应头包含：
          </p>
          <div class="code-block">
              <code>Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Admin-Key</code>
          </div>
      </div>

      <div class="card">
          <div class="card-title">AI 智能分析 <span class="badge">Cloudflare Workers AI</span></div>
          <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
              使用 Cloudflare Workers AI 提供智能文本分析功能，包括翻译、摘要、验证码提取和安全检测。
          </p>
          
          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/ai/translate</span>
              <div class="endpoint-desc">
                  翻译文本内容
                  <div class="example">
                      <div class="example-title">请求示例</div>
                      <code>POST ${origin}/api/ai/translate
Body: {
  "text": "Hello, World!",
  "targetLang": "zh"
}</code>
                  </div>
                  <div class="example">
                      <div class="example-title">响应格式</div>
                      <code>{
  "success": true,
  "translation": "你好，世界！",
  "targetLang": "zh"
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/ai/summarize</span>
              <div class="endpoint-desc">
                  生成文本摘要
                  <div class="example">
                      <div class="example-title">请求示例</div>
                      <code>POST ${origin}/api/ai/summarize
Body: {
  "text": "邮件正文内容...",
  "subject": "邮件主题"
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/ai/extract-code</span>
              <div class="endpoint-desc">
                  从文本中智能提取验证码
                  <div class="example">
                      <div class="example-title">请求示例</div>
                      <code>POST ${origin}/api/ai/extract-code
Body: {
  "text": "您的验证码是 123456",
  "subject": "验证邮件"
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/ai/check-url</span>
              <div class="endpoint-desc">
                  检测 URL 安全性
                  <div class="example">
                      <div class="example-title">请求示例</div>
                      <code>POST ${origin}/api/ai/check-url
Body: {
  "url": "https://example.com"
}</code>
                  </div>
                  <div class="example">
                      <div class="example-title">响应格式</div>
                      <code>{
  "success": true,
  "safe": true,
  "reason": "未发现可疑特征"
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/api/links/:code/safety</span>
              <div class="endpoint-desc">
                  检测短链接目标 URL 的安全性
              </div>
          </div>

          <div style="margin-top: 15px; padding: 15px; background: var(--bg-elevated); border-radius: 6px; border-left: 3px solid var(--secondary);">
              <strong style="color: var(--secondary);">AI 功能说明：</strong>
              <ul style="margin-top: 10px; padding-left: 20px; color: var(--text-secondary);">
                  <li>使用 Meta Llama 3 8B 模型</li>
                  <li>自动分析收到的邮件（验证码、摘要、垃圾检测）</li>
                  <li>支持中英日韩等多语言翻译</li>
                  <li>每日 10,000 神经元免费额度</li>
              </ul>
          </div>
      </div>

      <div class="card" style="background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%); border: 2px solid var(--primary);">
          <div class="card-title" style="font-size: 20px;">关于公益平台</div>
          <p style="color: var(--text-secondary); line-height: 1.8; margin-bottom: 15px;">
              我们是一个非盈利的公益项目，致力于为开发者社区提供免费、可靠的服务。
              所有服务均免费提供，无任何商业目的。
          </p>
          <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 20px;">
              <div style="flex: 1; min-width: 200px;">
                  <p style="color: var(--primary); font-weight: 600; margin-bottom: 8px;">服务理念</p>
                  <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
                      免费、开放、透明，为开发者提供最便捷的工具
                  </p>
              </div>
              <div style="flex: 1; min-width: 200px;">
                  <p style="color: var(--primary); font-weight: 600; margin-bottom: 8px;">隐私保护</p>
                  <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
                      所有数据自动清理，不存储任何个人信息
                  </p>
              </div>
          </div>
      </div>

      <div class="footer">
          <p>Powered by <span class="highlight">VioletTeam</span></p>
          <p style="margin-top: 10px; font-size: 14px;">公益平台 - 免费公益服务 | 让开发更简单</p>
          <p style="margin-top: 10px; font-size: 12px; color: var(--text-muted);">
              本平台所有服务完全免费，欢迎使用和反馈
          </p>
      </div>
  </div>
</body>
</html>`;
}

/**
 * 处理 HTTP 请求
 */
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const apiBase = getApiBase(env);
  
  // CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
  };
  
  // 处理 OPTIONS 请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 辅助函数：返回 JSON 响应
  const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  };

  // ==================== AI API 端点 ====================
  
  // AI 翻译接口
  if (url.pathname === '/api/ai/translate' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { text, targetLang = 'zh' } = body;
      
      if (!text) {
        return jsonResponse({ success: false, error: '缺少 text 参数' }, 400);
      }
      
      const result = await AIService.translate(env, text, targetLang);
      if (result) {
        return jsonResponse({ success: true, translation: result, targetLang });
      } else {
        return jsonResponse({ success: false, error: 'AI 服务不可用' }, 503);
      }
    } catch (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  }
  
  // AI 摘要接口
  if (url.pathname === '/api/ai/summarize' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { text, subject = '' } = body;
      
      if (!text) {
        return jsonResponse({ success: false, error: '缺少 text 参数' }, 400);
      }
      
      const result = await AIService.generateSummary(env, text, subject);
      if (result) {
        return jsonResponse({ success: true, summary: result });
      } else {
        return jsonResponse({ success: false, error: 'AI 服务不可用' }, 503);
      }
    } catch (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  }
  
  // AI 验证码提取接口
  if (url.pathname === '/api/ai/extract-code' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { text, subject = '' } = body;
      
      if (!text) {
        return jsonResponse({ success: false, error: '缺少 text 参数' }, 400);
      }
      
      const result = await AIService.extractVerificationCode(env, text, subject);
      return jsonResponse({ success: true, code: result });
    } catch (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  }
  
  // AI URL 安全检测接口
  if (url.pathname === '/api/ai/check-url' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { url: targetUrl } = body;
      
      if (!targetUrl) {
        return jsonResponse({ success: false, error: '缺少 url 参数' }, 400);
      }
      
      const result = await AIService.checkUrlSafety(env, targetUrl);
      return jsonResponse({ success: true, ...result });
    } catch (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  }
  
  // 短链接安全检测（集成到现有短链接 API）
  if (url.pathname.match(/^\/api\/links\/[^/]+\/safety$/) && request.method === 'GET') {
    try {
      const code = url.pathname.split('/')[3];
      // 先获取短链接信息
      const linkResponse = await fetch(`${apiBase}/api/links/${code}`);
      const linkData = await linkResponse.json();
      
      if (!linkData.success) {
        return jsonResponse({ success: false, error: '短链接不存在' }, 404);
      }
      
      // 检测 URL 安全性
      const safetyResult = await AIService.checkUrlSafety(env, linkData.url);
      return jsonResponse({
        success: true,
        code,
        url: linkData.url,
        ...safetyResult
      });
    } catch (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  }

  // ==================== API 路由代理到 MySQL 后端 ====================
  
  if (url.pathname.startsWith('/api/')) {
    try {
      // 复制请求头
      const headers = new Headers(request.headers);
      headers.delete('host');
      
      // 转发请求到 MySQL API
      const targetUrl = `${apiBase}${url.pathname}${url.search}`;
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null
      });
      
      // 复制响应
      const responseHeaders = new Headers(response.headers);
      Object.keys(corsHeaders).forEach(key => {
        responseHeaders.set(key, corsHeaders[key]);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch (error) {
      return jsonResponse({ 
        success: false, 
        error: 'API 代理失败', 
        message: error.message 
      }, 502);
    }
  }
  
  // ==================== GitHub 代理 ====================
  // 格式: https://域名/user/repo.git 或 https://域名/user/repo/...
  // 代理到: https://github.com/user/repo.git 或 https://github.com/user/repo/...
  
  // 根路径返回 HTML API 文档页面
  if (url.pathname === '/') {
    return new Response(getApiDocumentationHTML(url.origin), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // 文件加速代理
  if (url.pathname === '/proxy/' || url.pathname === '/proxy') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return jsonResponse({
        error: '缺少 url 参数',
        usage: url.origin + '/proxy/?url=https://example.com/file.zip'
      }, 400);
    }
    return handleFileProxy(targetUrl, request);
  }

  // 短链接跳转
  if (url.pathname.startsWith('/s/')) {
    const code = url.pathname.slice(3);
    if (code) {
      return handleShortLinkRedirect(code, url.origin, env);
    }
  }

  // 排除 API 路径、文件代理路径、短链接路径，其他路径代理到 GitHub
  if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/proxy') && !url.pathname.startsWith('/s/') && url.pathname.length > 1) {
    return handleGitHubProxy(request, url);
  }

  // 默认响应
  return jsonResponse({
    service: '公益平台 - 免费公益服务',
    status: 'running',
    backend: 'MySQL',
    features: ['临时邮箱', 'GitHub 代理', '文件加速下载', '短链接'],
    endpoints: [
      'GET /api/domains',
      'POST /api/domains',
      'DELETE /api/domains/:name',
      'GET /api/emails/:email',
      'POST /api/emails',
      'DELETE /api/emails/:email/:id',
      'POST /api/send-email',
      'POST /api/links - 创建短链接',
      'GET /api/links/:code - 获取短链接信息',
      'GET /s/:code - 短链接跳转',
      'GET /{user}/{repo}[.git] - GitHub 代理',
      'GET /proxy/?url={文件URL} - 文件加速下载'
    ]
  });
}

// ==================== GitHub 代理防护配置 ====================
const GITHUB_PROXY_CONFIG = {
  // 频率限制：每 IP 每分钟最大请求数
  rateLimit: 60,
  rateLimitWindow: 60, // 秒
  
  // User-Agent 白名单（允许的客户端）
  allowedUserAgents: [
    'git/',           // Git 客户端
    'curl/',          // curl
    'wget/',          // wget
    'libcurl/',       // libcurl
    'Go-http-client', // Go HTTP 客户端
    'python-requests',// Python requests
    'axios/',         // Axios
    'node-fetch',     // Node fetch
    'Mozilla/',       // 浏览器（用于查看仓库页面）
  ],
  
  // 路径黑名单（禁止代理的路径）
  blockedPaths: [
    '/login',
    '/logout', 
    '/signup',
    '/join',
    '/sessions',
    '/settings',
    '/password_reset',
    '/users/',
    '/orgs/',
    '/.git/config',   // 防止泄露配置
  ],
  
  // 禁止的文件扩展名（防止滥用下载大文件）
  blockedExtensions: [
    '.zip',
    '.tar.gz',
    '.tgz',
    '.exe',
    '.dmg',
    '.pkg',
    '.deb',
    '.rpm',
    '.msi',
    '.iso',
  ],
};

// 简单的内存频率限制（Worker 重启会清空，但足够用）
const rateLimitMap = new Map();

/**
 * 检查频率限制
 */
function checkRateLimit(ip) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - GITHUB_PROXY_CONFIG.rateLimitWindow;
  
  let data = rateLimitMap.get(ip);
  
  if (!data) {
    data = { timestamps: [] };
  }
  
  // 清理过期的时间戳
  data.timestamps = data.timestamps.filter(t => t > windowStart);
  
  // 检查是否超过限制
  if (data.timestamps.length >= GITHUB_PROXY_CONFIG.rateLimit) {
    return false; // 超过限制
  }
  
  // 添加新的时间戳
  data.timestamps.push(now);
  rateLimitMap.set(ip, data);
  
  // 定期清理过期记录（避免内存泄漏）
  if (rateLimitMap.size > 10000) {
    const keysToDelete = [];
    rateLimitMap.forEach((value, key) => {
      if (value.timestamps.length === 0 || value.timestamps[value.timestamps.length - 1] < windowStart) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => rateLimitMap.delete(key));
  }
  
  return true; // 允许请求
}

/**
 * 检查 User-Agent 是否在白名单中
 */
function isAllowedUserAgent(userAgent) {
  if (!userAgent) return false;
  return GITHUB_PROXY_CONFIG.allowedUserAgents.some(ua => 
    userAgent.toLowerCase().includes(ua.toLowerCase())
  );
}

/**
 * 检查路径是否被禁止
 */
function isBlockedPath(pathname) {
  const lowerPath = pathname.toLowerCase();
  
  // 检查路径黑名单
  if (GITHUB_PROXY_CONFIG.blockedPaths.some(p => lowerPath.includes(p.toLowerCase()))) {
    return true;
  }
  
  // 检查文件扩展名黑名单
  if (GITHUB_PROXY_CONFIG.blockedExtensions.some(ext => lowerPath.endsWith(ext.toLowerCase()))) {
    return true;
  }
  
  return false;
}

/**
 * 获取客户端 IP
 */
function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Real-IP') || 
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         '0.0.0.0';
}

// ==================== 文件加速代理 ====================
const FILE_PROXY_CONFIG = {
  allowedProtocols: ['https:', 'http:'],
  blockedDomains: ['localhost', '127.0.0.1', '0.0.0.0', '::1'],
  timeout: 300000 // 5分钟超时
};

async function handleFileProxy(targetUrl, request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  
  const errorResponse = (message, status) => {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: corsHeaders
    });
  };
  
  try {
    // URL 验证
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return errorResponse('无效的 URL', 400);
    }
    
    // 协议检查
    if (!FILE_PROXY_CONFIG.allowedProtocols.includes(parsedUrl.protocol)) {
      return errorResponse('仅支持 HTTP/HTTPS 协议', 400);
    }
    
    // 域名检查
    if (FILE_PROXY_CONFIG.blockedDomains.some(d => parsedUrl.hostname.includes(d))) {
      return errorResponse('禁止访问的域名', 403);
    }
    
    // 代理请求
    const headers = new Headers();
    headers.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0');
    
    // 支持 Range 请求（断点续传）
    const range = request.headers.get('Range');
    if (range) {
      headers.set('Range', range);
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FILE_PROXY_CONFIG.timeout);
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: headers,
      redirect: 'follow',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // 构建响应头
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Expose-Headers', '*');
    
    // 传递重要的响应头
    const headersToPass = ['Content-Type', 'Content-Length', 'Content-Disposition', 'Accept-Ranges', 'Content-Range', 'ETag', 'Last-Modified'];
    headersToPass.forEach(h => {
      const value = response.headers.get(h);
      if (value) responseHeaders.set(h, value);
    });
    
    // 如果没有 Content-Disposition，尝试从 URL 提取文件名
    if (!responseHeaders.get('Content-Disposition')) {
      const filename = parsedUrl.pathname.split('/').pop();
      if (filename && filename.includes('.')) {
        responseHeaders.set('Content-Disposition', 'attachment; filename="' + filename + '"');
      }
    }
    
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });
    
  } catch (error) {
    if (error.name === 'AbortError') {
      return errorResponse('请求超时', 504);
    }
    return errorResponse('代理请求失败: ' + error.message, 502);
  }
}

/**
 * 处理 GitHub 代理请求
 * 将 https://域名/user/repo 代理到 https://github.com/user/repo
 */
async function handleGitHubProxy(request, url) {
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('User-Agent') || '';
  
  // 1. 检查 User-Agent 白名单
  if (!isAllowedUserAgent(userAgent)) {
    return new Response(JSON.stringify({ 
      error: '禁止访问', 
      message: '不支持的客户端类型',
      hint: '请使用 git/curl/wget 等工具访问'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  
  // 2. 检查路径黑名单
  if (isBlockedPath(url.pathname)) {
    return new Response(JSON.stringify({ 
      error: '禁止访问', 
      message: '该路径不允许代理'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  
  // 3. 检查频率限制
  const withinLimit = checkRateLimit(clientIP);
  if (!withinLimit) {
    return new Response(JSON.stringify({ 
      error: '请求过于频繁', 
      message: `每分钟最多 ${GITHUB_PROXY_CONFIG.rateLimit} 次请求`,
      retryAfter: GITHUB_PROXY_CONFIG.rateLimitWindow
    }), {
      status: 429,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*',
        'Retry-After': String(GITHUB_PROXY_CONFIG.rateLimitWindow)
      }
    });
  }
  
  // 构造 GitHub URL
  const githubUrl = `https://github.com${url.pathname}${url.search}`;
  
  // 复制原始请求的 headers，但移除 host
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('User-Agent', userAgent || 'git/2.40.0');
  
  try {
    const response = await fetch(githubUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      redirect: 'follow'
    });
    
    // 复制响应 headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    
    // 添加速率限制信息到响应头
    responseHeaders.set('X-RateLimit-Limit', String(GITHUB_PROXY_CONFIG.rateLimit));
    responseHeaders.set('X-RateLimit-Window', `${GITHUB_PROXY_CONFIG.rateLimitWindow}s`);
    
    // 处理重定向：将 github.com 替换为当前域名
    const location = responseHeaders.get('Location');
    if (location && location.includes('github.com')) {
      const newLocation = location.replace('https://github.com', url.origin);
      responseHeaders.set('Location', newLocation);
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'GitHub 代理失败', 
      message: error.message,
      url: githubUrl
    }), {
      status: 502,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

/**
 * 从原始邮件中提取文本和 HTML 内容
 */
async function extractEmailContent(rawEmail) {
  let text = '';
  let html = '';
  
  try {
    const lines = rawEmail.split('\n');
    let inBody = false;
    let currentContentType = '';
    let currentEncoding = '';
    let currentCharset = 'utf-8';
    let contentBuffer = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 检测 Content-Type 和 charset
      if (line.match(/^Content-Type:\s*text\/(plain|html)/i)) {
        const typeMatch = line.match(/text\/(plain|html)/i);
        currentContentType = typeMatch ? typeMatch[1].toLowerCase() : '';
        
        // 提取 charset
        const charsetMatch = line.match(/charset[=\s]*["']?([^"'\s;]+)/i);
        if (charsetMatch) {
          currentCharset = charsetMatch[1].toLowerCase();
        }
        continue;
      }
      
      // 检测编码方式
      if (line.match(/^Content-Transfer-Encoding:\s*(.+)/i)) {
        const match = line.match(/Content-Transfer-Encoding:\s*(.+)/i);
        currentEncoding = match ? match[1].trim().toLowerCase() : '';
        continue;
      }
      
      // 空行表示正文开始
      if (!inBody && line === '' && currentContentType) {
        inBody = true;
        continue;
      }
      
      // 读取正文内容
      if (inBody) {
        // MIME 边界表示内容结束
        if (line.startsWith('--')) {
          // 处理收集到的内容
          if (contentBuffer.length > 0) {
            let content = decodeContent(contentBuffer.join('\n'), currentEncoding, currentCharset);
            
            // 根据类型存储
            if (currentContentType === 'plain') {
              text = content;
            } else if (currentContentType === 'html') {
              html = content;
            }
            
            contentBuffer = [];
          }
          
          inBody = false;
          currentContentType = '';
          currentEncoding = '';
          currentCharset = 'utf-8';
          continue;
        }
        
        // 跳过 Content- 开头的行
        if (line.match(/^Content-/i)) continue;
        
        contentBuffer.push(line);
      }
    }
    
    // 处理剩余内容
    if (contentBuffer.length > 0) {
      let content = decodeContent(contentBuffer.join('\n'), currentEncoding, currentCharset);
      
      if (currentContentType === 'plain') {
        text = content;
      } else if (currentContentType === 'html') {
        html = content;
      }
    }
    
  } catch (error) {
    console.error('Extract email content error:', error);
  }
  
  return { text, html };
}

/**
 * 解码邮件内容
 */
function decodeContent(content, encoding, charset) {
  try {
    charset = charset || 'utf-8';
    
    // 先根据 Transfer-Encoding 解码
    if (encoding === 'base64') {
      // Base64 解码
      const cleaned = content.replace(/\s/g, '');
      const binaryString = atob(cleaned);
      
      // 转换为 Uint8Array
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // 使用 TextDecoder 解码
      const decoder = new TextDecoder(charset);
      content = decoder.decode(bytes);
      
    } else if (encoding === 'quoted-printable') {
      // Quoted-Printable 解码，传入 charset
      content = decodeQuotedPrintable(content, charset);
    }
    
    return content;
  } catch (e) {
    console.error('Decode content error:', e);
    return content;
  }
}

/**
 * 解码 Quoted-Printable 编码
 */
function decodeQuotedPrintable(str, charset = 'utf-8') {
  try {
    // 移除软换行
    str = str.replace(/=\r?\n/g, '');
    
    // 将 =XX 转换为字节数组
    const bytes = [];
    let i = 0;
    while (i < str.length) {
      if (str[i] === '=' && i + 2 < str.length) {
        const hex = str.substr(i + 1, 2);
        if (/^[0-9A-F]{2}$/i.test(hex)) {
          bytes.push(parseInt(hex, 16));
          i += 3;
        } else {
          bytes.push(str.charCodeAt(i));
          i++;
        }
      } else {
        bytes.push(str.charCodeAt(i));
        i++;
      }
    }
    
    // 使用 TextDecoder 正确解码 UTF-8
    const uint8Array = new Uint8Array(bytes);
    const decoder = new TextDecoder(charset);
    return decoder.decode(uint8Array);
  } catch (e) {
    console.error('Decode quoted-printable error:', e);
    return str;
  }
}
