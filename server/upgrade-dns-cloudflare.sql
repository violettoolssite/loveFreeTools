-- 为 DNS 记录表添加 Cloudflare 记录 ID 字段
-- 运行方式: mysql -u root -p free_email < server/upgrade-dns-cloudflare.sql

-- 添加 Cloudflare 记录 ID 列
ALTER TABLE dns_records 
    ADD COLUMN cf_record_id VARCHAR(64) DEFAULT NULL AFTER owner_email;

-- 添加索引
ALTER TABLE dns_records ADD INDEX idx_cf_record_id (cf_record_id);

-- 显示表结构
DESCRIBE dns_records;

