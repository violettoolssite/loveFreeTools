/**
 * 公益平台 - API 封装
 * 支持多域名的邮件服务接口
 */

const EmailAPI = {
    /**
     * 默认域名列表（API 请求失败时的备用）
     */
    DEFAULT_DOMAINS: [
        { name: 'logincursor.xyz', api: 'https://logincursor.xyz' },
        { name: 'kami666.xyz', api: 'https://kami666.xyz' },
        { name: 'deploytools.site', api: 'https://deploytools.site' },
        { name: 'loginvipcursor.icu', api: 'https://loginvipcursor.icu' },
        { name: 'qxfy.store', api: 'https://qxfy.store' }
    ],

    /**
     * API 基础地址（MySQL 后端）
     */
    API_BASE: 'https://mirror.yljdteam.com/email-api',

    /**
     * 管理员密钥（用于管理操作）
     */
    adminKey: '',

    /**
     * 缓存的域名列表
     */
    _domains: null,

    /**
     * 获取域名列表（从缓存或返回默认值）
     */
    get DOMAINS() {
        return this._domains || this.DEFAULT_DOMAINS;
    },

    /**
     * 设置域名列表
     */
    set DOMAINS(value) {
        this._domains = value;
    },

    /**
     * 从服务器加载域名列表
     */
    async loadDomains() {
        try {
            const response = await this.fetchWithTimeout(`${this.API_BASE}/api/domains`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.domains)) {
                    this._domains = data.domains;
                    return data.domains;
                }
            }
        } catch (e) {
            console.error('加载域名列表失败:', e);
        }
        return this.DEFAULT_DOMAINS;
    },

    /**
     * 添加域名
     */
    async addDomain(name, api) {
        try {
            const response = await this.fetchWithTimeout(`${this.API_BASE}/api/domains`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, api })
            });
            const data = await response.json();
            if (data.success) {
                this._domains = data.domains;
            }
            return data;
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    /**
     * 删除域名
     */
    async deleteDomain(name, adminKey) {
        try {
            const headers = {};
            if (adminKey) {
                headers['X-Admin-Key'] = adminKey;
            }
            const response = await this.fetchWithTimeout(`${this.API_BASE}/api/domains/${encodeURIComponent(name)}`, {
                method: 'DELETE',
                headers
            });
            const data = await response.json();
            if (data.success) {
                this._domains = data.domains;
            }
            return data;
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    /**
     * 当前选中的域名索引
     */
    currentDomainIndex: 0,

    /**
     * 请求超时时间（毫秒）
     */
    TIMEOUT: 10000,

    /**
     * 获取所有可用域名
     * @returns {Array} 域名列表
     */
    getDomains() {
        return this.DOMAINS;
    },

    /**
     * 获取当前选中的域名
     * @returns {object} 当前域名对象 { name, api }
     */
    getCurrentDomain() {
        return this.DOMAINS[this.currentDomainIndex];
    },

    /**
     * 设置当前域名
     * @param {number} index - 域名索引
     */
    setCurrentDomain(index) {
        if (index >= 0 && index < this.DOMAINS.length) {
            this.currentDomainIndex = index;
        }
    },

    /**
     * 根据域名名称设置当前域名
     * @param {string} domainName - 域名名称
     * @returns {boolean} 是否成功
     */
    setCurrentDomainByName(domainName) {
        const index = this.DOMAINS.findIndex(d => d.name === domainName);
        if (index !== -1) {
            this.currentDomainIndex = index;
            return true;
        }
        return false;
    },

    /**
     * 创建带超时的 fetch 请求
     * @param {string} url - 请求URL
     * @param {object} options - fetch 选项
     * @returns {Promise<Response>}
     */
    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('请求超时');
            }
            throw error;
        }
    },

    /**
     * 获取指定邮箱的邮件列表
     * @param {string} email - 完整邮箱地址
     * @returns {Promise<object>} 邮件数据
     */
    async getEmails(email) {
        // 解析邮箱获取域名
        const parts = email.split('@');
        if (parts.length !== 2) {
            throw new Error('无效的邮箱地址');
        }

        const domain = parts[1];
        const domainConfig = this.DOMAINS.find(d => d.name === domain);
        
        if (!domainConfig) {
            throw new Error(`不支持的域名: ${domain}`);
        }

        // 统一使用 API_BASE（Nginx 反向代理），避免各域名 Worker 配置问题
        const url = `${this.API_BASE}/api/emails/${encodeURIComponent(email)}`;
        
        try {
            const response = await this.fetchWithTimeout(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`请求失败: ${response.status}`);
            }

            const data = await response.json();
            return {
                success: true,
                email: data.email || email,
                emails: data.emails || [],
                count: data.count || 0
            };
        } catch (error) {
            console.error('获取邮件失败:', error);
            return {
                success: false,
                email: email,
                emails: [],
                count: 0,
                error: error.message
            };
        }
    },

    /**
     * 检查域名服务是否可用
     * @param {string} domainName - 域名名称
     * @returns {Promise<boolean>} 是否可用
     */
    async checkDomainHealth(domainName) {
        const domainConfig = this.DOMAINS.find(d => d.name === domainName);
        if (!domainConfig) return false;

        try {
            // 移除 API 地址末尾的斜杠
            const apiBase = domainConfig.api.replace(/\/+$/, '');
            const response = await this.fetchWithTimeout(apiBase, {
                method: 'GET'
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.status === 'running';
            }
            return false;
        } catch (error) {
            console.error(`域名 ${domainName} 健康检查失败:`, error);
            return false;
        }
    },

    /**
     * 检查所有域名的健康状态
     * @returns {Promise<object>} 各域名状态
     */
    async checkAllDomainsHealth() {
        const results = {};
        
        await Promise.all(
            this.DOMAINS.map(async (domain) => {
                results[domain.name] = await this.checkDomainHealth(domain.name);
            })
        );
        
        return results;
    },

    /**
     * 获取第一个可用的域名
     * @returns {Promise<object|null>} 可用的域名配置或 null
     */
    async getFirstAvailableDomain() {
        for (const domain of this.DOMAINS) {
            const isAvailable = await this.checkDomainHealth(domain.name);
            if (isAvailable) {
                return domain;
            }
        }
        return null;
    },

    /**
     * 轮询检查新邮件
     * @param {string} email - 邮箱地址
     * @param {number} lastCount - 上次邮件数量
     * @returns {Promise<object>} { hasNew, newCount, emails }
     */
    async pollNewEmails(email, lastCount = 0) {
        const result = await this.getEmails(email);
        
        if (!result.success) {
            return {
                hasNew: false,
                newCount: 0,
                emails: [],
                error: result.error
            };
        }

        const hasNew = result.count > lastCount;
        const newCount = hasNew ? result.count - lastCount : 0;

        return {
            hasNew,
            newCount,
            emails: result.emails,
            totalCount: result.count
        };
    },

    /**
     * 删除邮件
     * @param {string} email - 邮箱地址
     * @param {number} emailId - 邮件ID（MySQL）或邮件索引（KV）
     * @returns {Promise<object>} 删除结果
     */
    async deleteEmail(email, emailId) {
        try {
            const parts = email.split('@');
            if (parts.length !== 2) {
                throw new Error('无效的邮箱地址');
        }

            const domain = parts[1];
            const domainConfig = this.DOMAINS.find(d => d.name === domain);
            
            if (!domainConfig) {
                throw new Error(`不支持的域名: ${domain}`);
        }

            // 统一使用 API_BASE
            const url = `${this.API_BASE}/api/emails/${encodeURIComponent(email)}/${encodeURIComponent(emailId)}`;
            
            const response = await this.fetchWithTimeout(url, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`删除失败: ${response.status}`);
            }

            const data = await response.json();
            return {
                success: true,
                ...data
            };
        } catch (error) {
            console.error('删除邮件失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * 设置管理员密钥
     */
    setAdminKey(key) {
        this.adminKey = key;
    },

    /**
     * 发送邮件
     * @param {Object} emailData - 邮件数据
     * @param {string} emailData.from - 发件人邮箱
     * @param {string} emailData.to - 收件人邮箱
     * @param {string} emailData.subject - 邮件主题
     * @param {string} emailData.text - 纯文本内容（可选）
     * @param {string} emailData.html - HTML 内容（可选）
     * @param {string} emailData.replyTo - 回复地址（可选）
     * @returns {Promise<Object>} 发送结果
     */
    async sendEmail(emailData) {
        try {
            const response = await this.fetchWithTimeout(`${this.API_BASE}/api/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(emailData)
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || '发送失败'
                };
            }

            return {
                success: true,
                message: data.message,
                id: data.id,
                clientIp: data.clientIp,
                location: data.location,
                device: data.device
            };
        } catch (error) {
            console.error('发送邮件失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

// 如果需要在模块环境中使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmailAPI;
}

