/**
 * 公益平台 - 主应用逻辑
 */

const App = {
    // 状态
    state: {
        currentEmail: '',
        currentDomain: '',
        emails: [],
        sentEmails: [], // 发件箱
        outboxFilterEmail: 'all', // 发件箱过滤邮箱: 'all' 或具体邮箱地址
        selectedEmailIndex: -1,
        autoRefresh: true,
        refreshInterval: null,
        lastEmailCount: 0,
        emailHistory: [],
        viewMode: 'text' // 'text' or 'html'
    },

    // 配置
    config: {
        refreshIntervalMs: 5000, // 5秒刷新一次
        maxHistoryItems: 10,
        storageKeys: {
            currentEmail: 'infinitemail_current_email',
            emailHistory: 'infinitemail_history',
            currentDomain: 'infinitemail_domain'
        }
    },

    // DOM 元素缓存
    elements: {},

    /**
     * 初始化应用
     */
    async init() {
        console.log('\x1b[32m%s\x1b[0m', '欢迎使用公益平台');
        console.log('\x1b[90m%s\x1b[0m \x1b[36m%s\x1b[0m', 'Powered by', 'VioletTeam');
        // 艺术字蓝色科技风格
        console.log('\x1b[36m%s\x1b[0m', `
 █████   █████ █████    ███████    █████       ██████████ ███████████  
░░███   ░░███ ░░███   ███░░░░░███ ░░███       ░░███░░░░░█░█░░░███░░░█  
 ░███    ░███  ░███  ███     ░░███ ░███        ░███  █ ░ ░   ░███  ░   
 ░███    ░███  ░███ ░███      ░███ ░███        ░██████       ░███      
 ░░███   ███   ░███ ░███      ░███ ░███        ░███░░█       ░███      
  ░░░█████░    ░███ ░░███     ███  ░███      █ ░███ ░   █    ░███      
    ░░███      █████ ░░░███████░   ███████████ ██████████    █████     
     ░░░      ░░░░░    ░░░░░░░    ░░░░░░░░░░░ ░░░░░░░░░░    ░░░░░      
        `)
        console.log('\x1b[36m%s\x1b[0m', `
 ███████████ ██████████   █████████   ██████   ██████
░█░░░███░░░█░░███░░░░░█  ███░░░░░███ ░░██████ ██████ 
░   ░███  ░  ░███  █ ░  ░███    ░███  ░███░█████░███ 
    ░███     ░██████    ░███████████  ░███░░███ ░███ 
    ░███     ░███░░█    ░███░░░░░███  ░███ ░░░  ░███ 
    ░███     ░███ ░   █ ░███    ░███  ░███      ░███ 
    █████    ██████████ █████   █████ █████     █████
   ░░░░░    ░░░░░░░░░░ ░░░░░   ░░░░░ ░░░░░     ░░░░░ 
        `)
        console.log('\x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
        console.log('\x1b[35m✦ 加入我们 \x1b[0m\x1b[37m│\x1b[0m \x1b[36mVioletTeam\x1b[0m 期待你的加入！联系邮箱: \x1b[33mchf@yljdteam.com\x1b[0m');
        console.log('\x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
        // 缓存 DOM 元素
        this.cacheElements();
        
        // 绑定事件
        this.bindEvents();
        
        // 从远程加载域名列表
        await EmailAPI.loadDomains();
        
        // 自动清理 workers.dev 子域名
        await this.autoCleanWorkersDev();
        
        // 渲染域名选择器
        this.renderDomainSelector();
        
        // 从本地存储恢复状态（仅用于当前邮箱和历史记录）
        this.restoreState();
        
        // 如果没有当前邮箱，生成一个新的
        if (!this.state.currentEmail) {
            this.generateNewEmail();
        } else {
            this.updateEmailDisplay();
            this.fetchEmails();
        }
        
        // 启动自动刷新
        if (this.state.autoRefresh) {
            this.startAutoRefresh();
        }
        
        // 加载发件箱
        this.loadSentEmails();
    },

    /**
     * 缓存 DOM 元素
     */
    cacheElements() {
        this.elements = {
            // 邮箱显示
            currentEmail: document.getElementById('currentEmail'),
            emailCount: document.getElementById('emailCount'),
            refreshStatus: document.getElementById('refreshStatus'),
            inboxBadge: document.getElementById('inboxBadge'),
            
            // 控件
            domainGrid: document.getElementById('domainGrid'),
            prefixInput: document.getElementById('prefixInput'),
            generateBtn: document.getElementById('generateBtn'),
            copyEmailBtn: document.getElementById('copyEmailBtn'),
            autoRefreshToggle: document.getElementById('autoRefreshToggle'),
            manualRefreshBtn: document.getElementById('manualRefreshBtn'),
            
            // 邮件列表
            mailList: document.getElementById('mailList'),
            
            // 邮件详情模态框
            mailModal: document.getElementById('mailModal'),
            mailDetailPanel: document.getElementById('mailDetailPanel'),
            modalTitle: document.getElementById('modalTitle'),
            closeModalBtn: document.getElementById('closeModalBtn'),
            viewTextBtn: document.getElementById('viewTextBtn'),
            viewHtmlBtn: document.getElementById('viewHtmlBtn'),
            detailFrom: document.getElementById('detailFrom'),
            detailTo: document.getElementById('detailTo'),
            detailSubject: document.getElementById('detailSubject'),
            detailDate: document.getElementById('detailDate'),
            textContent: document.getElementById('textContent'),
            htmlContent: document.getElementById('htmlContent'),
            
            // 历史
            historyList: document.getElementById('historyList'),
            
            
            // 添加域名
            addDomainOpenBtn: document.getElementById('addDomainOpenBtn'),
            addDomainModal: document.getElementById('addDomainModal'),
            closeAddDomainBtn: document.getElementById('closeAddDomainBtn'),
            userDomainName: document.getElementById('userDomainName'),
            userDomainApi: document.getElementById('userDomainApi'),
            addDomainStatus: document.getElementById('addDomainStatus'),
            submitDomainBtn: document.getElementById('submitDomainBtn'),
            currentDomainsList: document.getElementById('currentDomainsList'),
            
            // Worker 代码
            viewWorkerCodeBtn: document.getElementById('viewWorkerCodeBtn'),
            workerCodeModal: document.getElementById('workerCodeModal'),
            closeWorkerCodeBtn: document.getElementById('closeWorkerCodeBtn'),
            workerCodeBlock: document.getElementById('workerCodeBlock'),
            copyWorkerCodeBtn: document.getElementById('copyWorkerCodeBtn'),
            downloadWorkerCodeBtn: document.getElementById('downloadWorkerCodeBtn'),
            serviceEmail: document.getElementById('serviceEmail'),
            serviceGitHub: document.getElementById('serviceGitHub'),
            serviceRegister: document.getElementById('serviceRegister'),
            serviceApiHtml: document.getElementById('serviceApiHtml'),
            serviceFileProxy: document.getElementById('serviceFileProxy'),
            serviceWarning: document.getElementById('serviceWarning'),
            // 数据库选择
            databaseOptions: document.getElementById('databaseOptions'),
            databaseKV: document.getElementById('databaseKV'),
            databaseOther: document.getElementById('databaseOther'),
            databaseForm: document.getElementById('databaseForm'),
            databaseApiUrl: document.getElementById('databaseApiUrl'),
            databaseWarning: document.getElementById('databaseWarning'),
            
            // GitHub 代理
            showGitHubGuideBtn: document.getElementById('showGitHubGuideBtn'),
            githubGuideModal: document.getElementById('githubGuideModal'),
            closeGithubGuideBtn: document.getElementById('closeGithubGuideBtn'),
            // GitHub 链接转换
            githubOriginalUrl: document.getElementById('githubOriginalUrl'),
            proxyDomainGrid: document.getElementById('proxyDomainGrid'),
            convertUrlBtn: document.getElementById('convertUrlBtn'),
            converterResult: document.getElementById('converterResult'),
            convertedUrl: document.getElementById('convertedUrl'),
            copyConvertedUrl: document.getElementById('copyConvertedUrl'),
            // 文件加速下载
            showFileProxyBtn: document.getElementById('showFileProxyBtn'),
            fileProxyModal: document.getElementById('fileProxyModal'),
            closeFileProxyBtn: document.getElementById('closeFileProxyBtn'),
            fileProxyUrl: document.getElementById('fileProxyUrl'),
            fileProxyDomainGrid: document.getElementById('fileProxyDomainGrid'),
            convertFileUrlBtn: document.getElementById('convertFileUrlBtn'),
            fileProxyResult: document.getElementById('fileProxyResult'),
            convertedFileUrl: document.getElementById('convertedFileUrl'),
            copyConvertedFileUrl: document.getElementById('copyConvertedFileUrl'),
            
            // Docker 加速
            showDockerBtn: document.getElementById('showDockerBtn'),
            dockerModal: document.getElementById('dockerModal'),
            closeDockerBtn: document.getElementById('closeDockerBtn'),
            serviceDocker: document.getElementById('serviceDocker'),
            dockerProxyConfig: document.getElementById('dockerProxyConfig'),
            dockerProxyServer: document.getElementById('dockerProxyServer'),
            
            // Toast
            toastContainer: document.getElementById('toastContainer'),
            
            // 右键菜单
            contextMenu: document.getElementById('contextMenu'),
            contextMenuDelete: document.getElementById('contextMenuDelete'),
            
            // 发送邮件
            sendEmailOpenBtn: document.getElementById('sendEmailOpenBtn'),
            sendEmailModal: document.getElementById('sendEmailModal'),
            closeSendEmailModalBtn: document.getElementById('closeSendEmailModalBtn'),
            cancelSendEmailBtn: document.getElementById('cancelSendEmailBtn'),
            submitSendEmailBtn: document.getElementById('submitSendEmailBtn'),
            sendEmailFrom: document.getElementById('sendEmailFrom'),
            sendEmailTo: document.getElementById('sendEmailTo'),
            sendEmailSubject: document.getElementById('sendEmailSubject'),
            sendEmailText: document.getElementById('sendEmailText'),
            sendEmailHtml: document.getElementById('sendEmailHtml'),
            sendEmailReplyTo: document.getElementById('sendEmailReplyTo'),
            sendEmailStatus: document.getElementById('sendEmailStatus'),
            toggleTextBtn: document.getElementById('toggleTextBtn'),
            toggleHtmlBtn: document.getElementById('toggleHtmlBtn'),
            sendEmailPrefix: document.getElementById('sendEmailPrefix'),
            randomSenderBtn: document.getElementById('randomSenderBtn'),
            outboxList: document.getElementById('outboxList'),
            outboxBadge: document.getElementById('outboxBadge'),
            outboxEmailSelector: document.getElementById('outboxEmailSelector'),
            outboxCurrentEmail: document.getElementById('outboxCurrentEmail'),
            outboxDropdown: document.getElementById('outboxDropdown')
        };
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        // 生成新邮箱
        this.elements.generateBtn.addEventListener('click', () => {
            this.generateNewEmail();
        });

        // 复制邮箱
        this.elements.copyEmailBtn.addEventListener('click', () => {
            this.copyCurrentEmail();
        });

        // 自动刷新开关
        this.elements.autoRefreshToggle.addEventListener('change', (e) => {
            this.toggleAutoRefresh(e.target.checked);
        });

        // 手动刷新
        this.elements.manualRefreshBtn.addEventListener('click', () => {
            this.fetchEmails();
        });

        // 关闭模态框
        this.elements.closeModalBtn.addEventListener('click', () => {
            this.hideEmailDetail();
        });

        // 点击遮罩层关闭
        this.elements.mailModal.addEventListener('click', (e) => {
            if (e.target === this.elements.mailModal) {
                this.hideEmailDetail();
            }
        });

        // 视图切换
        this.elements.viewTextBtn.addEventListener('click', () => {
            this.setViewMode('text');
        });

        this.elements.viewHtmlBtn.addEventListener('click', () => {
            this.setViewMode('html');
        });

        // AI 翻译按钮
        const translateBtn = document.getElementById('translateBtn');
        if (translateBtn) {
            translateBtn.addEventListener('click', () => {
                this.translateEmail('zh');
            });
        }

        // 发送邮件（左侧面板按钮）
        this.elements.sendEmailOpenBtn.addEventListener('click', () => {
            this.showSendEmailModal();
        });

        this.elements.closeSendEmailModalBtn.addEventListener('click', () => {
            this.hideSendEmailModal();
        });

        this.elements.cancelSendEmailBtn.addEventListener('click', () => {
            this.hideSendEmailModal();
        });

        this.elements.sendEmailModal.addEventListener('click', (e) => {
            if (e.target === this.elements.sendEmailModal) {
                this.hideSendEmailModal();
            }
        });

        this.elements.submitSendEmailBtn.addEventListener('click', () => {
            this.submitSendEmail();
        });

        // 邮件内容格式切换
        this.elements.toggleTextBtn.addEventListener('click', () => {
            this.elements.toggleTextBtn.classList.add('active');
            this.elements.toggleHtmlBtn.classList.remove('active');
            this.elements.sendEmailText.style.display = 'block';
            this.elements.sendEmailHtml.style.display = 'none';
        });

        this.elements.toggleHtmlBtn.addEventListener('click', () => {
            this.elements.toggleHtmlBtn.classList.add('active');
            this.elements.toggleTextBtn.classList.remove('active');
            this.elements.sendEmailHtml.style.display = 'block';
            this.elements.sendEmailText.style.display = 'none';
        });

        // 随机生成发件人用户名
        this.elements.randomSenderBtn.addEventListener('click', () => {
            this.elements.sendEmailPrefix.value = Utils.generateRandomString(10);
        });

        // 发件箱邮箱选择器
        if (this.elements.outboxEmailSelector) {
            this.elements.outboxEmailSelector.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleOutboxDropdown();
            });
        }

        // 点击其他地方关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.outbox-email-selector') && !e.target.closest('.outbox-dropdown')) {
                this.hideOutboxDropdown();
            }
        });

        // 回车生成邮箱
        this.elements.prefixInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.generateNewEmail();
            }
        });


        // 添加域名模态框
        this.elements.addDomainOpenBtn.addEventListener('click', () => {
            this.showAddDomainModal();
        });

        this.elements.closeAddDomainBtn.addEventListener('click', () => {
            this.hideAddDomainModal();
        });

        this.elements.addDomainModal.addEventListener('click', (e) => {
            if (e.target === this.elements.addDomainModal) {
                this.hideAddDomainModal();
            }
        });

        this.elements.submitDomainBtn.addEventListener('click', () => {
            this.submitNewDomain();
        });

        // 自动填充 API 地址（跟随域名同步更新）
        this.elements.userDomainName.addEventListener('input', (e) => {
            const domain = e.target.value.trim();
            if (domain) {
                this.elements.userDomainApi.value = `https://${domain}`;
            } else {
                this.elements.userDomainApi.value = '';
            }
        });

        // Worker 代码模态框
        this.elements.viewWorkerCodeBtn.addEventListener('click', () => {
            this.showWorkerCodeModal();
        });

        // API 文档按钮
        const viewApiDocBtn = document.getElementById('viewApiDocBtn');
        if (viewApiDocBtn) {
            viewApiDocBtn.addEventListener('click', () => {
                // 获取当前域名，打开 API 文档页面
                const currentDomain = this.state.currentEmail?.split('@')[1];
                if (currentDomain) {
                    window.open(`https://${currentDomain}/`, '_blank');
                } else {
                    // 如果没有当前域名，使用第一个可用域名
                    const domains = this.state.domains || [];
                    if (domains.length > 0) {
                        window.open(`https://${domains[0].name}/`, '_blank');
                    } else {
                        // 使用当前页面的域名
                        window.open(`${window.location.origin}/`, '_blank');
                    }
                }
            });
        }

        this.elements.closeWorkerCodeBtn.addEventListener('click', () => {
            this.hideWorkerCodeModal();
        });

        this.elements.workerCodeModal.addEventListener('click', (e) => {
            if (e.target === this.elements.workerCodeModal) {
                this.hideWorkerCodeModal();
            }
        });

        this.elements.copyWorkerCodeBtn.addEventListener('click', async () => {
            const success = await Utils.copyToClipboard(this.getWorkerCode());
            if (success) {
                this.showToast('success', '已复制', 'Worker 代码已复制到剪贴板');
            }
        });

        this.elements.downloadWorkerCodeBtn.addEventListener('click', () => {
            this.downloadWorkerCode();
        });

        // GitHub 代理使用说明模态框
        this.elements.showGitHubGuideBtn.addEventListener('click', () => {
            this.showGitHubGuideModal();
        });

        this.elements.closeGithubGuideBtn.addEventListener('click', () => {
            this.hideGitHubGuideModal();
        });

        this.elements.githubGuideModal.addEventListener('click', (e) => {
            if (e.target === this.elements.githubGuideModal) {
                this.hideGitHubGuideModal();
            }
        });

        // 文件加速下载模态框
        if (this.elements.showFileProxyBtn) {
            this.elements.showFileProxyBtn.addEventListener('click', () => {
                this.showFileProxyModal();
            });
        }

        if (this.elements.closeFileProxyBtn) {
            this.elements.closeFileProxyBtn.addEventListener('click', () => {
                this.hideFileProxyModal();
            });
        }

        if (this.elements.fileProxyModal) {
            this.elements.fileProxyModal.addEventListener('click', (e) => {
                if (e.target === this.elements.fileProxyModal) {
                    this.hideFileProxyModal();
                }
            });
        }

        // Docker 加速模态框
        if (this.elements.showDockerBtn) {
            this.elements.showDockerBtn.addEventListener('click', () => {
                this.showDockerModal();
            });
        }

        if (this.elements.closeDockerBtn) {
            this.elements.closeDockerBtn.addEventListener('click', () => {
                this.hideDockerModal();
            });
        }

        if (this.elements.dockerModal) {
            this.elements.dockerModal.addEventListener('click', (e) => {
                if (e.target === this.elements.dockerModal) {
                    this.hideDockerModal();
                }
            });
        }

        // 短链接模态框
        const showShortLinkBtn = document.getElementById('showShortLinkBtn');
        const shortLinkModal = document.getElementById('shortLinkModal');
        const closeShortLinkBtn = document.getElementById('closeShortLinkBtn');
        const createShortLinkBtn = document.getElementById('createShortLinkBtn');
        const copyShortLinkBtn = document.getElementById('copyShortLinkBtn');

        if (showShortLinkBtn) {
            showShortLinkBtn.addEventListener('click', () => {
                this.showShortLinkModal();
            });
        }

        if (closeShortLinkBtn) {
            closeShortLinkBtn.addEventListener('click', () => {
                this.hideShortLinkModal();
            });
        }

        if (shortLinkModal) {
            shortLinkModal.addEventListener('click', (e) => {
                if (e.target === shortLinkModal) {
                    this.hideShortLinkModal();
                }
            });
        }

        if (createShortLinkBtn) {
            createShortLinkBtn.addEventListener('click', () => {
                this.createShortLink();
            });
        }

        if (copyShortLinkBtn) {
            copyShortLinkBtn.addEventListener('click', async () => {
                const url = document.getElementById('shortLinkResultUrl').value;
                const success = await Utils.copyToClipboard(url);
                if (success) {
                    this.showToast('success', '已复制', '短链接已复制到剪贴板');
                }
            });
        }

        // GitHub 示例复制按钮
        document.querySelectorAll('.btn-copy-inline[data-copy]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const targetId = btn.dataset.copy;
                const codeEl = document.getElementById(targetId);
                if (codeEl) {
                    const success = await Utils.copyToClipboard(codeEl.textContent);
                    if (success) {
                        this.showToast('success', '已复制', '命令已复制到剪贴板');
                    }
                }
            });
        });

        // 代理 IP 复制按钮
        document.querySelectorAll('.btn-copy-proxy').forEach(btn => {
            btn.addEventListener('click', async () => {
                const proxy = btn.dataset.proxy;
                if (proxy) {
                    const success = await Utils.copyToClipboard(proxy);
                    if (success) {
                        this.showToast('success', '已复制', '代理地址已复制到剪贴板');
                    }
                }
            });
        });

        // 代理使用详情模态框
        const proxyUsageModal = document.getElementById('proxyUsageModal');
        const showProxyUsageBtn = document.getElementById('showProxyUsageBtn');
        const closeProxyUsageBtn = document.getElementById('closeProxyUsageBtn');
        const copyProxyCodeBtn = document.getElementById('copyProxyCodeBtn');
        
        if (showProxyUsageBtn && proxyUsageModal) {
            showProxyUsageBtn.addEventListener('click', () => {
                proxyUsageModal.classList.add('active');
            });
            
            closeProxyUsageBtn.addEventListener('click', () => {
                proxyUsageModal.classList.remove('active');
            });
            
            proxyUsageModal.addEventListener('click', (e) => {
                if (e.target === proxyUsageModal) {
                    proxyUsageModal.classList.remove('active');
                }
            });
            
            // 代码标签切换
            document.querySelectorAll('.code-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    const lang = tab.dataset.lang;
                    document.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    
                    document.querySelectorAll('.code-content .code-block').forEach(block => {
                        block.style.display = 'none';
                    });
                    const codeBlock = document.getElementById('proxyCode' + lang.charAt(0).toUpperCase() + lang.slice(1));
                    if (codeBlock) {
                        codeBlock.style.display = 'block';
                    }
                });
            });
            
            // 复制代码
            if (copyProxyCodeBtn) {
                copyProxyCodeBtn.addEventListener('click', async () => {
                    const activeBlock = document.querySelector('.code-content .code-block[style*="display: block"], .code-content .code-block:not([style*="display: none"]):not([style])');
                    if (activeBlock) {
                        const success = await Utils.copyToClipboard(activeBlock.textContent);
                        if (success) {
                            this.showToast('success', '已复制', '代码已复制到剪贴板');
                        }
                    }
                });
            }
        }

        // DNS 管理模态框
        const subdomainModal = document.getElementById('subdomainModal');
        const showSubdomainBtn = document.getElementById('showSubdomainBtn');
        const closeSubdomainBtn = document.getElementById('closeSubdomainBtn');
        const createDnsBtn = document.getElementById('createDnsBtn');
        const dnsSubdomain = document.getElementById('dnsSubdomain');
        const dnsType = document.getElementById('dnsType');
        const dnsValue = document.getElementById('dnsValue');
        const dnsTtl = document.getElementById('dnsTtl');
        const dnsPriority = document.getElementById('dnsPriority');
        const dnsPriorityRow = document.getElementById('dnsPriorityRow');
        const dnsOwnerEmail = document.getElementById('dnsOwnerEmail');
        const dnsStatus = document.getElementById('dnsStatus');
        const dnsResult = document.getElementById('dnsResult');
        const resultDetails = document.getElementById('resultDetails');
        const dnsValueLabel = document.getElementById('dnsValueLabel');
        const dnsValueHint = document.getElementById('dnsValueHint');
        const dnsProxied = document.getElementById('dnsProxied');
        const proxyStatus = document.getElementById('proxyStatus');
        
        // 记录类型配置
        const dnsTypeConfig = {
            'A': { label: 'IPv4 地址', placeholder: '192.168.1.1', hint: '输入 IPv4 地址' },
            'AAAA': { label: 'IPv6 地址', placeholder: '2001:db8::1', hint: '输入 IPv6 地址' },
            'CNAME': { label: '目标域名', placeholder: 'example.com', hint: '输入目标域名（不含 http://）' },
            'MX': { label: '邮件服务器', placeholder: 'mail.example.com', hint: '输入邮件服务器域名', showPriority: true },
            'TXT': { label: '文本内容', placeholder: 'v=spf1 include:_spf.google.com ~all', hint: '输入文本记录内容' },
            'REDIRECT': { label: '目标网址', placeholder: 'https://example.com', hint: '访问子域名时将跳转到此网址' }
        };
        
        if (showSubdomainBtn && subdomainModal) {
            // 打开模态框
            showSubdomainBtn.addEventListener('click', () => {
                subdomainModal.classList.add('active');
                dnsResult.style.display = 'none';
            });
            
            // 关闭模态框
            closeSubdomainBtn.addEventListener('click', () => {
                subdomainModal.classList.remove('active');
            });
            
            subdomainModal.addEventListener('click', (e) => {
                if (e.target === subdomainModal) {
                    subdomainModal.classList.remove('active');
                }
            });
            
            // 代理选项切换
            if (dnsProxied && proxyStatus) {
                const updateProxyStatus = () => {
                    if (dnsProxied.checked) {
                        proxyStatus.innerHTML = '<span class="proxy-on">代理已开启</span>';
                    } else {
                        proxyStatus.innerHTML = '<span class="proxy-off">仅 DNS</span>';
                    }
                };
                dnsProxied.addEventListener('change', updateProxyStatus);
                updateProxyStatus();
            }
            
            // 记录类型切换
            if (dnsType) {
                dnsType.addEventListener('change', () => {
                    const type = dnsType.value;
                    const config = dnsTypeConfig[type] || dnsTypeConfig['REDIRECT'];
                    
                    dnsValueLabel.textContent = config.label;
                    dnsValue.placeholder = config.placeholder;
                    dnsValueHint.textContent = config.hint;
                    
                    // 根据类型自动设置代理选项
                    if (dnsProxied && proxyStatus) {
                        const canProxy = ['A', 'AAAA', 'CNAME'].includes(type);
                        dnsProxied.disabled = !canProxy;
                        if (!canProxy) {
                            dnsProxied.checked = false;
                            proxyStatus.innerHTML = '<span class="proxy-off">此记录类型不支持代理</span>';
                        } else {
                            dnsProxied.checked = true;
                            proxyStatus.innerHTML = '<span class="proxy-on">代理已开启</span>';
                        }
                    }
                    
                    // 显示/隐藏优先级
                    if (config.showPriority) {
                        dnsPriorityRow.style.display = 'block';
                    } else {
                        dnsPriorityRow.style.display = 'none';
                    }
                });
            }
            
            // 实时检查子域名可用性
            let checkTimer = null;
            if (dnsSubdomain) {
                dnsSubdomain.addEventListener('input', () => {
                    const subdomain = dnsSubdomain.value.toLowerCase().trim();
                    
                    if (checkTimer) clearTimeout(checkTimer);
                    
                    if (!subdomain || subdomain === '@') {
                        dnsStatus.innerHTML = subdomain === '@' ? '<span class="status-available">根域名</span>' : '';
                        return;
                    }
                    
                    if (subdomain.length < 2) {
                        dnsStatus.innerHTML = '<span class="status-error">至少需要 2 个字符</span>';
                        return;
                    }
                    
                    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]?$/.test(subdomain)) {
                        dnsStatus.innerHTML = '<span class="status-error">只能包含字母、数字和连字符</span>';
                        return;
                    }
                    
                    dnsStatus.innerHTML = '<span class="status-checking">检查中...</span>';
                    
                    checkTimer = setTimeout(async () => {
                        try {
                            const domain = dnsDomain ? dnsDomain.value : 'lovefreetools.site';
                            const resp = await fetch(`${EmailAPI.API_BASE}/api/dns/check/${subdomain}?domain=${encodeURIComponent(domain)}`);
                            const data = await resp.json();
                            
                            if (data.available) {
                                dnsStatus.innerHTML = '<span class="status-available">可以使用</span>';
                            } else {
                                dnsStatus.innerHTML = `<span class="status-error">${data.reason || '不可用'}</span>`;
                            }
                        } catch (error) {
                            dnsStatus.innerHTML = '<span class="status-error">检查失败</span>';
                        }
                    }, 500);
                });
            }
            
            // 创建 DNS 记录
            createDnsBtn.addEventListener('click', async () => {
                const subdomain = dnsSubdomain.value.toLowerCase().trim() || '@';
                const domain = dnsDomain ? dnsDomain.value : 'lovefreetools.site';
                const type = dnsType.value;
                const value = dnsValue.value.trim();
                const ttl = parseInt(dnsTtl.value) || 3600;
                const priority = parseInt(dnsPriority.value) || 0;
                const ownerEmail = dnsOwnerEmail ? dnsOwnerEmail.value.trim() : '';
                const proxied = dnsProxied ? dnsProxied.checked : true;
                const dnsUserKey = document.getElementById('dnsUserKey');
                const userKey = dnsUserKey ? dnsUserKey.value : '';
                
                if (!value) {
                    this.showToast('error', '错误', '请输入记录值');
                    return;
                }
                
                if (!userKey || userKey.length < 6) {
                    this.showToast('error', '错误', '请输入至少6位的管理密钥');
                    return;
                }
                
                createDnsBtn.disabled = true;
                createDnsBtn.innerHTML = '<span class="loading-spinner"></span> 创建中...';
                
                try {
                    const resp = await fetch(`${EmailAPI.API_BASE}/api/dns`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ subdomain, domain, type, value, ttl, priority, ownerEmail, proxied, userKey })
                    });
                    
                    const data = await resp.json();
                    
                    if (data.success) {
                        const fullDomain = data.record.fullDomain;
                        this.showToast('success', '创建成功', `DNS 记录已添加`);
                        
                        // 显示结果
                        resultDetails.innerHTML = `
                            <div class="result-record">
                                <span class="result-type">${type}</span>
                                <span class="result-name">${fullDomain}</span>
                                <span class="result-arrow">→</span>
                                <span class="result-value">${value}</span>
                            </div>
                        `;
                        dnsResult.style.display = 'block';
                        
                        // 清空输入
                        dnsSubdomain.value = '';
                        dnsValue.value = '';
                        dnsStatus.innerHTML = '';
                    } else {
                        this.showToast('error', '创建失败', data.error || '未知错误');
                    }
                } catch (error) {
                    console.error('创建 DNS 记录失败:', error);
                    this.showToast('error', '创建失败', error.message);
                } finally {
                    createDnsBtn.disabled = false;
                    createDnsBtn.innerHTML = `
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        添加记录
                    `;
                    // 刷新记录列表
                    loadDnsRecords();
                }
            });
        }
        
        // 加载 DNS 记录列表
        const dnsRecordsList = document.getElementById('dnsRecordsList');
        const refreshDnsRecordsBtn = document.getElementById('refreshDnsRecords');
        
        const loadDnsRecords = async () => {
            if (!dnsRecordsList) return;
            
            dnsRecordsList.innerHTML = '<div class="loading-placeholder">加载中...</div>';
            
            try {
                const resp = await fetch(`${EmailAPI.API_BASE}/api/dns/public/list`);
                const data = await resp.json();
                
                if (data.success && data.records && data.records.length > 0) {
                    dnsRecordsList.innerHTML = data.records.map(record => `
                        <div class="dns-record-item" data-record-id="${record.id}">
                            <span class="record-status ${record.realDns ? 'real-dns' : 'local-only'}" 
                                  title="${record.realDns ? 'Cloudflare DNS 已生效' : '仅本地记录'}"></span>
                            <span class="record-type-badge type-${record.type.toLowerCase()}">${record.type}</span>
                            <span class="record-domain" title="${record.fullDomain}">${record.fullDomain}</span>
                            <span class="record-value" title="${record.value}">${record.value}</span>
                            <button class="delete-record-btn" data-id="${record.id}" title="删除记录">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                            </button>
                        </div>
                    `).join('');
                    
                    // 绑定删除事件
                    dnsRecordsList.querySelectorAll('.delete-record-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const recordId = btn.dataset.id;
                            const userKey = prompt('请输入管理密钥以删除此记录：');
                            if (!userKey) return;
                            
                            try {
                                const resp = await fetch(`${EmailAPI.API_BASE}/api/dns/user/${recordId}`, {
                                    method: 'DELETE',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ userKey })
                                });
                                const result = await resp.json();
                                
                                if (result.success) {
                                    EmailApp.showToast('success', '删除成功', '记录已删除');
                                    loadDnsRecords();
                                } else {
                                    EmailApp.showToast('error', '删除失败', result.error || '密钥错误');
                                }
                            } catch (error) {
                                console.error('删除失败:', error);
                                EmailApp.showToast('error', '删除失败', error.message);
                            }
                        });
                    });
                } else {
                    dnsRecordsList.innerHTML = '<div class="no-records">暂无记录</div>';
                }
            } catch (error) {
                console.error('加载 DNS 记录失败:', error);
                dnsRecordsList.innerHTML = '<div class="no-records">加载失败</div>';
            }
        };
        
        // 刷新按钮
        if (refreshDnsRecordsBtn) {
            refreshDnsRecordsBtn.addEventListener('click', loadDnsRecords);
        }
        
        // 初始加载
        loadDnsRecords();

        // GitHub 链接转换
        this.elements.convertUrlBtn.addEventListener('click', () => {
            this.convertGitHubUrl();
        });

        this.elements.githubOriginalUrl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.convertGitHubUrl();
            }
        });

        this.elements.copyConvertedUrl.addEventListener('click', async () => {
            const url = this.elements.convertedUrl.textContent;
            const success = await Utils.copyToClipboard(url);
            if (success) {
                this.showToast('success', '已复制', '代理链接已复制到剪贴板');
            }
        });

        // 文件加速下载转换
        if (this.elements.convertFileUrlBtn) {
            this.elements.convertFileUrlBtn.addEventListener('click', () => {
                this.convertFileProxyUrl();
            });
        }
        
        if (this.elements.fileProxyUrl) {
            this.elements.fileProxyUrl.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.convertFileProxyUrl();
                }
            });
        }
        
        if (this.elements.copyConvertedFileUrl) {
            this.elements.copyConvertedFileUrl.addEventListener('click', async () => {
                const url = this.elements.convertedFileUrl.textContent;
                const success = await Utils.copyToClipboard(url);
                if (success) {
                    this.showToast('success', '已复制', '加速链接已复制到剪贴板');
                }
            });
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            // Ctrl+C 复制邮箱（当没有选中文本时）
            if (e.ctrlKey && e.key === 'c' && !window.getSelection().toString()) {
                e.preventDefault();
                this.copyCurrentEmail();
            }
            
            // ESC 关闭模态框和右键菜单
            if (e.key === 'Escape') {
                this.hideEmailDetail();
                this.hideAddDomainModal();
                this.hideWorkerCodeModal();
                this.hideGitHubGuideModal();
                this.hideFileProxyModal();
                this.hideDockerModal();
                this.hideSendEmailModal();
                this.hideContextMenu();
            }
            
            // R 刷新
            if (e.key === 'r' && !e.ctrlKey && document.activeElement.tagName !== 'INPUT') {
                this.fetchEmails();
            }
        });

        // 右键菜单
        if (this.elements.contextMenuDelete) {
            this.elements.contextMenuDelete.addEventListener('click', () => {
                const menu = this.elements.contextMenu;
                if (menu && menu.dataset.index !== undefined) {
                    const index = parseInt(menu.dataset.index);
                    const type = menu.dataset.type || 'inbox';
                    this.hideContextMenu();
                    
                    if (type === 'sent') {
                        this.deleteSentEmail(index);
                    } else {
                        const emailId = menu.dataset.emailId;
                        this.deleteEmail(index, emailId);
                    }
                }
            });
        }

        // 点击外部区域关闭右键菜单
        document.addEventListener('click', (e) => {
            if (this.elements.contextMenu && 
                !this.elements.contextMenu.contains(e.target) &&
                this.elements.contextMenu.style.display === 'block') {
                this.hideContextMenu();
            }
        });
    },

    /**
     * 渲染域名选择器
     */
    renderDomainSelector() {
        const domains = EmailAPI.getDomains();
        const currentDomain = (this.state.currentDomain || domains[0].name).replace(/\/+$/, '');
        
        this.elements.domainGrid.innerHTML = domains.map((domain, index) => {
            const cleanName = domain.name.replace(/\/+$/, '');
            return `
            <button class="domain-btn ${cleanName === currentDomain ? 'active' : ''}" 
                    data-domain="${cleanName}" 
                    data-index="${index}">
                ${cleanName}
            </button>
        `;
        }).join('');

        // 绑定点击事件
        this.elements.domainGrid.querySelectorAll('.domain-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const domainName = btn.dataset.domain;
                this.selectDomain(domainName);
            });
        });
    },

    /**
     * 选择域名
     */
    selectDomain(domainName) {
        this.state.currentDomain = domainName;
        EmailAPI.setCurrentDomainByName(domainName);
        
        // 更新UI
        this.elements.domainGrid.querySelectorAll('.domain-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.domain === domainName);
        });
        
        // 保存到本地存储
        Utils.setStorage(this.config.storageKeys.currentDomain, domainName);
        
        // 如果有当前邮箱，更新域名
        if (this.state.currentEmail) {
            const prefix = Utils.parseEmail(this.state.currentEmail).prefix;
            this.state.currentEmail = `${prefix}@${domainName}`;
            this.updateEmailDisplay();
            this.saveCurrentEmail();
            this.fetchEmails();
        }
    },

    /**
     * 生成新邮箱
     */
    generateNewEmail() {
        const prefix = this.elements.prefixInput.value.trim();
        const domain = this.state.currentDomain || EmailAPI.getCurrentDomain().name;
        
        // 生成邮箱
        const email = Utils.generateEmail(prefix, domain);
        
        // 保存旧邮箱到历史
        if (this.state.currentEmail && this.state.currentEmail !== email) {
            this.addToHistory(this.state.currentEmail);
        }
        
        // 更新状态
        this.state.currentEmail = email;
        this.state.currentDomain = domain;
        this.state.emails = [];
        this.state.lastEmailCount = 0;
        this.state.selectedEmailIndex = -1;
        
        // 更新UI
        this.updateEmailDisplay();
        this.renderMailList();
        this.hideEmailDetail();
        
        // 保存到本地存储
        this.saveCurrentEmail();
        
        // 清空输入框
        this.elements.prefixInput.value = '';
        
        // 立即获取邮件
        this.fetchEmails();
        
        // 显示提示
        this.showToast('success', '邮箱已生成', email);
    },

    /**
     * 更新邮箱显示
     */
    updateEmailDisplay() {
        const { prefix, domain } = Utils.parseEmail(this.state.currentEmail);
        
        this.elements.currentEmail.innerHTML = `
            <span class="email-prefix">${Utils.escapeHtml(prefix)}</span>
            <span class="email-at">@</span>
            <span class="email-domain">${Utils.escapeHtml(domain)}</span>
        `;
    },

    /**
     * 复制当前邮箱
     */
    async copyCurrentEmail() {
        if (!this.state.currentEmail) return;
        
        const success = await Utils.copyToClipboard(this.state.currentEmail);
        
        if (success) {
            this.showToast('success', '已复制', this.state.currentEmail);
        } else {
            this.showToast('error', '复制失败', '请手动复制');
        }
    },

    /**
     * 获取邮件
     */
    async fetchEmails() {
        if (!this.state.currentEmail) return;
        
        // 更新状态显示
        this.elements.refreshStatus.innerHTML = '<span class="loading"></span> 刷新中...';
        
        try {
            const result = await EmailAPI.getEmails(this.state.currentEmail);
            
            if (result.success) {
                const oldCount = this.state.lastEmailCount;
                const newCount = result.count;
                
                // 检查是否有新邮件
                if (newCount > oldCount && oldCount > 0) {
                    const diff = newCount - oldCount;
                    this.showToast('info', '新邮件', `收到 ${diff} 封新邮件`);
                    
                    // 播放通知音（如果支持）
                    this.playNotificationSound();
                }
                
                // 更新状态
                this.state.emails = result.emails;
                this.state.lastEmailCount = newCount;
                
                // 更新UI
                this.renderMailList();
                this.updateEmailCount();
                
                this.elements.refreshStatus.textContent = '自动刷新中...';
            } else {
                this.elements.refreshStatus.textContent = '刷新失败';
                console.error('获取邮件失败:', result.error);
            }
        } catch (error) {
            this.elements.refreshStatus.textContent = '刷新出错';
            console.error('获取邮件异常:', error);
        }
    },

    /**
     * 渲染邮件列表
     */
    renderMailList() {
        if (this.state.emails.length === 0) {
            this.elements.mailList.innerHTML = `
                <div class="empty-state">
                    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
                        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                    </svg>
                    <p>收件箱为空</p>
                    <span>等待接收邮件...</span>
                </div>
            `;
            return;
        }

        this.elements.mailList.innerHTML = this.state.emails.map((email, index) => {
            const isActive = index === this.state.selectedEmailIndex;
            const avatarText = Utils.getAvatarText(email.from);
            const displayName = Utils.getDisplayName(email.from);
            const formattedDate = Utils.formatDate(email.date);
            const emailId = email.id || index; // MySQL 使用 id，KV 使用索引
            
            // 优先使用 AI 提取的验证码，否则使用正则提取
            const verificationCode = email.verificationCode || Utils.extractVerificationCode(email.text || '', email.html || '');
            
            // AI 分析结果
            const isSpam = email.isSpam || false;
            const summary = email.summary || '';
            const isAICode = !!email.verificationCode; // 是否为 AI 提取的验证码
            
            return `
                <div class="mail-item-wrapper" data-index="${index}" data-email-id="${emailId}">
                    <div class="mail-item ${isActive ? 'active' : ''} ${index === 0 ? 'new' : ''} ${verificationCode ? 'has-code' : ''} ${isSpam ? 'is-spam' : ''}">
                    <div class="mail-from">
                        <div class="avatar">${Utils.escapeHtml(avatarText)}</div>
                        <span>${Utils.escapeHtml(Utils.truncate(displayName, 30))}</span>
                        ${isSpam ? '<span class="spam-badge">垃圾</span>' : ''}
                    </div>
                    <div class="mail-subject">${Utils.escapeHtml(email.subject || '(无主题)')}</div>
                    ${summary ? `<div class="mail-summary">${Utils.escapeHtml(Utils.truncate(summary, 40))}</div>` : ''}
                    <div class="mail-time">${formattedDate}</div>
                        ${verificationCode ? `
                            <div class="mail-verification-code ${isAICode ? 'ai-extracted' : ''}" data-code="${Utils.escapeHtml(verificationCode)}">
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                                <span class="code-text">${Utils.escapeHtml(verificationCode)}</span>
                                <span class="code-hint">点击复制</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="mail-item-delete">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </div>
                </div>
            `;
        }).join('');

        // 绑定事件
        this.elements.mailList.querySelectorAll('.mail-item-wrapper').forEach(wrapper => {
            const item = wrapper.querySelector('.mail-item');
            const index = parseInt(wrapper.dataset.index);
            const emailId = wrapper.dataset.emailId;
            
            // 点击查看详情
            item.addEventListener('click', (e) => {
                // 如果点击的是验证码区域，不显示详情
                if (e.target.closest('.mail-verification-code')) {
                    return;
                }
                // 只有在没有滑动操作时才显示详情
                if (!wrapper.classList.contains('swiping') && !wrapper.dataset.hasSwiped) {
                this.showEmailDetail(index);
                }
                // 清除滑动标记
                delete wrapper.dataset.hasSwiped;
            });
            
            // 验证码点击复制
            const codeElement = item.querySelector('.mail-verification-code');
            if (codeElement) {
                codeElement.addEventListener('click', async (e) => {
                    e.stopPropagation(); // 阻止触发邮件详情
                    const code = codeElement.dataset.code;
                    if (code) {
                        const success = await Utils.copyToClipboard(code);
                        if (success) {
                            this.showToast('success', '已复制', `验证码 ${code} 已复制到剪贴板`);
                            // 添加复制成功动画
                            codeElement.classList.add('copied');
                            setTimeout(() => {
                                codeElement.classList.remove('copied');
                            }, 1000);
                        }
                    }
                });
            }
            
            // 右键菜单
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e, index, emailId);
            });
            
            // 滑动删除
            this.initSwipeDelete(wrapper, index, emailId);
        });
    },

    /**
     * 显示右键菜单
     */
    showContextMenu(e, index, emailId) {
        const menu = this.elements.contextMenu;
        if (!menu) return;
        
        // 隐藏之前的菜单
        this.hideContextMenu();
        
        // 设置菜单位置
        const x = e.clientX;
        const y = e.clientY;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';
        menu.dataset.index = index;
        menu.dataset.emailId = emailId;
        
        // 确保菜单不超出视口
        setTimeout(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                menu.style.left = `${window.innerWidth - rect.width - 10}px`;
            }
            if (rect.bottom > window.innerHeight) {
                menu.style.top = `${window.innerHeight - rect.height - 10}px`;
            }
        }, 0);
    },

    /**
     * 隐藏右键菜单
     */
    hideContextMenu() {
        const menu = this.elements.contextMenu;
        if (menu) {
            menu.style.display = 'none';
            delete menu.dataset.index;
            delete menu.dataset.emailId;
        }
    },

    /**
     * 初始化滑动删除
     */
    initSwipeDelete(wrapper, index, emailId) {
        const deleteWidth = 80;
        const minSwipeDistance = 10; // 最小滑动距离，避免误触
        const minPressTime = 100; // 最小长按时间（毫秒）
        
        const item = wrapper.querySelector('.mail-item');
        
        // 触摸事件变量
        let touchStartX = 0;
        let touchCurrentX = 0;
        let isDragging = false;
        let touchHasMoved = false;
        
        // 触摸开始
        item.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            isDragging = true;
            touchHasMoved = false;
            // 不立即添加 swiping 类，等检测到实际移动后再添加
        }, { passive: true });
        
        // 触摸移动
        item.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            touchCurrentX = e.touches[0].clientX;
            const diff = touchCurrentX - touchStartX;
            
            // 如果移动距离超过阈值，标记为已移动并添加 swiping 类
            if (Math.abs(diff) > minSwipeDistance) {
                if (!touchHasMoved) {
                    touchHasMoved = true;
                    wrapper.dataset.hasSwiped = 'true';
                    wrapper.classList.add('swiping');
                    // 停止自动刷新，避免误删除
                    if (this.state.autoRefresh) {
                        this.stopAutoRefresh();
                        wrapper.dataset.wasAutoRefresh = 'true';
                    }
                }
            }
            
            // 只允许向左滑动
            if (diff < 0) {
                const translateX = Math.max(diff, -deleteWidth);
                item.style.transform = `translateX(${translateX}px)`;
            }
        }, { passive: true });
        
        // 触摸结束
        item.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            
            const diff = touchCurrentX - touchStartX;
            const wasAutoRefresh = wrapper.dataset.wasAutoRefresh === 'true';
            
            // 只有真正滑动过且超过一半才删除
            if (touchHasMoved && diff < -deleteWidth / 2) {
                // 删除邮件（删除函数内部会处理自动刷新）
                this.deleteEmail(index, emailId, wasAutoRefresh);
            } else {
                // 否则恢复原位置
                item.style.transform = '';
                // 恢复自动刷新
                if (wasAutoRefresh && this.state.autoRefresh) {
                    setTimeout(() => {
                        if (this.state.autoRefresh) {
                            this.startAutoRefresh();
                        }
                    }, 500);
                }
            }
            
            // 清除滑动标记
            delete wrapper.dataset.hasSwiped;
            delete wrapper.dataset.wasAutoRefresh;
            
            setTimeout(() => {
                wrapper.classList.remove('swiping');
            }, 300);
        }, { passive: true });
        
        // 鼠标拖拽（桌面端）- 需要长按后拖动
        let mouseDown = false;
        let mouseStartX = 0;
        let mouseCurrentX = 0;
        let mouseHasMoved = false;
        let mouseDownTime = 0;
        
        const handleMouseMove = (e) => {
            if (!mouseDown) return;
            mouseCurrentX = e.clientX;
            const diff = mouseCurrentX - mouseStartX;
            
            // 如果移动距离超过阈值，标记为已移动并添加 swiping 类
            if (Math.abs(diff) > minSwipeDistance) {
                if (!mouseHasMoved) {
                    mouseHasMoved = true;
                    wrapper.dataset.hasSwiped = 'true';
                    wrapper.classList.add('swiping');
                    // 停止自动刷新，避免误删除
                    if (this.state.autoRefresh) {
                        this.stopAutoRefresh();
                        wrapper.dataset.wasAutoRefresh = 'true';
                    }
                    // 一旦开始滑动，阻止默认行为
                    e.preventDefault();
                }
            }
            
            if (diff < 0) {
                const translateX = Math.max(diff, -deleteWidth);
                item.style.transform = `translateX(${translateX}px)`;
            }
        };
        
        const handleMouseUp = (e) => {
            if (!mouseDown) return;
            mouseDown = false;
            
            const diff = mouseCurrentX - mouseStartX;
            const pressTime = Date.now() - mouseDownTime;
            const wasAutoRefresh = wrapper.dataset.wasAutoRefresh === 'true';
            
            // 只有长按后拖动且超过一半才删除
            if (mouseHasMoved && pressTime >= minPressTime && diff < -deleteWidth / 2) {
                // 删除邮件（删除函数内部会处理自动刷新）
                this.deleteEmail(index, emailId, wasAutoRefresh);
            } else {
                item.style.transform = '';
                // 恢复自动刷新
                if (wasAutoRefresh && this.state.autoRefresh) {
                    setTimeout(() => {
                        if (this.state.autoRefresh) {
                            this.startAutoRefresh();
                        }
                    }, 500);
                }
            }
            
            // 清除滑动标记
            delete wrapper.dataset.hasSwiped;
            delete wrapper.dataset.wasAutoRefresh;
            
            setTimeout(() => {
                wrapper.classList.remove('swiping');
            }, 300);
            
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        item.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // 只处理左键
            mouseDown = true;
            mouseStartX = e.clientX;
            mouseCurrentX = e.clientX;
            mouseHasMoved = false;
            mouseDownTime = Date.now();
            // 不立即添加 swiping 类，等检测到实际移动后再添加
            // 不阻止默认行为，允许正常点击
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
    },

    /**
     * 删除邮件
     */
    async deleteEmail(index, emailId, wasAutoRefresh = false) {
        if (index < 0 || index >= this.state.emails.length) return;
        
        const email = this.state.emails[index];
        const currentEmail = this.state.currentEmail;
        
        // 确保自动刷新已停止
        if (this.state.autoRefresh) {
            this.stopAutoRefresh();
            wasAutoRefresh = true;
        }
        
        try {
            const result = await EmailAPI.deleteEmail(currentEmail, emailId);
            
            if (result.success) {
                // 从状态中移除邮件
                this.state.emails.splice(index, 1);
                
                // 如果删除的是当前选中的邮件，关闭详情
                if (this.state.selectedEmailIndex === index) {
                    this.hideEmailDetail();
                    this.state.selectedEmailIndex = -1;
                } else if (this.state.selectedEmailIndex > index) {
                    // 如果删除的邮件在当前选中邮件之前，调整索引
                    this.state.selectedEmailIndex--;
                }
                
                // 重新渲染列表
                this.renderMailList();
                this.updateEmailCount();
                
                // 延迟恢复自动刷新，给用户缓冲时间（3秒后恢复）
                if (wasAutoRefresh && this.state.autoRefresh) {
                    setTimeout(() => {
                        if (this.state.autoRefresh) {
                            this.startAutoRefresh();
                        }
                    }, 3000);
                }
            } else {
                // 删除失败，立即恢复自动刷新
                if (wasAutoRefresh && this.state.autoRefresh) {
                    setTimeout(() => {
                        if (this.state.autoRefresh) {
                            this.startAutoRefresh();
                        }
                    }, 500);
                }
            }
        } catch (error) {
            console.error('删除邮件失败:', error);
            // 删除失败，立即恢复自动刷新
            if (wasAutoRefresh && this.state.autoRefresh) {
                setTimeout(() => {
                    if (this.state.autoRefresh) {
                        this.startAutoRefresh();
                    }
                }, 500);
            }
        }
    },

    /**
     * 显示邮件详情（模态框）
     */
    showEmailDetail(index) {
        if (index < 0 || index >= this.state.emails.length) return;
        
        this.state.selectedEmailIndex = index;
        const email = this.state.emails[index];
        
        // 更新模态框标题
        this.elements.modalTitle.textContent = email.subject || '(无主题)';
        
        // 更新元数据
        this.elements.detailFrom.textContent = email.from || '-';
        this.elements.detailTo.textContent = email.to || '-';
        this.elements.detailSubject.textContent = email.subject || '(无主题)';
        this.elements.detailDate.textContent = Utils.formatDate(email.date);
        
        // 显示 AI 分析信息
        this.updateAIInfo(email);
        
        // 更新内容
        this.elements.textContent.textContent = email.text || '(无文本内容)';
        
        // 渲染 HTML 内容
        if (email.html) {
            this.renderHtmlContent(email.html);
        } else {
            this.elements.htmlContent.srcdoc = '<p style="color:#666;padding:20px;">无 HTML 内容</p>';
        }
        
        // 设置视图模式
        this.setViewMode(email.html ? 'html' : 'text');
        
        // 显示模态框
        this.elements.mailModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // 防止背景滚动
        
        // 更新列表选中状态
        this.elements.mailList.querySelectorAll('.mail-item').forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
    },
    
    /**
     * 更新 AI 分析信息显示
     */
    updateAIInfo(email) {
        const aiInfoEl = document.getElementById('aiInfo');
        if (!aiInfoEl) return;
        
        const hasAIData = email.verificationCode || email.summary || email.isSpam || email.language;
        
        if (!hasAIData) {
            aiInfoEl.style.display = 'none';
            return;
        }
        
        aiInfoEl.style.display = 'block';
        
        let html = '<div class="ai-info-content">';
        
        if (email.verificationCode) {
            html += `<div class="ai-info-item ai-code">
                <span class="ai-label">验证码</span>
                <span class="ai-value code-value" data-code="${Utils.escapeHtml(email.verificationCode)}">${Utils.escapeHtml(email.verificationCode)}</span>
            </div>`;
        }
        
        if (email.summary) {
            // 解析中英双语摘要（格式：中文摘要 | English summary）
            const summaryParts = email.summary.split('|').map(s => s.trim());
            const zhSummary = summaryParts[0] || '';
            const enSummary = summaryParts[1] || '';
            
            html += `<div class="ai-info-item ai-summary">
                <span class="ai-label">摘要</span>
                <div class="summary-content-wrapper">
                    <div class="summary-text" data-zh="${Utils.escapeHtml(zhSummary)}" data-en="${Utils.escapeHtml(enSummary)}">${Utils.escapeHtml(zhSummary)}</div>
                    ${enSummary ? `<div class="lang-switcher">
                        <button class="lang-btn active" data-target="zh">中</button>
                        <button class="lang-btn" data-target="en">EN</button>
                    </div>` : ''}
                </div>
            </div>`;
        }
        
        // 显示邮件类型提示：验证码邮件 或 垃圾邮件警告
        if (email.verificationCode) {
            html += `<div class="ai-info-item ai-type">
                <span class="ai-label">类型</span>
                <span class="ai-value type-code">验证码邮件</span>
            </div>`;
        } else if (email.isSpam) {
            html += `<div class="ai-info-item ai-spam">
                <span class="ai-label">警告</span>
                <span class="ai-value spam-warning">此邮件被检测为垃圾邮件</span>
            </div>`;
        }
        
        if (email.language && email.language !== 'unknown') {
            const langMap = { zh: '中文', en: '英文', ja: '日文', ko: '韩文', fr: '法文', de: '德文', es: '西班牙文', ru: '俄文' };
            html += `<div class="ai-info-item ai-lang">
                <span class="ai-label">语言</span>
                <span class="ai-value">${langMap[email.language] || email.language}</span>
            </div>`;
        }
        
        html += '</div>';
        aiInfoEl.innerHTML = html;
        
        // 绑定验证码点击复制
        const codeEl = aiInfoEl.querySelector('.code-value');
        if (codeEl) {
            codeEl.style.cursor = 'pointer';
            codeEl.addEventListener('click', async () => {
                const code = codeEl.dataset.code;
                const success = await Utils.copyToClipboard(code);
                if (success) {
                    this.showToast('success', '已复制', `验证码 ${code} 已复制到剪贴板`);
                }
            });
        }
        
        // 绑定摘要语言切换
        const langBtns = aiInfoEl.querySelectorAll('.lang-btn');
        const summaryText = aiInfoEl.querySelector('.summary-text');
        if (langBtns.length && summaryText) {
            langBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const target = btn.dataset.target;
                    const text = target === 'zh' ? summaryText.dataset.zh : summaryText.dataset.en;
                    
                    summaryText.textContent = text;
                    summaryText.className = `summary-text ${target === 'en' ? 'lang-en' : ''}`;
                    
                    langBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        }
    },
    
    /**
     * 翻译邮件内容
     */
    async translateEmail(targetLang = 'zh') {
        if (this.state.selectedEmailIndex < 0) return;
        
        const email = this.state.emails[this.state.selectedEmailIndex];
        const text = email.text || '';
        
        if (!text) {
            this.showToast('warning', '无内容', '没有可翻译的文本内容');
            return;
        }
        
        this.showToast('info', '翻译中', '正在使用 AI 翻译...');
        
        try {
            // AI API 在 Worker 中实现，使用配置了 AI 绑定的域名
            const aiApiBase = 'https://kami666.xyz';
            const response = await fetch(`${aiApiBase}/api/ai/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, targetLang })
            });
            
            const data = await response.json();
            
            if (data.success && data.translation) {
                // 显示翻译结果
                this.elements.textContent.textContent = `[译文]\n${data.translation}\n\n[原文]\n${text}`;
                this.setViewMode('text');
                this.showToast('success', '翻译完成', '');
            } else {
                throw new Error(data.error || '翻译失败');
            }
        } catch (error) {
            console.error('翻译失败:', error);
            this.showToast('error', '翻译失败', error.message);
        }
    },

    /**
     * 渲染 HTML 内容到 iframe
     */
    renderHtmlContent(html) {
        // 在 sandbox iframe 中安全渲染
        const sanitizedHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        font-size: 14px;
                        line-height: 1.6;
                        color: #333;
                        padding: 20px;
                        margin: 0;
                        background: #fff;
                    }
                    img { max-width: 100%; height: auto; }
                    a { color: #0066cc; }
                    pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
                </style>
            </head>
            <body>${html}</body>
            </html>
        `;
        
        this.elements.htmlContent.srcdoc = sanitizedHtml;
    },

    /**
     * 隐藏邮件详情（关闭模态框）
     */
    hideEmailDetail() {
        this.state.selectedEmailIndex = -1;
        
        // 隐藏模态框
        this.elements.mailModal.classList.remove('active');
        document.body.style.overflow = ''; // 恢复滚动
        
        // 清除列表选中状态
        this.elements.mailList.querySelectorAll('.mail-item').forEach(item => {
            item.classList.remove('active');
        });
    },

    /**
     * 设置视图模式
     */
    setViewMode(mode) {
        this.state.viewMode = mode;
        
        this.elements.viewTextBtn.classList.toggle('active', mode === 'text');
        this.elements.viewHtmlBtn.classList.toggle('active', mode === 'html');
        
        this.elements.textContent.classList.toggle('active', mode === 'text');
        this.elements.htmlContent.classList.toggle('active', mode === 'html');
    },

    /**
     * 更新邮件数量显示
     */
    updateEmailCount() {
        const count = this.state.emails.length;
        this.elements.emailCount.textContent = count;
        this.elements.inboxBadge.textContent = count;
    },

    /**
     * 切换自动刷新
     */
    toggleAutoRefresh(enabled) {
        this.state.autoRefresh = enabled;
        
        if (enabled) {
            this.startAutoRefresh();
            this.elements.refreshStatus.textContent = '自动刷新中...';
        } else {
            this.stopAutoRefresh();
            this.elements.refreshStatus.textContent = '自动刷新已关闭';
        }
    },

    /**
     * 启动自动刷新
     */
    startAutoRefresh() {
        this.stopAutoRefresh(); // 先停止已有的
        
        this.state.refreshInterval = setInterval(() => {
            this.fetchEmails();
        }, this.config.refreshIntervalMs);
    },

    /**
     * 停止自动刷新
     */
    stopAutoRefresh() {
        if (this.state.refreshInterval) {
            clearInterval(this.state.refreshInterval);
            this.state.refreshInterval = null;
        }
    },

    /**
     * 添加到历史记录
     */
    addToHistory(email) {
        // 去重
        this.state.emailHistory = this.state.emailHistory.filter(e => e !== email);
        
        // 添加到开头
        this.state.emailHistory.unshift(email);
        
        // 限制数量
        if (this.state.emailHistory.length > this.config.maxHistoryItems) {
            this.state.emailHistory = this.state.emailHistory.slice(0, this.config.maxHistoryItems);
        }
        
        // 保存
        Utils.setStorage(this.config.storageKeys.emailHistory, this.state.emailHistory);
        
        // 更新UI
        this.renderHistory();
    },

    /**
     * 渲染历史记录
     */
    renderHistory() {
        if (this.state.emailHistory.length === 0) {
            this.elements.historyList.innerHTML = '<div class="empty-state">暂无历史记录</div>';
            return;
        }

        this.elements.historyList.innerHTML = this.state.emailHistory.map(email => `
            <div class="history-item" data-email="${Utils.escapeHtml(email)}">
                <span>${Utils.escapeHtml(Utils.truncate(email, 25))}</span>
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
        `).join('');

        // 绑定点击事件
        this.elements.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const email = item.dataset.email;
                this.loadHistoryEmail(email);
            });
        });
    },

    /**
     * 加载历史邮箱
     */
    loadHistoryEmail(email) {
        const { prefix, domain } = Utils.parseEmail(email);
        
        // 切换域名
        if (EmailAPI.getDomains().find(d => d.name === domain)) {
            this.selectDomain(domain);
        }
        
        // 设置邮箱
        this.state.currentEmail = email;
        this.state.emails = [];
        this.state.lastEmailCount = 0;
        this.state.selectedEmailIndex = -1;
        
        // 更新UI
        this.updateEmailDisplay();
        this.renderMailList();
        this.hideEmailDetail();
        
        // 保存
        this.saveCurrentEmail();
        
        // 获取邮件
        this.fetchEmails();
        
        this.showToast('info', '已切换邮箱', email);
    },

    /**
     * 保存当前邮箱到本地存储
     */
    saveCurrentEmail() {
        Utils.setStorage(this.config.storageKeys.currentEmail, this.state.currentEmail);
    },

    /**
     * 从本地存储恢复状态
     */
    restoreState() {
        // 恢复当前域名
        const savedDomain = Utils.getStorage(this.config.storageKeys.currentDomain);
        if (savedDomain && EmailAPI.getDomains().find(d => d.name === savedDomain)) {
            this.state.currentDomain = savedDomain;
            EmailAPI.setCurrentDomainByName(savedDomain);
            this.renderDomainSelector();
        } else {
            this.state.currentDomain = EmailAPI.getCurrentDomain().name;
        }
        
        // 恢复当前邮箱
        const savedEmail = Utils.getStorage(this.config.storageKeys.currentEmail);
        if (savedEmail) {
            const { domain } = Utils.parseEmail(savedEmail);
            if (EmailAPI.getDomains().find(d => d.name === domain)) {
                this.state.currentEmail = savedEmail;
            }
        }
        
        // 恢复历史记录
        this.state.emailHistory = Utils.getStorage(this.config.storageKeys.emailHistory, []);
        this.renderHistory();
    },

    /**
     * 显示添加域名模态框
     */
    showAddDomainModal() {
        this.elements.addDomainModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        // 清空表单
        this.elements.userDomainName.value = '';
        this.elements.userDomainApi.value = '';
        this.elements.addDomainStatus.innerHTML = '';
        this.elements.addDomainStatus.className = 'add-domain-status';
        // 渲染当前域名列表
        this.renderCurrentDomainsList();
    },

    /**
     * 渲染当前域名列表（带删除按钮）
     */
    renderCurrentDomainsList() {
        const domains = EmailAPI.DOMAINS;
        if (domains.length === 0) {
            this.elements.currentDomainsList.innerHTML = '<div class="empty-hint">暂无域名</div>';
            return;
        }

        this.elements.currentDomainsList.innerHTML = domains.map(d => `
            <div class="domain-item">
                <span class="domain-item-name">${Utils.escapeHtml(d.name)}</span>
                <button class="btn-delete-sm" onclick="App.deleteDomainFromList('${Utils.escapeHtml(d.name)}')">删除</button>
            </div>
        `).join('');
    },

    /**
     * 从列表中删除域名
     */
    async deleteDomainFromList(name) {
        // workers.dev 子域名直接删除，无需确认
        const isWorkersDev = name.endsWith('.workers.dev');
        
        if (!isWorkersDev) {
            // 非 workers.dev 域名需要验证 API 是否失效
            const domainConfig = EmailAPI.DOMAINS.find(d => d.name === name);
            if (domainConfig) {
                this.showToast('info', '检测中', `正在验证 ${name} 的 API 状态...`);
                
                const isValid = await this.verifyDomainApi(domainConfig.api);
                
                if (isValid) {
                    this.showToast('error', '无法删除', '该域名 API 仍在正常运行，无法删除正常运行的域名');
                    return;
                }
            }
            
            if (!confirm(`域名 ${name} 的 API 已失效，确定要删除吗？`)) {
                return;
            }
        }

        try {
            const result = await EmailAPI.deleteDomain(name);

            if (result.success) {
                this.renderCurrentDomainsList();
                this.renderDomainSelector();
                this.showToast('success', '删除成功', `域名 ${name} 已删除`);
            } else {
                this.showToast('error', '删除失败', result.error || '未知错误');
            }
        } catch (e) {
            this.showToast('error', '错误', e.message);
        }
    },

    /**
     * 自动清理 workers.dev 子域名
     */
    async autoCleanWorkersDev() {
        const domains = EmailAPI.DOMAINS;
        const workersDevDomains = domains.filter(d => d.name.endsWith('.workers.dev'));
        
        if (workersDevDomains.length > 0) {
            console.log('检测到 workers.dev 子域名，自动清理...');
            
            for (const domain of workersDevDomains) {
                try {
                    await EmailAPI.deleteDomain(domain.name);
                    console.log(`已自动删除: ${domain.name}`);
                } catch (e) {
                    console.error(`删除 ${domain.name} 失败:`, e);
                }
            }
            
            // 重新加载域名列表
            await EmailAPI.loadDomains();
            this.renderDomainSelector();
            
            if (workersDevDomains.length > 0) {
                this.showToast('info', '自动清理', `已自动删除 ${workersDevDomains.length} 个 workers.dev 子域名`);
            }
        }
    },

    /**
     * 隐藏添加域名模态框
     */
    hideAddDomainModal() {
        this.elements.addDomainModal.classList.remove('active');
        document.body.style.overflow = '';
    },

    /**
     * 提交新域名
     */
    async submitNewDomain() {
        const name = this.elements.userDomainName.value.trim();
        const api = this.elements.userDomainApi.value.trim();

        if (!name) {
            this.showToast('error', '错误', '请输入域名');
            return;
        }

        if (!api) {
            this.showToast('error', '错误', '请输入 API 地址');
            return;
        }

        // 检查是否是 workers.dev 子域名
        if (name.endsWith('.workers.dev') || api.includes('.workers.dev')) {
            this.showToast('error', '拒绝添加', 'workers.dev 子域名无法接收邮件，不允许添加');
            return;
        }

        // 禁用按钮
        this.elements.submitDomainBtn.disabled = true;
        this.elements.submitDomainBtn.innerHTML = '<span class="loading"></span> 验证中...';

        // 显示验证状态
        this.elements.addDomainStatus.className = 'add-domain-status checking';
        this.elements.addDomainStatus.innerHTML = '<span class="loading"></span> 正在验证域名 API 是否可用...';

        try {
            // 验证 API 是否可用
            const isValid = await this.verifyDomainApi(api);

            if (!isValid) {
                this.elements.addDomainStatus.className = 'add-domain-status error';
                this.elements.addDomainStatus.innerHTML = 'API 验证失败，请确保已正确部署 Worker';
                this.showToast('error', '验证失败', '无法连接到该域名的 API');
                return;
            }

            this.elements.addDomainStatus.className = 'add-domain-status success';
            this.elements.addDomainStatus.innerHTML = 'API 验证成功，正在添加域名...';

            // 添加域名
            const result = await EmailAPI.addDomain(name, api);

            if (result.success) {
                this.renderDomainSelector();
                this.hideAddDomainModal();
                this.showToast('success', '添加成功', `域名 ${name} 已成功添加`);
            } else {
                this.elements.addDomainStatus.className = 'add-domain-status error';
                this.elements.addDomainStatus.innerHTML = `${result.error || '添加失败'}`;
                this.showToast('error', '添加失败', result.error || '未知错误');
            }
        } catch (e) {
            this.elements.addDomainStatus.className = 'add-domain-status error';
            this.elements.addDomainStatus.innerHTML = `${e.message}`;
            this.showToast('error', '错误', e.message);
        } finally {
            this.elements.submitDomainBtn.disabled = false;
            this.elements.submitDomainBtn.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                验证并添加域名
            `;
        }
    },

    /**
     * 验证域名 API 是否可用
     */
    async verifyDomainApi(api) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            // 移除末尾斜杠
            const apiBase = api.replace(/\/+$/, '');
            
            // 优先检查 /api/domains 端点（更可靠）
            let response = await fetch(`${apiBase}/api/domains`, {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                const data = await response.json();
                    // 检查是否返回了正确的域名列表格式
                    if (data.success && Array.isArray(data.domains)) {
                        return true;
                    }
                }
            }

            // 备用：检查根路径
            const controller2 = new AbortController();
            const timeoutId2 = setTimeout(() => controller2.abort(), 10000);
            
            response = await fetch(apiBase, {
                method: 'GET',
                signal: controller2.signal
            });
            
            clearTimeout(timeoutId2);

            if (response.ok) {
                const contentType = response.headers.get('content-type') || '';
                
                // 如果是 HTML 页面，检查是否包含公益平台标记
                if (contentType.includes('text/html')) {
                    const text = await response.text();
                    return text.includes('公益平台') || text.includes('VioletTeam');
                }
                
                // 如果是 JSON，检查 status
                if (contentType.includes('application/json')) {
                    const data = await response.json();
                    return data.status === 'running' || data.service === 'Temporary Email Service' || data.service === '公益平台';
                }
            }
            return false;
        } catch (e) {
            console.error('验证域名失败:', e);
            return false;
        }
    },

    /**
     * 显示 Worker 代码模态框
     */
    showWorkerCodeModal() {
        this.elements.workerCodeModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // 更新代码显示
        this.updateWorkerCodeDisplay();

        // 绑定服务选择事件
        const updateCode = () => this.updateWorkerCodeDisplay();
        this.elements.serviceEmail.removeEventListener('change', updateCode);
        this.elements.serviceGitHub.removeEventListener('change', updateCode);
        this.elements.serviceRegister.removeEventListener('change', updateCode);
        this.elements.serviceApiHtml.removeEventListener('change', updateCode);
        
        this.elements.serviceEmail.addEventListener('change', updateCode);
        this.elements.serviceGitHub.addEventListener('change', updateCode);
        this.elements.serviceRegister.addEventListener('change', updateCode);
        this.elements.serviceApiHtml.addEventListener('change', updateCode);
        if (this.elements.serviceFileProxy) {
            this.elements.serviceFileProxy.addEventListener('change', updateCode);
        }
        if (this.elements.serviceDocker) {
            this.elements.serviceDocker.addEventListener('change', updateCode);
        }
        if (this.elements.dockerProxyServer) {
            this.elements.dockerProxyServer.addEventListener('input', updateCode);
        }
        
        // 数据库选择事件
        if (this.elements.databaseKV) {
            this.elements.databaseKV.addEventListener('change', updateCode);
        }
        if (this.elements.databaseOther) {
            this.elements.databaseOther.addEventListener('change', updateCode);
        }
        if (this.elements.databaseApiUrl) {
            this.elements.databaseApiUrl.addEventListener('input', updateCode);
        }
    },

    /**
     * 更新 Worker 代码显示
     */
    updateWorkerCodeDisplay() {
        // 检查是否至少选择了一个服务
        const enableEmail = this.elements.serviceEmail.checked;
        const enableGitHub = this.elements.serviceGitHub.checked;
        const enableRegister = this.elements.serviceRegister.checked;
        const enableApiHtml = this.elements.serviceApiHtml.checked;
        const enableFileProxy = this.elements.serviceFileProxy ? this.elements.serviceFileProxy.checked : false;
        const enableDocker = this.elements.serviceDocker ? this.elements.serviceDocker.checked : false;
        
        // 显示/隐藏警告
        if (this.elements.serviceWarning) {
            if (!enableEmail && !enableGitHub && !enableRegister && !enableApiHtml && !enableFileProxy && !enableDocker) {
                this.elements.serviceWarning.style.display = 'flex';
            } else {
                this.elements.serviceWarning.style.display = 'none';
            }
        }
        
        // 显示/隐藏 Docker 反向代理配置（仅在启用 Docker 时显示）
        if (this.elements.dockerProxyConfig) {
            this.elements.dockerProxyConfig.style.display = enableDocker ? 'block' : 'none';
        }
        
        // 显示/隐藏数据库选项（仅在启用邮箱服务时显示）
        if (this.elements.databaseOptions) {
            this.elements.databaseOptions.style.display = enableEmail ? 'block' : 'none';
        }
        
        // 显示/隐藏数据库表单（选择其他数据库时显示）
        if (this.elements.databaseForm && this.elements.databaseOther) {
            this.elements.databaseForm.style.display = this.elements.databaseOther.checked ? 'block' : 'none';
        }
        
        if (!enableEmail && !enableGitHub && !enableRegister && !enableApiHtml) {
            // 如果没有选择任何服务，显示提示
            this.elements.workerCodeBlock.textContent = '// 请至少选择一个服务功能\n// 勾选上方的服务复选框以生成代码';
            this.elements.workerCodeBlock.className = 'language-javascript';
            return;
        }
        
        // 加载 highlight.js 并应用高亮
        this.loadHighlightJs().then(() => {
            if (typeof hljs !== 'undefined') {
                // 获取代码内容
                const code = this.getWorkerCode();
                
                // 使用 highlight() 方法直接高亮代码字符串，确保每次结果一致
                try {
                    const highlighted = hljs.highlight(code, { language: 'javascript' });
                    this.elements.workerCodeBlock.innerHTML = highlighted.value;
                    this.elements.workerCodeBlock.className = 'hljs language-javascript';
                } catch (e) {
                    // 如果高亮失败，显示纯文本
                    console.error('代码高亮失败:', e);
                    this.elements.workerCodeBlock.textContent = code;
                    this.elements.workerCodeBlock.className = 'language-javascript';
                }
            } else {
                // 如果 highlight.js 加载失败，至少显示纯文本
                this.elements.workerCodeBlock.textContent = this.getWorkerCode();
                this.elements.workerCodeBlock.className = 'language-javascript';
            }
        });
    },

    /**
     * 延迟加载 highlight.js
     */
    async loadHighlightJs() {
        // 如果已加载，直接返回
        if (typeof hljs !== 'undefined') {
            return Promise.resolve();
        }
        
        // 加载 CSS
        if (!document.querySelector('link[href*="highlight.js"]')) {
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';
            document.head.appendChild(css);
        }
        
        // 加载 JS
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
            script.onload = () => {
                // 加载 JavaScript 语言支持
                const jsLang = document.createElement('script');
                jsLang.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/javascript.min.js';
                jsLang.onload = resolve;
                document.head.appendChild(jsLang);
            };
            document.head.appendChild(script);
        });
    },

    /**
     * 隐藏 Worker 代码模态框
     */
    hideWorkerCodeModal() {
        this.elements.workerCodeModal.classList.remove('active');
        document.body.style.overflow = '';
    },

    /**
     * 显示 GitHub 代理使用说明模态框
     */
    showGitHubGuideModal() {
        // 获取可用域名，去除尾部的 /
        const domains = EmailAPI.getDomains()
            .filter(d => !d.name.includes('.workers.dev'))
            .map(d => ({ ...d, name: d.name.replace(/\/+$/, '') }));

        // 渲染域名选择按钮
        this.elements.proxyDomainGrid.innerHTML = domains.map((d, i) => 
            `<button class="converter-domain-btn ${i === 0 ? 'active' : ''}" data-domain="${d.name}">${d.name}</button>`
        ).join('');

        // 保存当前选中的域名
        this.selectedProxyDomain = domains.length > 0 ? domains[0].name : '';

        // 点击域名按钮选择代理域名
        this.elements.proxyDomainGrid.querySelectorAll('.converter-domain-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const domain = btn.dataset.domain;
                this.selectedProxyDomain = domain;
                // 高亮选中的按钮
                this.elements.proxyDomainGrid.querySelectorAll('.converter-domain-btn').forEach(b => 
                    b.classList.toggle('active', b === btn)
                );
            });
        });

        // 重置转换结果
        this.elements.githubOriginalUrl.value = '';
        this.elements.converterResult.style.display = 'none';

        this.elements.githubGuideModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    /**
     * 转换 GitHub 链接
     */
    convertGitHubUrl() {
        const originalUrl = this.elements.githubOriginalUrl.value.trim();
        const selectedDomain = this.selectedProxyDomain;

        if (!originalUrl) {
            this.showToast('error', '请输入链接', '请粘贴 GitHub 链接');
            return;
        }

        if (!selectedDomain) {
            this.showToast('error', '请选择域名', '请点击选择一个代理域名');
            return;
        }

        // 支持多种 GitHub 链接格式
        let convertedUrl = originalUrl;
        
        // 替换各种 GitHub 域名
        const githubDomains = [
            'https://github.com',
            'http://github.com',
            'https://raw.githubusercontent.com',
            'http://raw.githubusercontent.com',
            'https://gist.github.com',
            'http://gist.github.com',
            'https://codeload.github.com',
            'http://codeload.github.com'
        ];

        let matched = false;
        for (const domain of githubDomains) {
            if (originalUrl.toLowerCase().startsWith(domain.toLowerCase())) {
                convertedUrl = `https://${selectedDomain}${originalUrl.substring(domain.length)}`;
                matched = true;
                break;
            }
        }

        // 如果不是以 http 开头，尝试作为路径处理
        if (!matched && !originalUrl.startsWith('http')) {
            // 可能是 user/repo 格式
            convertedUrl = `https://${selectedDomain}/${originalUrl.replace(/^\/+/, '')}`;
            matched = true;
        }

        if (!matched) {
            this.showToast('error', '无法识别', '请输入有效的 GitHub 链接');
            return;
        }

        // 显示结果
        this.elements.convertedUrl.textContent = convertedUrl;
        this.elements.converterResult.style.display = 'flex';
        
        this.showToast('success', '转换成功', '点击复制按钮复制代理链接');
    },

    /**
     * 转换文件加速链接
     */
    convertFileProxyUrl() {
        const originalUrl = this.elements.fileProxyUrl ? this.elements.fileProxyUrl.value.trim() : '';
        // 使用 Cloudflare 加速域名
        const fileProxyDomain = 'download.qxfy.store';

        if (!originalUrl) {
            this.showToast('error', '请输入链接', '请粘贴需要加速的文件链接');
            return;
        }

        // 验证 URL 格式
        try {
            new URL(originalUrl);
        } catch {
            this.showToast('error', 'URL 无效', '请输入有效的 HTTP/HTTPS 链接');
            return;
        }

        // 生成加速链接
        const convertedUrl = `https://${fileProxyDomain}/proxy/?url=${encodeURIComponent(originalUrl)}`;

        // 显示结果
        if (this.elements.convertedFileUrl) {
            this.elements.convertedFileUrl.textContent = convertedUrl;
        }
        if (this.elements.fileProxyResult) {
            this.elements.fileProxyResult.style.display = 'flex';
        }
        
        this.showToast('success', '生成成功', '点击复制按钮复制加速链接');
    },

    /**
     * 隐藏 GitHub 代理使用说明模态框
     */
    hideGitHubGuideModal() {
        this.elements.githubGuideModal.classList.remove('active');
        document.body.style.overflow = '';
    },

    /**
     * 显示文件加速下载模态框
     */
    showFileProxyModal() {
        // 重置转换结果
        if (this.elements.fileProxyUrl) this.elements.fileProxyUrl.value = '';
        if (this.elements.fileProxyResult) this.elements.fileProxyResult.style.display = 'none';

        if (this.elements.fileProxyModal) {
            this.elements.fileProxyModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    /**
     * 隐藏文件加速下载模态框
     */
    hideFileProxyModal() {
        if (this.elements.fileProxyModal) {
            this.elements.fileProxyModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    /**
     * 显示 Docker 加速说明模态框
     */
    showDockerModal() {
        // 从 localStorage 读取保存的域名
        const getDockerDomain = () => {
            return localStorage.getItem('dockerServerDomain') || 'mirror.yljdteam.com';
        };

        // 更新所有显示的域名
        const updateDomainDisplay = (domain) => {
            // 更新 daemon.json 代码示例
            const daemonCodeBlock = document.querySelector('#dockerMethodDaemon .docker-code-block code');
            if (daemonCodeBlock) {
                daemonCodeBlock.innerHTML = `<span class="comment"># 直接覆盖写入 daemon.json 并重启 Docker</span>
sudo tee /etc/docker/daemon.json &lt;&lt;EOF
{
  "registry-mirrors": [
    "https://${domain}"
  ]
}
EOF
sudo systemctl restart docker`;
            }
        };

        // 绑定配置方法切换事件
        const methodTabs = document.querySelectorAll('.docker-method-tab');
        const methodContents = document.querySelectorAll('.docker-method-content');
        
        methodTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const method = tab.dataset.method;
                
                // 更新 tab 状态
                methodTabs.forEach(t => t.classList.toggle('active', t === tab));
                
                // 更新内容显示
                methodContents.forEach(content => {
                    const contentMethod = content.id.replace('dockerMethod', '').toLowerCase();
                    content.classList.toggle('active', contentMethod === method);
                });
            });
        });

        // 初始化域名输入框
        const dockerServerInput = document.getElementById('dockerServerDomain');
        const saveDockerDomainBtn = document.getElementById('saveDockerDomain');
        
        if (dockerServerInput) {
            dockerServerInput.value = getDockerDomain();
        }

        // 保存域名按钮事件
        if (saveDockerDomainBtn && dockerServerInput) {
            saveDockerDomainBtn.addEventListener('click', () => {
                const domain = dockerServerInput.value.trim();
                if (!domain) {
                    this.showToast('warning', '请输入域名', '服务器域名不能为空');
                    return;
                }
                // 验证域名格式
                if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(domain)) {
                    this.showToast('error', '域名格式错误', '请输入有效的域名格式');
                    return;
                }
                localStorage.setItem('dockerServerDomain', domain);
                updateDomainDisplay(domain);
                this.showToast('success', '已保存', `Docker 加速域名已设置为 ${domain}`);
            });
        }

        // 初始化域名显示
        updateDomainDisplay(getDockerDomain());

        // 绑定镜像转换事件
        const dockerImageInput = document.getElementById('dockerImageInput');
        const dockerConvertBtn = document.getElementById('dockerConvertBtn');
        const dockerConvertResult = document.getElementById('dockerConvertResult');
        const dockerResultCode = document.getElementById('dockerResultCode');
        const dockerCopyBtn = document.getElementById('dockerCopyBtn');

        if (dockerConvertBtn && dockerImageInput) {
            const convertImage = () => {
                const input = dockerImageInput.value.trim();
                if (!input) {
                    this.showToast('warning', '请输入镜像名', '例如: nginx, mysql:8.0, bitnami/redis');
                    return;
                }
                
                // 使用用户配置的域名
                const dockerMirrorDomain = getDockerDomain();
                const pullCommand = this.convertDockerImage(input, dockerMirrorDomain);
                
                // 显示结果
                if (dockerConvertResult && dockerResultCode) {
                    dockerResultCode.textContent = pullCommand;
                    dockerConvertResult.style.display = 'block';
                }
            };

            dockerConvertBtn.addEventListener('click', convertImage);
            
            // 支持回车转换
            dockerImageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    convertImage();
                }
            });
        }

        if (dockerCopyBtn) {
            dockerCopyBtn.addEventListener('click', () => {
                const command = dockerResultCode?.textContent;
                if (command) {
                    Utils.copyToClipboard(command);
                    this.showToast('success', '已复制', '拉取命令已复制到剪贴板');
                }
            });
        }

        if (this.elements.dockerModal) {
            this.elements.dockerModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    /**
     * 转换 Docker 镜像名为加速拉取命令
     * 支持识别隐式路径（如 nginx -> library/nginx）
     */
    convertDockerImage(imageName, domain) {
        let name = imageName.trim();
        
        // 移除可能的 docker.io/ 或 registry-1.docker.io/ 前缀
        name = name.replace(/^(docker\.io|registry-1\.docker\.io)\//, '');
        
        // 解析镜像名和标签
        let [image, tag] = name.split(':');
        tag = tag || 'latest';
        
        // 识别隐式路径：如果没有 / 则是官方镜像，需要加 library/
        if (!image.includes('/')) {
            image = `library/${image}`;
        }
        
        return `docker pull ${domain}/${image}:${tag}`;
    },

    /**
     * 隐藏 Docker 加速说明模态框
     */
    hideDockerModal() {
        if (this.elements.dockerModal) {
            this.elements.dockerModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    /**
     * 显示短链接模态框
     */
    async showShortLinkModal() {
        const modal = document.getElementById('shortLinkModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // 清空表单
            document.getElementById('shortLinkUrl').value = '';
            document.getElementById('shortLinkTitle').value = '';
            document.getElementById('shortLinkCode').value = '';
            document.getElementById('shortLinkExpires').value = '';
            document.getElementById('shortLinkResult').style.display = 'none';
            
            // 加载域名列表
            await this.loadShortLinkDomains();
        }
    },
    
    /**
     * 加载短链接域名列表
     */
    async loadShortLinkDomains() {
        const domainSelect = document.getElementById('shortLinkDomain');
        if (!domainSelect) return;
        
        try {
            // 获取域名列表
            const domains = await EmailAPI.loadDomains();
            
            // 清空并填充选项
            domainSelect.innerHTML = '';
            
            // 添加默认选项
            if (domains && domains.length > 0) {
                domains.forEach(domain => {
                    const option = document.createElement('option');
                    // 去除末尾斜杠
                    const cleanName = domain.name.replace(/\/+$/, '');
                    option.value = cleanName;
                    option.textContent = cleanName;
                    domainSelect.appendChild(option);
                });
            } else {
                // 如果没有域名，添加当前域名
                const currentDomain = window.location.hostname || 'example.com';
                const option = document.createElement('option');
                option.value = currentDomain;
                option.textContent = currentDomain;
                domainSelect.appendChild(option);
            }
        } catch (error) {
            console.error('Load domains error:', error);
            // 使用当前域名作为后备
            const currentDomain = window.location.hostname || 'kami666.xyz';
            domainSelect.innerHTML = `<option value="${currentDomain}">${currentDomain}</option>`;
        }
    },
    
    /**
     * 获取当前选择的短链接域名
     */
    getSelectedShortLinkDomain() {
        const domainSelect = document.getElementById('shortLinkDomain');
        return domainSelect ? domainSelect.value : '';
    },

    /**
     * 隐藏短链接模态框
     */
    hideShortLinkModal() {
        const modal = document.getElementById('shortLinkModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    /**
     * 创建短链接
     */
    async createShortLink() {
        const urlInput = document.getElementById('shortLinkUrl');
        const titleInput = document.getElementById('shortLinkTitle');
        const codeInput = document.getElementById('shortLinkCode');
        const expiresSelect = document.getElementById('shortLinkExpires');
        const createBtn = document.getElementById('createShortLinkBtn');
        const resultDiv = document.getElementById('shortLinkResult');
        const resultUrlInput = document.getElementById('shortLinkResultUrl');
        const originalSpan = document.getElementById('shortLinkOriginal');
        const expiresInfo = document.getElementById('shortLinkExpiresInfo');
        const expiresAtSpan = document.getElementById('shortLinkExpiresAt');

        const url = urlInput.value.trim();

        if (!url) {
            this.showToast('error', '错误', '请输入要缩短的链接');
            urlInput.focus();
            return;
        }

        // 验证 URL 格式
        try {
            new URL(url);
        } catch (e) {
            this.showToast('error', '错误', '请输入有效的 URL');
            urlInput.focus();
            return;
        }

        // 禁用按钮
        createBtn.disabled = true;
        createBtn.innerHTML = `
            <svg class="icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/>
            </svg>
            生成中...
        `;

        try {
            // 使用后端 API 地址
            // 短链接 API 始终使用后端服务器，因为需要数据库操作
            const apiBase = EmailAPI.API_BASE;
            
            const response = await fetch(`${apiBase}/api/links`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: url,
                    title: titleInput.value.trim() || undefined,
                    customCode: codeInput.value.trim() || undefined,
                    expiresIn: expiresSelect.value || undefined
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || '创建失败');
            }

            // 显示结果
            // 使用选择的域名生成短链接 URL
            const selectedDomain = this.getSelectedShortLinkDomain();
            const shortUrl = `https://${selectedDomain}/s/${data.code}`;
            resultUrlInput.value = shortUrl;
            originalSpan.textContent = url.length > 50 ? url.substring(0, 50) + '...' : url;

            if (data.expiresAt) {
                expiresInfo.style.display = 'block';
                expiresAtSpan.textContent = new Date(data.expiresAt).toLocaleString('zh-CN');
            } else {
                expiresInfo.style.display = 'none';
            }

            resultDiv.style.display = 'block';
            this.showToast('success', '成功', '短链接已生成');

        } catch (error) {
            console.error('Create short link error:', error);
            this.showToast('error', '错误', error.message || '创建短链接失败');
        } finally {
            // 恢复按钮
            createBtn.disabled = false;
            createBtn.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                生成短链接
            `;
        }
    },

    /**
     * 下载 Worker 代码
     */
    downloadWorkerCode() {
        const code = this.getWorkerCode();
        const blob = new Blob([code], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'workers.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('success', '下载成功', 'workers.js 已开始下载');
    },

    /**
     * 获取 Worker 代码
     */
    getWorkerCode() {
        const enableEmail = this.elements.serviceEmail.checked;
        const enableGitHub = this.elements.serviceGitHub.checked;
        const enableRegister = this.elements.serviceRegister.checked;
        const enableApiHtml = this.elements.serviceApiHtml.checked;
        const enableFileProxy = this.elements.serviceFileProxy ? this.elements.serviceFileProxy.checked : false;
        const enableDocker = this.elements.serviceDocker ? this.elements.serviceDocker.checked : false;
        const dockerProxyServer = this.elements.dockerProxyServer ? this.elements.dockerProxyServer.value.trim() : 'mirror.yljdteam.com';

        // 构建功能列表
        const features = [];
        if (enableEmail) features.push('临时邮箱');
        if (enableGitHub) features.push('GitHub 代理');
        if (enableRegister) features.push('注册机服务');
        if (enableApiHtml) features.push('API HTML 服务');
        if (enableFileProxy) features.push('文件加速下载');
        if (enableDocker) features.push('Docker 镜像加速');

        // 如果没有选择任何服务，返回空代码
        if (features.length === 0) {
            return '// 请至少选择一个服务功能';
        }

        let code = `/**
 * Cloudflare Worker - 公益平台
 * 功能：${features.join(' + ')}
 * 
 * 部署说明：
 * 1. 在 Cloudflare Workers 中创建新 Worker
 * 2. 复制此代码到 Worker
${enableEmail ? ' * 3. 创建 KV 命名空间 EMAILS_KV 并绑定到 Worker\n * 4. 为 Worker 绑定自定义域名\n * 5. 在域名 Email Routing 中添加 Catch-all 规则指向此 Worker' : ' * 3. 为 Worker 绑定自定义域名'}
${enableGitHub ? ' * \n * GitHub 代理用法：\n * git clone https://你的域名/user/repo.git' : ''}
 */

${enableEmail ? `addEventListener('email', event => {
  event.waitUntil(handleEmail(event));
});` : ''}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

${enableEmail ? `async function handleEmail(event) {
  const message = event.message;
  
  try {
    const to = message.to;
    const from = message.from;
    const subject = message.headers.get('subject') || '(无主题)';
    const date = new Date().toISOString();
    
    const rawEmail = await new Response(message.raw).text();
    const { text, html } = await extractEmailContent(rawEmail);
    
    const emailData = {
      from,
      to,
      subject,
      date,
      text: text || '',
      html: html || '',
      raw: rawEmail.substring(0, 10000)
    };
    
    const key = \`emails:\${to}\`;
    let emails = [];
    
    try {
      const existing = await EMAILS_KV.get(key, 'json');
      if (existing && Array.isArray(existing)) {
        emails = existing;
      }
    } catch (e) {
      console.error('Failed to get existing emails:', e);
    }
    
    emails.unshift(emailData);
    if (emails.length > 50) {
      emails = emails.slice(0, 50);
    }
    
    await EMAILS_KV.put(key, JSON.stringify(emails), {
      expirationTtl: 86400
    });
    
    console.log(\`Email stored for \${to}\`);
  } catch (error) {
    console.error('Error handling email:', error);
  }
}` : ''}

async function handleRequest(request) {
  const url = new URL(request.url);
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
${enableEmail ? `  // 邮件 API
  const emailMatch = url.pathname.match(/^\\/api\\/emails\\/(.+)$/);
  if (emailMatch && request.method === 'GET') {
    const email = decodeURIComponent(emailMatch[1]);
    
    try {
      const key = \`emails:\${email}\`;
      const emails = await EMAILS_KV.get(key, 'json');
      
      return new Response(JSON.stringify({
        email,
        emails: emails || [],
        count: emails ? emails.length : 0
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: '获取邮件失败',
        message: error.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }` : ''}

${enableRegister ? `  // 注册机 API
  if (url.pathname === '/api/register' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { email, password, username, site } = body;
      
      if (!email || !password || !site) {
        return new Response(JSON.stringify({
          success: false,
          error: '缺少必要参数'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 调用目标网站的注册接口
      const registerUrl = site.includes('http') ? site : \`https://\${site}/api/register\`;
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify({ email, password, username })
      });
      
      const result = await response.json();
      
      return new Response(JSON.stringify({
        success: response.ok,
        data: result
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }` : ''}

${enableFileProxy ? `  // 文件加速代理
  if (url.pathname === '/proxy/' || url.pathname === '/proxy') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response(JSON.stringify({
        error: '缺少 url 参数',
        usage: url.origin + '/proxy/?url=https://example.com/file.zip'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    return handleFileProxy(targetUrl, request);
  }` : ''}

\${enableDocker ? \`  // Docker 镜像加速 - 反向代理到 ${dockerProxyServer}
  if (url.pathname.startsWith('/v2/')) {
    return handleDockerProxy(request, url);
  }\` : ''}

${enableApiHtml ? `  // API HTML 文档服务 - 根路径返回 HTML 文档页面
  if (url.pathname === '/') {
    return new Response(getApiDocumentationHTML(url.origin, {
      email: ${enableEmail},
      github: ${enableGitHub},
      register: ${enableRegister},
      fileProxy: ${enableFileProxy}
    }), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }` : ''}

${enableGitHub ? `  // GitHub 代理 - 非 API 路径代理到 github.com
  if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/proxy') && !url.pathname.startsWith('/v2/') && url.pathname !== '/' && url.pathname.length > 1) {
    return handleGitHubProxy(request, url);
  }` : ''}

  return new Response(JSON.stringify({
    service: '公益平台 - 免费公益服务',
    status: 'running',
    features: ${JSON.stringify(features)}
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

${enableGitHub ? `// ========== GitHub 代理防护 ==========
const PROXY_CONFIG = {
  rateLimit: 60, // 每分钟请求数
  allowedUA: ['git/', 'curl/', 'wget/', 'Mozilla/'],
  blockedPaths: ['/login', '/signup', '/settings', '/sessions']
};

function getClientIP(req) {
  return req.headers.get('CF-Connecting-IP') || '0.0.0.0';
}

async function checkRate(ip) {
  const key = 'rate:' + ip;
  const now = Math.floor(Date.now() / 60000);
  let data = await EMAILS_KV.get(key, 'json') || { m: 0, c: 0 };
  if (data.m !== now) { data = { m: now, c: 0 }; }
  if (data.c >= PROXY_CONFIG.rateLimit) return false;
  data.c++;
  await EMAILS_KV.put(key, JSON.stringify(data), { expirationTtl: 120 });
  return true;
}

// GitHub 代理处理
async function handleGitHubProxy(request, url) {
  const ua = request.headers.get('User-Agent') || '';
  const ip = getClientIP(request);
  
  // User-Agent 检查
  if (!PROXY_CONFIG.allowedUA.some(a => ua.includes(a))) {
    return new Response(JSON.stringify({ error: '禁止访问' }), { status: 403 });
  }
  
  // 路径检查
  if (PROXY_CONFIG.blockedPaths.some(p => url.pathname.includes(p))) {
    return new Response(JSON.stringify({ error: '路径禁止' }), { status: 403 });
  }
  
  // 频率限制
  if (!await checkRate(ip)) {
    return new Response(JSON.stringify({ error: '请求过快' }), { status: 429 });
  }
  
  const githubUrl = 'https://github.com' + url.pathname + url.search;
  const headers = new Headers(request.headers);
  headers.delete('host');
  
  try {
    const response = await fetch(githubUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      redirect: 'follow'
    });
    
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    
    const location = responseHeaders.get('Location');
    if (location && location.includes('github.com')) {
      responseHeaders.set('Location', location.replace('https://github.com', url.origin));
    }
    
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'GitHub 代理失败' }), { status: 502 });
  }
}` : ''}

${enableFileProxy ? `// ========== 文件加速代理 ==========
const FILE_PROXY_CONFIG = {
  allowedProtocols: ['https:', 'http:'],
  blockedDomains: ['localhost', '127.0.0.1', '0.0.0.0', '::1'],
  timeout: 300000 // 5分钟超时
};

async function handleFileProxy(targetUrl, request) {
  try {
    // URL 验证
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return new Response(JSON.stringify({ error: '无效的 URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 协议检查
    if (!FILE_PROXY_CONFIG.allowedProtocols.includes(parsedUrl.protocol)) {
      return new Response(JSON.stringify({ error: '仅支持 HTTP/HTTPS 协议' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 域名检查
    if (FILE_PROXY_CONFIG.blockedDomains.some(d => parsedUrl.hostname.includes(d))) {
      return new Response(JSON.stringify({ error: '禁止访问的域名' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
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
      return new Response(JSON.stringify({ error: '请求超时' }), {
        status: 504,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: '代理请求失败: ' + error.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}` : ''}

\${enableDocker ? \`// ========== Docker 镜像反向代理 ==========
// 转发 Docker 请求到服务器 ${dockerProxyServer}
const DOCKER_PROXY_SERVER = 'https://${dockerProxyServer}';

async function handleDockerProxy(request, url) {
  const targetUrl = DOCKER_PROXY_SERVER + url.pathname + url.search;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
    'Access-Control-Expose-Headers': 'Docker-Content-Digest, Content-Length, Content-Range, WWW-Authenticate'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 构建转发请求头
    const forwardHeaders = new Headers();
    for (const [key, value] of request.headers) {
      if (!['host', 'cf-connecting-ip', 'cf-ray', 'cf-visitor', 'cf-ipcountry'].includes(key.toLowerCase())) {
        forwardHeaders.set(key, value);
      }
    }

    const resp = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      redirect: 'follow'
    });

    // 构建响应头
    const responseHeaders = new Headers(corsHeaders);
    for (const [key, value] of resp.headers) {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    }

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: responseHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Docker 代理失败', 
      message: error.message,
      server: DOCKER_PROXY_SERVER
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}\` : ''}

${enableEmail ? `async function extractEmailContent(rawEmail) {
  let text = '';
  let html = '';
  
  try {
    const lines = rawEmail.split('\\n');
    let inBody = false;
    let currentContentType = '';
    let currentEncoding = '';
    let currentCharset = 'utf-8';
    let contentBuffer = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.match(/^Content-Type:\\s*text\\/(plain|html)/i)) {
        const typeMatch = line.match(/text\\/(plain|html)/i);
        currentContentType = typeMatch ? typeMatch[1].toLowerCase() : '';
        
        const charsetMatch = line.match(/charset[=\\s]*["']?([^"'\\s;]+)/i);
        if (charsetMatch) {
          currentCharset = charsetMatch[1].toLowerCase();
        }
        continue;
      }
      
      if (line.match(/^Content-Transfer-Encoding:\\s*(.+)/i)) {
        const match = line.match(/Content-Transfer-Encoding:\\s*(.+)/i);
        currentEncoding = match ? match[1].trim().toLowerCase() : '';
        continue;
      }
      
      if (!inBody && line === '' && currentContentType) {
        inBody = true;
        continue;
      }
      
      if (inBody) {
        if (line.startsWith('--')) {
          if (contentBuffer.length > 0) {
            let content = decodeContent(contentBuffer.join('\\n'), currentEncoding, currentCharset);
            
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
        
        if (line.match(/^Content-/i)) continue;
        
        contentBuffer.push(line);
      }
    }
    
    if (contentBuffer.length > 0) {
      let content = decodeContent(contentBuffer.join('\\n'), currentEncoding, currentCharset);
      
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

function decodeContent(content, encoding, charset) {
  try {
    charset = charset || 'utf-8';
    
    if (encoding === 'base64') {
      const cleaned = content.replace(/\\s/g, '');
      const binaryString = atob(cleaned);
      
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const decoder = new TextDecoder(charset);
      content = decoder.decode(bytes);
      
    } else if (encoding === 'quoted-printable') {
      content = decodeQuotedPrintable(content, charset);
    }
    
    return content;
  } catch (e) {
    console.error('Decode content error:', e);
    return content;
  }
}

function decodeQuotedPrintable(str, charset = 'utf-8') {
  try {
    str = str.replace(/=\\r?\\n/g, '');
    
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
    
    const uint8Array = new Uint8Array(bytes);
    const decoder = new TextDecoder(charset);
    return decoder.decode(uint8Array);
  } catch (e) {
    console.error('Decode quoted-printable error:', e);
    return str;
  }
}` : ''}

${enableApiHtml ? `// ========== API HTML 文档服务 ==========
function getApiDocumentationHTML(origin, services) {
  const { email, github, register } = services || {};
  const emailEnabled = email === true;
  const githubEnabled = github === true;
  const registerEnabled = register === true;
  
  return \`<!DOCTYPE html>
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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: var(--font-sans);
            background: var(--bg-dark);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
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
        .highlight { color: var(--primary); }
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
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">∞ 公益平台</div>
            <div class="subtitle">API 使用说明文档</div>
            <div class="subtitle" style="font-size: 14px; margin-top: 5px; color: var(--text-muted);">
                当前域名: <span class="highlight">\${origin}</span>
            </div>
        </div>
        <div class="card">
            <div class="card-title">服务简介</div>
            <p style="color: var(--text-secondary); line-height: 1.8;">
                \${emailEnabled ? '临时邮箱服务：提供免费的临时邮箱接收邮件，邮件数据会在 24 小时后自动删除，确保隐私安全。' : ''}\${emailEnabled && (githubEnabled || registerEnabled) ? '<br><br>' : ''}
                \${githubEnabled ? 'GitHub 代理服务：通过本域名代理访问 GitHub，支持 Git 克隆、下载等操作。' : ''}\${githubEnabled && registerEnabled ? '<br><br>' : ''}
                \${registerEnabled ? '注册机服务：提供自动化注册功能。' : ''}\${(emailEnabled || githubEnabled || registerEnabled) ? '<br><br>' : ''}
                所有服务均通过 Cloudflare Workers 部署，支持高并发、低延迟访问。
            </p>
        </div>
        
        \${emailEnabled ? \`<div class="card">
            <div class="card-title">邮件 API</div>
            <div class="endpoint">
                <span class="endpoint-method method-get">GET</span>
                <span class="endpoint-path">/api/emails/:email</span>
                <div class="endpoint-desc">
                    获取指定邮箱地址的所有邮件列表
                    <div class="example">
                        <div class="example-title">请求示例</div>
                        <code>GET \${origin}/api/emails/test@example.com</code>
                    </div>
                    <div class="example">
                        <div class="example-title">响应格式</div>
                        <code>{
  "email": "test@example.com",
  "emails": [
    {
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
        </div>\` : ''}
        
        \${githubEnabled ? \`<div class="card">
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
git clone \${origin}/username/repository.git

# 访问仓库页面
curl \${origin}/username/repository

# 下载文件
curl \${origin}/username/repository/raw/main/file.txt</code>
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
        </div>\` : ''}
        
        \${registerEnabled ? \`<div class="card">
            <div class="card-title">注册机 API</div>
            <div class="endpoint">
                <span class="endpoint-method method-post">POST</span>
                <span class="endpoint-path">/api/register</span>
                <div class="endpoint-desc">
                    自动化注册服务
                    <div class="example">
                        <div class="example-title">请求示例</div>
                        <code>POST \${origin}/api/register
Headers: {
  "Content-Type": "application/json"
}
Body: {
  "email": "test@example.com",
  "password": "password123",
  "username": "username",
  "site": "target-site.com"
}</code>
                    </div>
                </div>
            </div>
        </div>\` : ''}
        
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
        <div class="footer">
            <p>Powered by <span class="highlight">VioletTeam</span></p>
            <p style="margin-top: 10px; font-size: 14px;">公益平台 - 免费公益服务</p>
        </div>
    </div>
</body>
</html>\`;
}` : ''}
`;
        
        return code;
    },

    /**
     * 显示 Toast 通知
     */
    showToast(type, title, message) {
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                <div class="toast-title">${Utils.escapeHtml(title)}</div>
                ${message ? `<div class="toast-message">${Utils.escapeHtml(message)}</div>` : ''}
            </div>
        `;

        this.elements.toastContainer.appendChild(toast);

        // 自动消失
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    },

    /**
     * 显示发送邮件模态框
     */
    showSendEmailModal() {
        // 使用当前邮箱前缀作为默认发件人用户名
        if (this.state.currentEmail) {
            const emailParts = this.state.currentEmail.replace(/\/+$/, '').split('@');
            this.elements.sendEmailPrefix.value = emailParts[0] || '';
        } else {
            this.elements.sendEmailPrefix.value = Utils.generateRandomString(10);
        }
        // 清空其他字段
        this.elements.sendEmailTo.value = '';
        this.elements.sendEmailSubject.value = '';
        this.elements.sendEmailText.value = '';
        this.elements.sendEmailHtml.value = '';
        this.elements.sendEmailReplyTo.value = '';
        this.elements.sendEmailStatus.textContent = '';
        this.elements.sendEmailStatus.className = 'send-email-status';
        // 重置内容切换
        this.elements.toggleTextBtn.classList.add('active');
        this.elements.toggleHtmlBtn.classList.remove('active');
        this.elements.sendEmailText.style.display = 'block';
        this.elements.sendEmailHtml.style.display = 'none';
        
        this.elements.sendEmailModal.classList.add('active');
    },

    /**
     * 隐藏发送邮件模态框
     */
    hideSendEmailModal() {
        this.elements.sendEmailModal.classList.remove('active');
    },

    /**
     * 提交发送邮件
     */
    async submitSendEmail() {
        const prefix = this.elements.sendEmailPrefix.value.trim();
        const from = prefix ? `${prefix}@violetteam.cloud` : '';
        const to = this.elements.sendEmailTo.value.trim();
        const subject = this.elements.sendEmailSubject.value.trim();
        const text = this.elements.sendEmailText.value.trim();
        const html = this.elements.sendEmailHtml.value.trim();
        const replyTo = this.elements.sendEmailReplyTo.value.trim();

        // 验证必填字段
        if (!prefix || !to || !subject) {
            this.elements.sendEmailStatus.textContent = '请填写发件人用户名、收件人和主题';
            this.elements.sendEmailStatus.className = 'send-email-status error';
            return;
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            this.elements.sendEmailStatus.textContent = '收件人邮箱格式无效';
            this.elements.sendEmailStatus.className = 'send-email-status error';
            return;
        }

        // 验证至少有一种内容
        if (!text && !html) {
            this.elements.sendEmailStatus.textContent = '请填写邮件内容（文本或HTML）';
            this.elements.sendEmailStatus.className = 'send-email-status error';
            return;
        }

        // 禁用按钮并显示加载状态
        const submitBtn = this.elements.submitSendEmailBtn;
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';

        this.elements.sendEmailStatus.textContent = '发送中...';
        this.elements.sendEmailStatus.className = 'send-email-status';

        try {
            const result = await EmailAPI.sendEmail({
                from,
                to,
                subject,
                text: text || undefined,
                html: html || undefined,
                replyTo: replyTo || undefined
            });

            if (result.success) {
                this.elements.sendEmailStatus.textContent = '邮件发送成功！';
                this.elements.sendEmailStatus.className = 'send-email-status success';
                this.showToast('success', '发送成功', '邮件已成功发送');
                
                // 添加到发件箱（包含 IP、位置和设备信息）
                this.addToSentEmails({
                    from,
                    to,
                    subject,
                    text,
                    html,
                    date: new Date().toISOString(),
                    clientIp: result.clientIp || '',
                    location: result.location || '',
                    device: result.device || ''
                });
                
                // 2秒后关闭模态框
                setTimeout(() => {
                    this.hideSendEmailModal();
                }, 2000);
            } else {
                this.elements.sendEmailStatus.textContent = result.error || '发送失败';
                this.elements.sendEmailStatus.className = 'send-email-status error';
                this.showToast('error', '发送失败', result.error || '未知错误');
            }
        } catch (error) {
            this.elements.sendEmailStatus.textContent = error.message || '发送失败';
            this.elements.sendEmailStatus.className = 'send-email-status error';
            this.showToast('error', '发送失败', error.message || '未知错误');
        } finally {
            // 恢复按钮状态
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
        }
    },

    /**
     * 添加邮件到发件箱
     */
    addToSentEmails(email) {
        this.state.sentEmails.unshift(email);
        // 最多保留 50 封
        if (this.state.sentEmails.length > 50) {
            this.state.sentEmails.pop();
        }
        this.renderSentEmails();
        // 保存到本地存储
        Utils.setStorage('infinitemail_sent_emails', JSON.stringify(this.state.sentEmails));
    },

    /**
     * 渲染发件箱
     */
    renderSentEmails() {
        const container = this.elements.outboxList;
        const badge = this.elements.outboxBadge;
        
        if (!container) return;
        
        // 根据过滤条件筛选邮件
        const allEmails = this.state.sentEmails;
        const filterEmail = this.state.outboxFilterEmail;
        const filteredEmails = filterEmail === 'all' 
            ? allEmails 
            : allEmails.filter(e => e.from === filterEmail);
        
        badge.textContent = filteredEmails.length;
        
        // 更新邮箱下拉菜单
        this.updateOutboxDropdown();
        
        // 更新当前显示的邮箱
        if (this.elements.outboxCurrentEmail) {
            this.elements.outboxCurrentEmail.textContent = filterEmail === 'all' ? '全部' : filterEmail.split('@')[0];
            this.elements.outboxCurrentEmail.title = filterEmail === 'all' ? '全部邮箱' : filterEmail;
        }
        
        if (filteredEmails.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    <p>发件箱为空</p>
                    <span>${filterEmail === 'all' ? '发送的邮件将显示在这里' : '该邮箱没有发送记录'}</span>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filteredEmails.map((email, displayIndex) => {
            // 找到在原始数组中的索引
            const originalIndex = allEmails.indexOf(email);
            const formattedDate = Utils.formatDate(email.date);
            const avatarText = Utils.getAvatarText(email.to);
            const displayName = Utils.getDisplayName(email.to);
            
            // IP、位置和设备显示
            const ipDisplay = email.location || email.clientIp || '';
            const deviceDisplay = email.device || '';
            const hasInfo = ipDisplay || deviceDisplay;
            
            return `
                <div class="mail-item-wrapper sent-wrapper" data-index="${originalIndex}">
                    <div class="mail-item ${displayIndex === 0 ? 'new' : ''} ${hasInfo ? 'has-info' : ''}">
                        <div class="mail-from">
                            <div class="avatar sent-avatar">${Utils.escapeHtml(avatarText)}</div>
                            <span>发给: ${Utils.escapeHtml(Utils.truncate(displayName, 25))}</span>
                        </div>
                        <div class="mail-subject">${Utils.escapeHtml(email.subject) || '(无主题)'}</div>
                        <div class="mail-time">${formattedDate}</div>
                        ${hasInfo ? `<div class="mail-sender-info">
                            ${ipDisplay ? `<span class="mail-location" title="IP: ${Utils.escapeHtml(email.clientIp || '')}">
                                <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                </svg>
                                ${Utils.escapeHtml(ipDisplay)}
                            </span>` : ''}
                            ${deviceDisplay ? `<span class="mail-device" title="${Utils.escapeHtml(deviceDisplay)}">
                                <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                                    <line x1="8" y1="21" x2="16" y2="21"/>
                                    <line x1="12" y1="17" x2="12" y2="21"/>
                                </svg>
                                ${Utils.escapeHtml(deviceDisplay)}
                            </span>` : ''}
                        </div>` : ''}
                    </div>
                    <div class="mail-item-delete">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </div>
                </div>
            `;
        }).join('');

        // 绑定事件
        this.bindSentEmailEvents();
    },

    /**
     * 更新发件箱邮箱下拉菜单
     */
    updateOutboxDropdown() {
        const dropdown = this.elements.outboxDropdown;
        if (!dropdown) return;
        
        // 获取所有发件人邮箱（去重）
        const senderEmails = [...new Set(this.state.sentEmails.map(e => e.from))];
        const filterEmail = this.state.outboxFilterEmail;
        
        let html = `<div class="outbox-dropdown-item ${filterEmail === 'all' ? 'active' : ''}" data-email="all">全部邮箱 (${this.state.sentEmails.length})</div>`;
        
        senderEmails.forEach(email => {
            const count = this.state.sentEmails.filter(e => e.from === email).length;
            html += `<div class="outbox-dropdown-item ${filterEmail === email ? 'active' : ''}" data-email="${Utils.escapeHtml(email)}">${Utils.escapeHtml(email)} (${count})</div>`;
        });
        
        dropdown.innerHTML = html;
        
        // 绑定点击事件
        dropdown.querySelectorAll('.outbox-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const selectedEmail = item.dataset.email;
                this.state.outboxFilterEmail = selectedEmail;
                this.hideOutboxDropdown();
                this.renderSentEmails();
            });
        });
    },

    /**
     * 切换发件箱下拉菜单
     */
    toggleOutboxDropdown() {
        const dropdown = this.elements.outboxDropdown;
        const selector = this.elements.outboxEmailSelector;
        if (!dropdown || !selector) return;
        
        const isActive = dropdown.classList.contains('active');
        if (isActive) {
            this.hideOutboxDropdown();
        } else {
            dropdown.classList.add('active');
            selector.classList.add('active');
        }
    },

    /**
     * 隐藏发件箱下拉菜单
     */
    hideOutboxDropdown() {
        const dropdown = this.elements.outboxDropdown;
        const selector = this.elements.outboxEmailSelector;
        if (dropdown) dropdown.classList.remove('active');
        if (selector) selector.classList.remove('active');
    },

    /**
     * 绑定发件箱事件
     */
    bindSentEmailEvents() {
        const container = this.elements.outboxList;
        if (!container) return;

        container.querySelectorAll('.sent-wrapper').forEach(wrapper => {
            const item = wrapper.querySelector('.mail-item');
            const index = parseInt(wrapper.dataset.index);
            
            // 点击查看详情
            item.addEventListener('click', () => {
                if (!wrapper.classList.contains('swiping') && !wrapper.dataset.hasSwiped) {
                    this.showSentEmailDetail(index);
                }
                delete wrapper.dataset.hasSwiped;
            });
            
            // 右键菜单
            wrapper.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showSentContextMenu(e, index);
            });
        });

        // 初始化滑动删除
        this.initSentSwipeDelete();
    },

    /**
     * 显示已发送邮件详情
     */
    showSentEmailDetail(index) {
        const email = this.state.sentEmails[index];
        if (!email) return;
        
        // 更新模态框标题
        this.elements.modalTitle.textContent = email.subject || '(无主题)';
        
        // 更新元数据
        this.elements.detailFrom.textContent = email.from || '-';
        this.elements.detailTo.textContent = email.to || '-';
        this.elements.detailSubject.textContent = email.subject || '(无主题)';
        this.elements.detailDate.textContent = Utils.formatDate(email.date);
        
        // 更新内容
        this.elements.textContent.textContent = email.text || '(无文本内容)';
        
        // 渲染 HTML 内容
        if (email.html) {
            this.renderHtmlContent(email.html);
        } else {
            this.elements.htmlContent.srcdoc = '<p style="color:#666;padding:20px;">无 HTML 内容</p>';
        }
        
        // 设置视图模式
        this.setViewMode(this.state.viewMode);
        
        // 显示模态框
        this.elements.mailModal.classList.add('active');
    },

    /**
     * 显示发件箱右键菜单
     */
    showSentContextMenu(e, index) {
        const menu = this.elements.contextMenu;
        if (!menu) return;
        
        menu.style.display = 'block';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.dataset.index = index;
        menu.dataset.type = 'sent';
        
        // 确保菜单不会超出屏幕
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - rect.height - 10}px`;
        }
    },

    /**
     * 初始化发件箱滑动删除
     */
    initSentSwipeDelete() {
        const container = this.elements.outboxList;
        if (!container) return;

        const minSwipeDistance = 50;
        const minPressTime = 100;

        container.querySelectorAll('.sent-wrapper').forEach(wrapper => {
            let startX = 0;
            let currentX = 0;
            let touchHasMoved = false;
            let touchStartTime = 0;

            // 触摸事件
            wrapper.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                touchHasMoved = false;
                touchStartTime = Date.now();
            }, { passive: true });

            wrapper.addEventListener('touchmove', (e) => {
                currentX = e.touches[0].clientX;
                const diff = startX - currentX;
                
                if (diff > 20) {
                    touchHasMoved = true;
                    wrapper.classList.add('swiping');
                    wrapper.style.transform = `translateX(${-Math.min(diff, 80)}px)`;
                }
            }, { passive: true });

            wrapper.addEventListener('touchend', () => {
                const diff = startX - currentX;
                const pressTime = Date.now() - touchStartTime;
                
                if (touchHasMoved && diff > minSwipeDistance && pressTime > minPressTime) {
                    wrapper.dataset.hasSwiped = 'true';
                    const index = parseInt(wrapper.dataset.index);
                    this.deleteSentEmail(index);
                }
                
                wrapper.style.transform = '';
                setTimeout(() => wrapper.classList.remove('swiping'), 300);
            });

            // 鼠标事件
            let mouseStartX = 0;
            let mouseCurrentX = 0;
            let mouseHasMoved = false;
            let mouseDownTime = 0;
            let isMouseDown = false;

            wrapper.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                mouseStartX = e.clientX;
                mouseHasMoved = false;
                mouseDownTime = Date.now();
                isMouseDown = true;
            });

            wrapper.addEventListener('mousemove', (e) => {
                if (!isMouseDown) return;
                mouseCurrentX = e.clientX;
                const diff = mouseStartX - mouseCurrentX;
                
                if (diff > 20) {
                    mouseHasMoved = true;
                    wrapper.classList.add('swiping');
                    wrapper.style.transform = `translateX(${-Math.min(diff, 80)}px)`;
                    e.preventDefault();
                }
            });

            wrapper.addEventListener('mouseup', (e) => {
                if (!isMouseDown) return;
                isMouseDown = false;
                
                const diff = mouseStartX - mouseCurrentX;
                const pressTime = Date.now() - mouseDownTime;
                
                if (mouseHasMoved && diff > minSwipeDistance && pressTime > minPressTime) {
                    wrapper.dataset.hasSwiped = 'true';
                    const index = parseInt(wrapper.dataset.index);
                    this.deleteSentEmail(index);
                }
                
                wrapper.style.transform = '';
                setTimeout(() => wrapper.classList.remove('swiping'), 300);
            });

            wrapper.addEventListener('mouseleave', () => {
                if (isMouseDown) {
                    isMouseDown = false;
                    wrapper.style.transform = '';
                    wrapper.classList.remove('swiping');
                }
            });
        });
    },

    /**
     * 删除已发送邮件
     */
    deleteSentEmail(index) {
        if (index < 0 || index >= this.state.sentEmails.length) return;
        
        this.state.sentEmails.splice(index, 1);
        this.renderSentEmails();
        Utils.setStorage('infinitemail_sent_emails', JSON.stringify(this.state.sentEmails));
        this.showToast('success', '已删除', '邮件已从发件箱删除');
    },

    /**
     * 加载已发送邮件
     */
    loadSentEmails() {
        try {
            const saved = Utils.getStorage('infinitemail_sent_emails');
            if (saved) {
                this.state.sentEmails = JSON.parse(saved);
                this.renderSentEmails();
            }
        } catch (e) {
            console.error('加载发件箱失败:', e);
        }
    },

    /**
     * 播放通知音
     */
    playNotificationSound() {
        try {
            // 使用 Web Audio API 播放简单的提示音
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.15);
        } catch (e) {
            // 静默失败
        }
    }
};

// 管理后台模块（使用远程 API）
const Admin = {
    elements: {},
    isLoading: false,

    init() {
        this.cacheElements();
        this.bindEvents();
        this.checkRoute();
        
        // 监听路由变化
        window.addEventListener('hashchange', () => this.checkRoute());
    },

    cacheElements() {
        this.elements = {
            modal: document.getElementById('adminModal'),
            closeBtn: document.getElementById('closeAdminBtn'),
            tabs: document.querySelectorAll('.admin-tab'),
            domainsContent: document.getElementById('adminDomains'),
            domainList: document.getElementById('adminDomainList'),
            // 添加域名
            newDomainName: document.getElementById('newDomainName'),
            newDomainApi: document.getElementById('newDomainApi'),
            addDomainBtn: document.getElementById('addDomainBtn'),
            // 管理员密钥
            adminKeyInput: document.getElementById('adminKeyInput')
        };
    },

    bindEvents() {
        // 关闭按钮
        this.elements.closeBtn.addEventListener('click', () => this.hide());
        
        // 点击遮罩关闭
        this.elements.modal.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) this.hide();
        });

        // Tab 切换
        this.elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // 添加域名
        this.elements.addDomainBtn.addEventListener('click', () => this.addDomain());

        // 管理员密钥变化时保存
        if (this.elements.adminKeyInput) {
            this.elements.adminKeyInput.addEventListener('change', (e) => {
                EmailAPI.setAdminKey(e.target.value);
            });
        }
    },

    checkRoute() {
        if (window.location.hash === '#freeadmin') {
            this.show();
        }
    },

    async show() {
        this.elements.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // 从本地恢复管理员密钥
        const savedKey = Utils.getStorage('admin_key', '');
        if (this.elements.adminKeyInput) {
            this.elements.adminKeyInput.value = savedKey;
            EmailAPI.setAdminKey(savedKey);
        }
        
        await this.renderDomainList();
        await this.renderDonorList();
    },

    hide() {
        this.elements.modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // 保存管理员密钥
        if (this.elements.adminKeyInput) {
            Utils.setStorage('admin_key', this.elements.adminKeyInput.value);
        }
        
        // 清除路由
        if (window.location.hash === '#freeadmin') {
            history.pushState('', document.title, window.location.pathname);
        }
    },

    switchTab(tab) {
        this.elements.tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        this.elements.domainsContent.style.display = tab === 'domains' ? 'block' : 'none';
    },

    // 域名管理（使用远程 API）
    async addDomain() {
        const name = this.elements.newDomainName.value.trim();
        const api = this.elements.newDomainApi.value.trim();

        if (!name || !api) {
            App.showToast('error', '错误', '请填写域名和API地址');
            return;
        }

        if (this.isLoading) return;
        this.isLoading = true;
        this.elements.addDomainBtn.disabled = true;
        this.elements.addDomainBtn.textContent = '添加中...';

        try {
            const result = await EmailAPI.addDomain(name, api);
            
            if (result.success) {
                await this.renderDomainList();
                App.renderDomainSelector();
                this.elements.newDomainName.value = '';
                this.elements.newDomainApi.value = '';
                App.showToast('success', '成功', `已添加域名 ${name}`);
            } else {
                App.showToast('error', '错误', result.error || '添加失败');
            }
        } catch (e) {
            App.showToast('error', '错误', e.message);
        } finally {
            this.isLoading = false;
            this.elements.addDomainBtn.disabled = false;
            this.elements.addDomainBtn.textContent = '添加域名';
        }
    },

    async deleteDomain(name) {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            const result = await EmailAPI.deleteDomain(name);
            
            if (result.success) {
                await this.renderDomainList();
                App.renderDomainSelector();
                App.showToast('success', '成功', `已删除域名 ${name}`);
            } else {
                App.showToast('error', '错误', result.error || '删除失败');
            }
        } catch (e) {
            App.showToast('error', '错误', e.message);
        } finally {
            this.isLoading = false;
        }
    },

    async renderDomainList() {
        const domains = EmailAPI.DOMAINS;
        if (domains.length === 0) {
            this.elements.domainList.innerHTML = '<div class="admin-empty">暂无域名</div>';
            return;
        }

        this.elements.domainList.innerHTML = domains.map(d => `
            <div class="admin-list-item">
                <div class="item-info">
                    <span class="item-name">${Utils.escapeHtml(d.name)}</span>
                    <span class="item-detail">${Utils.escapeHtml(d.api)}</span>
                </div>
            </div>
        `).join('');
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化应用（域名通过 API 加载）
    App.init();
    Admin.init();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    App.stopAutoRefresh();
});

