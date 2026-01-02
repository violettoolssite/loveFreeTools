-- 清空 DNS 记录表
TRUNCATE TABLE dns_records;

-- 添加用户管理密钥字段（如果不存在）
ALTER TABLE dns_records ADD COLUMN IF NOT EXISTS user_key_hash VARCHAR(64) DEFAULT NULL AFTER owner_email;

-- 如果上面的语法不支持，使用这个：
-- ALTER TABLE dns_records ADD COLUMN user_key_hash VARCHAR(64) DEFAULT NULL;

