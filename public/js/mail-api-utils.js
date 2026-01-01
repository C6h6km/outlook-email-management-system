/**
 * 邮件 API 工具函数
 * 统一处理 API URL 构建和调用，消除代码重复
 *
 * ⚠️ 安全改进：邮件 API 调用通过后端代理，API 密码在后端配置，不再暴露在前端
 */

/**
 * 构建邮件 API URL（通过后端代理）
 * @param {string} endpoint - API 端点（如 'emails', 'process-inbox', 'process-junk'）
 * @param {object} mailbox - 邮箱对象
 * @param {object} extraParams - 额外的查询参数
 * @returns {string} 完整的后端代理 API URL
 */
export function buildMailApiUrl(endpoint, mailbox, extraParams = {}) {
    // 使用后端代理 API（不再直接调用外部 API）
    const backendProxyUrl = '/api/proxy/mail';

    const params = new URLSearchParams({
        refresh_token: mailbox.refresh_token,
        client_id: mailbox.client_id,
        email: mailbox.email,
        ...extraParams
    });

    // 注意：密码已移除，现在由后端从环境变量读取

    return `${backendProxyUrl}/${endpoint}?${params.toString()}`;
}

/**
 * 调用邮件 API（带统一错误处理）
 * @param {string} url - API URL
 * @param {object} options - fetch 选项
 * @returns {Promise<any>} API 响应数据
 */
export async function callMailApi(url, options = {}) {
    const response = await fetch(url, options);

    // 检查 HTTP 状态
    if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // 检查 API 级别的错误
    if (data.error || data.message) {
        throw new Error(data.message || data.error || 'API 返回错误');
    }

    return data;
}

/**
 * 从 API 响应中提取邮件数组
 * @param {any} data - API 响应数据
 * @returns {Array} 邮件数组
 */
export function extractEmailsFromResponse(data) {
    let emails = [];

    if (Array.isArray(data)) {
        emails = data;
    } else if (data && data.data && Array.isArray(data.data)) {
        emails = data.data;
    } else if (data && !data.error && !data.message) {
        // 只有在不是错误响应时才当作邮件数据
        emails = [data];
    }

    // 按日期排序（最新的在前）
    emails.sort((a, b) => {
        const dateA = new Date(a.date || a.timestamp || 0);
        const dateB = new Date(b.date || b.timestamp || 0);
        return dateB - dateA;
    });

    return emails;
}

/**
 * 验证邮箱对象
 * @param {object} mailbox - 邮箱对象
 * @throws {Error} 如果邮箱对象无效
 */
export function validateMailbox(mailbox) {
    if (!mailbox) {
        throw new Error('请先选择一个邮箱');
    }

    const required = ['refresh_token', 'client_id', 'email'];
    for (const field of required) {
        if (!mailbox[field]) {
            throw new Error(`邮箱缺少必要字段: ${field}`);
        }
    }
}

/**
 * 获取当前选中的邮箱
 * @param {object} appState - 应用状态对象
 * @returns {object} 邮箱对象
 * @throws {Error} 如果没有选中邮箱
 */
export function getSelectedMailbox(appState) {
    if (appState.selectedMailboxIndex === -1) {
        throw new Error('请先选择一个邮箱');
    }

    const mailbox = appState.mailboxes[appState.selectedMailboxIndex];
    validateMailbox(mailbox);
    return mailbox;
}
