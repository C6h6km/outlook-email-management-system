/**
 * Vercel Blob 存储工具
 * 在服务端读/写 JSON 文件到 Vercel Blob。
 * 说明：
 * - 需要在环境变量中配置 outlook_READ_WRITE_TOKEN（Vercel Blob 的 RW Token）
 * - 可选：BLOB_BASE_URL（默认 https://blob.vercel-storage.com）
 */

const BLOB_BASE_URL = process.env.BLOB_BASE_URL || 'https://blob.vercel-storage.com';
const crypto = require('crypto');
// 优先使用 Vercel 自动注入的环境变量，兼容自定义变量名
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.outlook_READ_WRITE_TOKEN || '';

function assertBlobToken() {
    if (!BLOB_TOKEN) {
        throw new Error('缺少 Blob Token（请设置 outlook_READ_WRITE_TOKEN）');
    }
}

// 可选：开启透明加密，防止在 public 访问级别下泄露敏感数据
const ENC_ALGO = 'aes-256-gcm';

function getEncryptionKey() {
    const secret = process.env.BLOB_ENCRYPTION_KEY || '';
    if (!secret) return null;
    // 尝试 base64
    try {
        const buf = Buffer.from(secret, 'base64');
        if (buf.length === 32) return buf;
    } catch {}
    // 尝试 hex
    try {
        const buf = Buffer.from(secret, 'hex');
        if (buf.length === 32) return buf;
    } catch {}
    // 兜底：对任意字符串做 SHA-256 得到 32 字节密钥
    return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function encryptJSON(value, key) {
    const iv = crypto.randomBytes(12); // GCM 建议 12 字节 IV
    const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);
    const plaintext = typeof value === 'string' ? value : JSON.stringify(value);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        __enc: ENC_ALGO,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        data: ciphertext.toString('base64'),
    };
}

function tryDecryptWrapper(parsed) {
    const key = getEncryptionKey();
    if (!key) return null;
    try {
        if (parsed && parsed.__enc === ENC_ALGO && parsed.iv && parsed.tag && parsed.data) {
            const iv = Buffer.from(parsed.iv, 'base64');
            const tag = Buffer.from(parsed.tag, 'base64');
            const ciphertext = Buffer.from(parsed.data, 'base64');
            const decipher = crypto.createDecipheriv(ENC_ALGO, key, iv);
            decipher.setAuthTag(tag);
            const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
            return JSON.parse(plaintext);
        }
    } catch (e) {
        console.warn('Blob 解密失败:', e.message);
        return null;
    }
    return null;
}

/**
 * 读取 JSON Blob 内容
 * @param {string} key 对象键（路径），例如 'mailboxes/mailboxes.json'
 * @returns {Promise<any|null>} 解析后的 JSON；不存在时返回 null
 */
async function readJSONBlob(key) {
    assertBlobToken();
    
    try {
        // 使用 list API 查找 blob
        const { list } = await import('@vercel/blob');
        const { blobs } = await list({
            token: BLOB_TOKEN,
            prefix: key,
        });
        
        // 查找精确匹配的 blob
        const blob = blobs.find(b => b.pathname === key);
        if (!blob) {
            console.log(`[Blob] 读取失败 - 文件不存在: ${key}`);
            return null;
        }
        
        // 使用 blob 的下载 URL 读取内容
        const resp = await fetch(blob.downloadUrl, {
            method: 'GET',
            headers: {
                // 禁用缓存，确保读取最新数据
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
            },
        });
        
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            console.error(`[Blob] 读取失败: ${key}, 状态: ${resp.status}`);
            throw new Error(`读取 Blob 失败: ${resp.status} ${resp.statusText} ${text}`);
        }
        
        const text = await resp.text();
        const parsed = JSON.parse(text);
        console.log(`[Blob] ✅ 成功读取: ${key}, 数据项数: ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
        
        if (parsed && parsed.__enc) {
            const decrypted = tryDecryptWrapper(parsed);
            return decrypted ?? null;
        }
        return parsed;
    } catch (err) {
        if (err.message.includes('不存在')) {
            return null;
        }
        console.error(`[Blob] 读取或解析失败: ${key}`, err);
        return null;
    }
}

/**
 * 将 JSON 写入 Blob
 * @param {string} key 对象键（路径）
 * @param {any} data 可序列化的对象
 */
async function writeJSONBlob(key, data) {
    assertBlobToken();
    const { put, del, list } = await import('@vercel/blob');
    const encryptionKey = getEncryptionKey();
    const payload = encryptionKey
        ? JSON.stringify(encryptJSON(data, encryptionKey))
        : JSON.stringify(data, null, 2);
    
    console.log(`[Blob] 准备写入: ${key}, 数据长度: ${payload.length} 字节`);
    
    // 先尝试删除已存在的 blob（如果存在）
    try {
        // 使用 list API 查找匹配的 blob
        const { blobs } = await list({
            token: BLOB_TOKEN,
            prefix: key,
        });
        
        // 删除所有匹配的 blob（通常只有一个）
        for (const blob of blobs) {
            if (blob.pathname === key) {
                await del(blob.url, { token: BLOB_TOKEN });
                console.log(`[Blob] 已删除旧 blob: ${key}`);
            }
        }
    } catch (err) {
        // 忽略删除错误（可能不存在）
        console.log(`[Blob] 删除旧 blob 时出错（可能不存在）: ${err.message}`);
    }
    
    // 创建新的 blob
    try {
        const result = await put(key, payload, {
            access: 'public',
            contentType: 'application/json; charset=utf-8',
            token: BLOB_TOKEN, // 显式传入 token
            addRandomSuffix: false, // 不添加随机后缀
        });
        console.log(`[Blob] ✅ 成功创建新 blob: ${key}, URL: ${result.url}`);
        return result;
    } catch (err) {
        console.error(`[Blob] ❌ 创建新 blob 失败: ${key}`, err);
        throw err;
    }
}

module.exports = {
    readJSONBlob,
    writeJSONBlob,
};


