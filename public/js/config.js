/**
 * 配置管理模块
 * 统一管理应用配置、环境变量、常量等
 */

// 环境检测
const isDevelopment = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.protocol === 'file:';

const isProduction = !isDevelopment;

// API 基础配置
export const API_CONFIG = {
    // API 基础地址（自动根据环境判断）
    BASE_URL: isDevelopment ? 'http://localhost:3001/api' : '/api',
    
    // 超时配置
    TIMEOUT: 30000, // 30秒
    
    // 重试配置
    RETRY_TIMES: 3,
    RETRY_DELAY: 1000,
    
    // 请求头
    HEADERS: {
        'Content-Type': 'application/json',
    }
};

// 应用配置
export const APP_CONFIG = {
    // 应用名称
    NAME: 'Easy Outlook',
    VERSION: '1.2.0',
    
    // 存储键名前缀
    STORAGE_PREFIX: 'easy_outlook_',
    
    // 分页配置
    PAGE_SIZE: 50,
    
    // 虚拟滚动配置
    VIRTUAL_SCROLL: {
        ITEM_HEIGHT: 80,      // 邮件项高度
        BUFFER_SIZE: 3,       // 缓冲区大小
        ENABLED_THRESHOLD: 100 // 超过100项启用虚拟滚动
    },
    
    // 防抖节流配置
    DEBOUNCE_DELAY: 300,  // 防抖延迟
    THROTTLE_DELAY: 200,  // 节流延迟
    
    // 状态消息显示时长
    MESSAGE_DURATION: 5000,
    
    // 本地存储键名
    STORAGE_KEYS: {
        API_PASSWORD: 'apiPassword',
        API_BASE_URL: 'apiBaseUrl',
        PURCHASE_LIBRARY: 'purchaseLibrary',
        IMPORT_SECTION_COLLAPSED: 'importSectionCollapsed',
        PURCHASE_SECTION_COLLAPSED: 'purchaseSectionCollapsed',
        MAILBOX_SECTION_COLLAPSED: 'mailboxSectionCollapsed',
    }
};

// 采购API配置
export const PURCHASE_CONFIG = {
    // 内置默认凭证（生产环境应该从环境变量读取）
    DEFAULT_APP_ID: '1097',
    DEFAULT_APP_KEY: 'A2380737CA36CC61',
    
    // 仓库配置
    LIBRARIES: {
        '1': {
            name: '一号库',
            base: 'https://outlook007.cc/api',
            items: [
                { id: '1', name: '短效hotmail带令牌' },
                { id: '2', name: '短效outlook带令牌' },
                { id: '13', name: '日本短效outlook带令牌' },
                { id: '14', name: '德国短效outlook带令牌' },
                { id: '15', name: '意大利短效outlook带令牌' },
            ],
        },
        '2': {
            name: '二号库',
            base: 'https://outlook007.cc/api1',
            items: [
                { id: '3', name: '短效hotmail带令牌' },
                { id: '4', name: '短效outlook带令牌' },
            ],
        },
    },
    
    // 购买限制
    MIN_PURCHASE: 1,
    MAX_PURCHASE: 2000,
};

// 邮件文件夹配置
export const MAIL_FOLDERS = {
    INBOX: { value: 'INBOX', label: '收件箱' },
    JUNK: { value: 'Junk', label: '垃圾邮件' },
    SENT: { value: 'Sent', label: '已发送' },
    DRAFTS: { value: 'Drafts', label: '草稿箱' },
};

// 响应类型配置
export const RESPONSE_TYPES = {
    JSON: 'json',
    HTML: 'html',
};

// 错误消息配置
export const ERROR_MESSAGES = {
    NETWORK_ERROR: '网络错误，请检查网络连接',
    TIMEOUT_ERROR: '请求超时，请稍后重试',
    SERVER_ERROR: '服务器错误，请联系管理员',
    AUTH_ERROR: '认证失败，请检查API密码',
    NOT_FOUND: '资源未找到',
    VALIDATION_ERROR: '数据验证失败',
    UNKNOWN_ERROR: '未知错误',
};

// HTTP 状态码
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};

// 环境配置
export const ENV = {
    isDevelopment,
    isProduction,
    
    // 开发环境专用配置
    debug: isDevelopment,
    logLevel: isDevelopment ? 'debug' : 'error',
};

// 获取完整的存储键名
export function getStorageKey(key) {
    return `${APP_CONFIG.STORAGE_PREFIX}${key}`;
}

// 获取API地址（支持自定义）
export function getApiBaseUrl() {
    const customUrl = localStorage.getItem(getStorageKey(APP_CONFIG.STORAGE_KEYS.API_BASE_URL));
    return customUrl || API_CONFIG.BASE_URL;
}

// 获取配置值（支持默认值）
export function getConfig(path, defaultValue) {
    const keys = path.split('.');
    let value = { APP_CONFIG, API_CONFIG, PURCHASE_CONFIG }[keys[0]];
    
    for (let i = 1; i < keys.length; i++) {
        if (value === undefined) break;
        value = value[keys[i]];
    }
    
    return value !== undefined ? value : defaultValue;
}

// 导出默认配置对象
export default {
    API_CONFIG,
    APP_CONFIG,
    PURCHASE_CONFIG,
    MAIL_FOLDERS,
    RESPONSE_TYPES,
    ERROR_MESSAGES,
    HTTP_STATUS,
    ENV,
    getStorageKey,
    getApiBaseUrl,
    getConfig,
};



