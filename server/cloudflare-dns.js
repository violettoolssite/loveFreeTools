/**
 * Cloudflare DNS API 管理模块
 * 用于自动创建/更新/删除 Cloudflare DNS 记录
 */

const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';

// Zone IDs 配置（需要在环境变量中设置）
const ZONE_CONFIG = {
    'lovefreetools.site': process.env.CF_ZONE_LOVEFREETOOLS,
    'violet27team.xyz': process.env.CF_ZONE_VIOLET27TEAM
};

const CF_API_TOKEN = process.env.CF_DNS_API_TOKEN;

/**
 * 创建 DNS 记录
 */
async function createDnsRecord(domain, subdomain, type, value, ttl = 3600, proxied = false) {
    const zoneId = ZONE_CONFIG[domain];
    if (!zoneId) {
        throw new Error(`未配置的域名: ${domain}`);
    }
    
    const name = subdomain === '@' ? domain : `${subdomain}.${domain}`;
    
    const response = await fetch(`${CLOUDFLARE_API}/zones/${zoneId}/dns_records`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            type: type,
            name: name,
            content: value,
            ttl: ttl,
            proxied: proxied
        })
    });
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.errors?.[0]?.message || 'Cloudflare API 错误');
    }
    
    return {
        id: data.result.id,
        name: data.result.name,
        type: data.result.type,
        content: data.result.content
    };
}

/**
 * 更新 DNS 记录
 */
async function updateDnsRecord(domain, recordId, type, value, ttl = 3600, proxied = false, subdomain = null) {
    const zoneId = ZONE_CONFIG[domain];
    if (!zoneId) {
        throw new Error(`未配置的域名: ${domain}`);
    }
    
    const name = subdomain ? (subdomain === '@' ? domain : `${subdomain}.${domain}`) : undefined;
    
    const body = {
        type: type,
        content: value,
        ttl: ttl,
        proxied: proxied
    };
    
    if (name) body.name = name;
    
    const response = await fetch(`${CLOUDFLARE_API}/zones/${zoneId}/dns_records/${recordId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.errors?.[0]?.message || 'Cloudflare API 错误');
    }
    
    return data.result;
}

/**
 * 删除 DNS 记录
 */
async function deleteDnsRecord(domain, recordId) {
    const zoneId = ZONE_CONFIG[domain];
    if (!zoneId) {
        throw new Error(`未配置的域名: ${domain}`);
    }
    
    const response = await fetch(`${CLOUDFLARE_API}/zones/${zoneId}/dns_records/${recordId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`
        }
    });
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.errors?.[0]?.message || 'Cloudflare API 错误');
    }
    
    return true;
}

/**
 * 查询 DNS 记录
 */
async function getDnsRecords(domain, subdomain = null) {
    const zoneId = ZONE_CONFIG[domain];
    if (!zoneId) {
        throw new Error(`未配置的域名: ${domain}`);
    }
    
    let url = `${CLOUDFLARE_API}/zones/${zoneId}/dns_records`;
    if (subdomain) {
        const name = subdomain === '@' ? domain : `${subdomain}.${domain}`;
        url += `?name=${encodeURIComponent(name)}`;
    }
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`
        }
    });
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.errors?.[0]?.message || 'Cloudflare API 错误');
    }
    
    return data.result;
}

module.exports = {
    createDnsRecord,
    updateDnsRecord,
    deleteDnsRecord,
    getDnsRecords,
    ZONE_CONFIG
};

