/**
 * Vercel Blob 存储工具
 * 在服务端读/写 JSON 文件到 Vercel Blob。
 * 说明：
 * - 需要在环境变量中配置 BLOB_READ_WRITE_TOKEN（Vercel Blob 的 RW Token）
 * - 可选：BLOB_BASE_URL（默认 https://blob.vercel-storage.com）
 */

const BLOB_BASE_URL = process.env.BLOB_BASE_URL || 'https://blob.vercel-storage.com';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';

function assertBlobToken() {
    if (!BLOB_TOKEN) {
        throw new Error('缺少环境变量 BLOB_READ_WRITE_TOKEN，无法使用 Vercel Blob');
    }
}

/**
 * 读取 JSON Blob 内容
 * @param {string} key 对象键（路径），例如 'mailboxes/mailboxes.json'
 * @returns {Promise<any|null>} 解析后的 JSON；不存在时返回 null
 */
async function readJSONBlob(key) {
    assertBlobToken();
    const url = `${BLOB_BASE_URL}/${encodeURIComponent(key)}`;
    const resp = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${BLOB_TOKEN}`,
        },
    });

    if (resp.status === 404) return null;
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`读取 Blob 失败: ${resp.status} ${resp.statusText} ${text}`);
    }
    const text = await resp.text();
    try {
        return JSON.parse(text);
    } catch {
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
    const { put } = await import('@vercel/blob');
    const body = JSON.stringify(data, null, 2);
    await put(key, body, {
        access: 'private',
        contentType: 'application/json; charset=utf-8',
    });
}

module.exports = {
    readJSONBlob,
    writeJSONBlob,
};


