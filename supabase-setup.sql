-- 创建邮箱配置表
CREATE TABLE IF NOT EXISTS mailboxes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    refresh_token TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_mailboxes_email ON mailboxes(email);
CREATE INDEX IF NOT EXISTS idx_mailboxes_created_at ON mailboxes(created_at);
CREATE INDEX IF NOT EXISTS idx_mailboxes_is_active ON mailboxes(is_active);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
DROP TRIGGER IF EXISTS update_mailboxes_updated_at ON mailboxes;
CREATE TRIGGER update_mailboxes_updated_at
    BEFORE UPDATE ON mailboxes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略 (RLS)
ALTER TABLE mailboxes ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有操作（可以根据需要调整）
CREATE POLICY "Enable all operations for mailboxes" ON mailboxes
    FOR ALL USING (true);

-- 注释
COMMENT ON TABLE mailboxes IS '邮箱配置信息表';
COMMENT ON COLUMN mailboxes.id IS '主键ID';
COMMENT ON COLUMN mailboxes.email IS '邮箱地址';
COMMENT ON COLUMN mailboxes.password IS '邮箱密码';
COMMENT ON COLUMN mailboxes.client_id IS 'OAuth客户端ID';
COMMENT ON COLUMN mailboxes.refresh_token IS 'OAuth刷新令牌';
COMMENT ON COLUMN mailboxes.created_at IS '创建时间';
COMMENT ON COLUMN mailboxes.updated_at IS '更新时间';
COMMENT ON COLUMN mailboxes.is_active IS '是否激活';
