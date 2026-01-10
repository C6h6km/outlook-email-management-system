/**
 * Mock Blob Store - 测试专用内存存储
 * 用于替代真实的 Vercel Blob 存储，避免测试污染生产数据
 */

// 内存存储
const memoryStore = new Map();

/**
 * 读取 JSON 数据（模拟）
 */
async function readJSONBlob(key) {
    const data = memoryStore.get(key);
    if (data === undefined) {
        return null;
    }
    // 返回深拷贝，避免引用污染
    return JSON.parse(JSON.stringify(data));
}

/**
 * 写入 JSON 数据（模拟）
 */
async function writeJSONBlob(key, data) {
    // 存储深拷贝
    memoryStore.set(key, JSON.parse(JSON.stringify(data)));
    return { url: `mock://blob/${key}` };
}

/**
 * 清空所有数据（测试清理用）
 */
function clearAll() {
    memoryStore.clear();
}

/**
 * 获取存储的所有键（调试用）
 */
function getAllKeys() {
    return Array.from(memoryStore.keys());
}

/**
 * 获取指定键的数据（调试用）
 */
function getData(key) {
    return memoryStore.get(key);
}

module.exports = {
    readJSONBlob,
    writeJSONBlob,
    clearAll,
    getAllKeys,
    getData,
};
