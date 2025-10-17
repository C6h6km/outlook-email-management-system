/**
 * Easy Outlook - 主应用程序
 * 性能优化版本
 * v2.0 - 增强错误处理
 */

import { debounce, throttle, escapeHtml, formatDate, batchUpdateDOM } from './utils.js';
import { EmailListManager, MailboxListManager } from './email-list-manager.js';
import { errorHandler, ErrorBoundary, ErrorRecovery } from './error-handler.js';

// 应用状态
const AppState = {
    mailboxes: [],
    selectedMailboxIndex: -1,
    emailListData: [],
    selectedEmailIndex: -1,
    apiBaseUrl: '',
    apiPassword: '',
};

// API配置（简化版，避免循环依赖）
const API_CONFIG = {
    BASE_URL: (window.location.protocol === 'file:' || 
               window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3001/api'
        : '/api'
};

const SUPABASE_API_BASE = API_CONFIG.BASE_URL;

// 采购仓库与商品映射
const LIBRARIES = {
    '1': {
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
        base: 'https://outlook007.cc/api1',
        items: [
            { id: '3', name: '短效hotmail带令牌' },
            { id: '4', name: '短效outlook带令牌' },
        ],
    },
};

// 管理器实例
let emailListManager = null;
let mailboxListManager = null;

/**
 * 初始化应用
 */
export async function initApp() {
    console.log('🚀 应用启动中...');
    
    try {
        // 初始化全局错误处理器
        errorHandler.init();
        console.log('✅ 全局错误处理器已初始化');
        
        // 创建错误边界
        const mainContentBoundary = new ErrorBoundary(
            document.querySelector('.main-content'),
            {
                onError: (error) => {
                    console.error('主内容区域错误:', error);
                }
            }
        );
        
        const emailListBoundary = new ErrorBoundary(
            document.querySelector('.email-sidebar'),
            {
                onError: (error) => {
                    console.error('邮件列表区域错误:', error);
                }
            }
        );
        
        // 初始化列表管理器（使用错误边界包装）
        emailListManager = new EmailListManager('#emailList');
        mailboxListManager = new MailboxListManager('#mailboxList');
        
        // 设置回调（使用错误边界包装）
        emailListManager.onSelect(mainContentBoundary.wrap(async (email, index) => {
            AppState.selectedEmailIndex = index;
            await displaySelectedEmail(email);
        }));
        
        mailboxListManager.onSelect(emailListBoundary.wrap(async (mailbox, index) => {
            AppState.selectedMailboxIndex = index;
            setStatusMessage(`已选择邮箱: ${mailbox.email}`, 'success');
            await loadEmailListInternal();
        }));
        
        mailboxListManager.onDelete(emailListBoundary.wrap(async (mailbox, index) => {
            await deleteMailbox(index);
        }));
        
        // 加载保存的设置
        loadSettings();
        
        // 加载邮箱数据（带错误恢复）
        await ErrorRecovery.withFallback(
            () => loadMailboxesFromStorage(),
            (error) => {
                console.error('加载邮箱失败，使用空列表:', error);
                setStatusMessage('加载邮箱数据失败，请刷新重试', 'error');
                return [];
            }
        );
        
        // 初始化UI组件
        initUIComponents();
        
        // 初始化采购相关
        initPurchaseLibrary();
        
        console.log('✅ 应用启动完成');
        
    } catch (error) {
        console.error('❌ 应用启动失败:', error);
        errorHandler.handleError(error, { type: 'init', phase: 'startup' });
        
        // 显示降级UI
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #f5f5f5;">
                <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #e74c3c; margin-bottom: 20px;">⚠️ 应用启动失败</h2>
                    <p style="color: #666; margin-bottom: 20px;">${error.message}</p>
                    <button onclick="window.location.reload()" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">
                        刷新页面
                    </button>
                </div>
            </div>
        `;
    }
}

/**
 * 加载设置
 */
function loadSettings() {
    // 加载API设置
    AppState.apiPassword = localStorage.getItem('apiPassword') || '';
    AppState.apiBaseUrl = localStorage.getItem('apiBaseUrl') || 'https://api.1181180.xyz/api';
    
    document.getElementById('apiPassword').value = AppState.apiPassword;
    document.getElementById('apiBaseUrl').value = AppState.apiBaseUrl;
    
    // 加载折叠状态
    const importCollapsed = localStorage.getItem('importSectionCollapsed') === 'true';
    const purchaseCollapsed = localStorage.getItem('purchaseSectionCollapsed') === 'true';
    const mailboxCollapsed = localStorage.getItem('mailboxSectionCollapsed') === 'true';
    
    if (importCollapsed) toggleImportSection(false);
    if (!purchaseCollapsed) togglePurchaseSection(false);
    if (mailboxCollapsed) toggleMailboxSection(false);
}

/**
 * 初始化UI组件
 */
function initUIComponents() {
    // 文件上传
    document.getElementById('fileInput').addEventListener('change', handleFileInput);
    
    // 拖拽上传
    setupDragAndDrop();
    
    // 分隔符输入 - 使用防抖
    const separatorInput = document.getElementById('separatorInput');
    const debouncedUpdatePlaceholder = debounce(updatePlaceholder, 300);
    separatorInput.addEventListener('input', debouncedUpdatePlaceholder);
    
    // 初始化占位符
    updatePlaceholder();
    
    // 邮件列表文件夹切换 - 使用防抖
    const folderSelect = document.getElementById('mailboxFolderList');
    const debouncedLoadEmails = debounce(() => {
        if (AppState.selectedMailboxIndex !== -1) {
            loadEmailListInternal();
        }
    }, 300);
    folderSelect.addEventListener('change', debouncedLoadEmails);
}

// 暴露loadEmailList到全局作用域（供HTML onclick使用）
window.loadEmailList = function() {
    loadEmailListInternal();
};

/**
 * 设置拖拽上传
 */
function setupDragAndDrop() {
    const dropzone = document.getElementById('mailboxInput');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('dragover');
        });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('dragover');
        });
    });
    
    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length) {
            const file = files[0];
            if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                readTextFile(file, (content) => {
                    dropzone.value = content;
                    setStatusMessage('文件已加载，请点击"添加邮箱"进行解析', 'success');
                });
            } else {
                setStatusMessage('请上传TXT文件', 'error');
            }
        }
    });
}

/**
 * 读取文本文件
 */
function readTextFile(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => callback(e.target.result);
    reader.onerror = () => setStatusMessage('文件读取失败', 'error');
    reader.readAsText(file);
}

/**
 * 处理文件输入
 */
function handleFileInput(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    readTextFile(file, (content) => {
        document.getElementById('mailboxInput').value = content;
        setStatusMessage('文件已加载，请点击"添加邮箱"进行解析', 'success');
    });
}

/**
 * 更新占位符
 */
function updatePlaceholder() {
    const separator = document.getElementById('separatorInput').value || '----';
    const placeholder = `格式: email${separator}password${separator}client_id${separator}refresh_token`;
    document.getElementById('mailboxInput').placeholder = placeholder;
}

/**
 * 从服务器加载邮箱
 */
async function loadMailboxesFromStorage() {
    try {
        const response = await fetch(`${SUPABASE_API_BASE}/mailboxes`);
        const result = await response.json();
        
        if (result.success) {
            AppState.mailboxes = result.data || [];
            mailboxListManager.updateMailboxes(AppState.mailboxes);
            
            if (AppState.mailboxes.length > 0) {
                setStatusMessage(`已加载 ${AppState.mailboxes.length} 个邮箱`, 'success');
            }
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('从服务器加载失败:', error);
        setStatusMessage('从服务器加载失败，请稍后重试', 'error');
    }
}

/**
 * 解析并添加邮箱
 */
window.parseMailboxInput = async function() {
    const input = document.getElementById('mailboxInput').value.trim();
    if (!input) {
        setStatusMessage('请输入邮箱配置信息', 'error');
        return;
    }
    
    setStatusMessage('正在解析和保存邮箱...', 'loading');
    
    const separator = document.getElementById('separatorInput').value || '----';
    const lines = input.split('\n').filter(line => line.trim() !== '');
    const newMailboxes = [];
    let errorCount = 0;
    
    for (const line of lines) {
        const parts = line.trim().split(separator);
        if (parts.length < 4) {
            errorCount++;
            continue;
        }
        
        newMailboxes.push({
            email: parts[0].trim(),
            password: parts[1].trim(),
            client_id: parts[2].trim(),
            refresh_token: parts[3].trim()
        });
    }
    
    if (newMailboxes.length === 0) {
        setStatusMessage('未找到有效的邮箱配置', 'error');
        return;
    }
    
    // 保存到服务器
    try {
        const response = await fetch(`${SUPABASE_API_BASE}/mailboxes/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mailboxes: newMailboxes })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 更新本地状态
            AppState.mailboxes = [...AppState.mailboxes, ...result.data];
            mailboxListManager.updateMailboxes(AppState.mailboxes);
            
            const message = `成功添加 ${result.added} 个邮箱` +
                          (result.skipped > 0 ? `，跳过 ${result.skipped} 个重复邮箱` : '') +
                          (errorCount > 0 ? `，${errorCount} 个格式错误` : '');
            
            setStatusMessage(message, 'success');
            document.getElementById('mailboxInput').value = '';
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        setStatusMessage(`保存失败: ${error.message}`, 'error');
    }
};

/**
 * 导出所有邮箱数据
 */
window.exportMailboxes = function() {
    if (AppState.mailboxes.length === 0) {
        setStatusMessage('没有可导出的邮箱数据', 'error');
        return;
    }
    
    const separator = document.getElementById('separatorInput').value || '----';
    
    // 生成导出内容
    const exportContent = AppState.mailboxes.map(mailbox => {
        return `${mailbox.email}${separator}${mailbox.password}${separator}${mailbox.client_id}${separator}${mailbox.refresh_token}`;
    }).join('\n');
    
    // 创建Blob对象
    const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // 生成文件名（包含时间戳）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `mailboxes_export_${timestamp}.txt`;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setStatusMessage(`成功导出 ${AppState.mailboxes.length} 个邮箱`, 'success');
};

/**
 * 导出选中的邮箱
 */
window.exportSelectedMailbox = function() {
    if (AppState.selectedMailboxIndex === -1) {
        setStatusMessage('请先选择一个邮箱', 'error');
        return;
    }
    
    const mailbox = AppState.mailboxes[AppState.selectedMailboxIndex];
    const separator = document.getElementById('separatorInput').value || '----';
    
    // 生成导出内容
    const exportContent = `${mailbox.email}${separator}${mailbox.password}${separator}${mailbox.client_id}${separator}${mailbox.refresh_token}`;
    
    // 复制到剪贴板
    navigator.clipboard.writeText(exportContent).then(() => {
        setStatusMessage(`已复制邮箱 ${mailbox.email} 的完整信息到剪贴板`, 'success');
    }).catch(() => {
        // 降级方案：创建临时文本框
        const textarea = document.createElement('textarea');
        textarea.value = exportContent;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            setStatusMessage(`已复制邮箱 ${mailbox.email} 的完整信息到剪贴板`, 'success');
        } catch (err) {
            setStatusMessage('复制失败，请手动复制', 'error');
        }
        
        document.body.removeChild(textarea);
    });
};

/**
 * 删除邮箱
 */
async function deleteMailbox(index) {
    const mailbox = AppState.mailboxes[index];
    if (!mailbox) return;
    
    try {
        if (mailbox.id) {
            await fetch(`${SUPABASE_API_BASE}/mailboxes/${mailbox.id}`, {
                method: 'DELETE'
            });
        }
        
        AppState.mailboxes.splice(index, 1);
        mailboxListManager.removeMailbox(index);
        
        if (index === AppState.selectedMailboxIndex) {
            AppState.selectedMailboxIndex = -1;
            clearEmailDisplay();
        } else if (index < AppState.selectedMailboxIndex) {
            AppState.selectedMailboxIndex--;
        }
        
        setStatusMessage('邮箱已删除', 'success');
    } catch (error) {
        setStatusMessage(`删除失败: ${error.message}`, 'error');
    }
}

/**
 * 加载邮件列表 - 使用防抖优化
 */
const loadEmailListInternal = debounce(async function() {
    if (AppState.selectedMailboxIndex === -1) {
        setStatusMessage('请先选择一个邮箱', 'error');
        return;
    }
    
    const mailbox = AppState.mailboxes[AppState.selectedMailboxIndex];
    const folder = document.getElementById('mailboxFolderList').value;
    
    setStatusMessage(`正在加载${folder === 'INBOX' ? '收件箱' : '垃圾箱'}邮件...`, 'loading');
    
    try {
        const apiBaseUrl = AppState.apiBaseUrl || document.getElementById('apiBaseUrl').value.trim();
        if (!apiBaseUrl) {
            throw new Error('请先填写API地址');
        }
        
        let url = `${apiBaseUrl}/mail-all?refresh_token=${encodeURIComponent(mailbox.refresh_token)}&client_id=${encodeURIComponent(mailbox.client_id)}&email=${encodeURIComponent(mailbox.email)}&mailbox=${folder}`;
        
        if (AppState.apiPassword) {
            url += `&password=${encodeURIComponent(AppState.apiPassword)}`;
        }
        
        const response = await fetch(url);
        
        // 检查HTTP状态
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 检查API返回的数据格式
        let emails = [];
        if (Array.isArray(data)) {
            emails = data;
        } else if (data && data.data && Array.isArray(data.data)) {
            emails = data.data;
        } else if (data && !data.error && !data.message) {
            // 只有在不是错误响应时才当作邮件数据
            emails = [data];
        } else {
            // API返回了错误
            throw new Error(data.message || data.error || '获取邮件失败');
        }
        
        // 按日期排序（最新的在前）
        emails.sort((a, b) => {
            const dateA = new Date(a.date || a.timestamp || 0);
            const dateB = new Date(b.date || b.timestamp || 0);
            return dateB - dateA;
        });
        
        AppState.emailListData = emails;
        emailListManager.updateEmails(emails);
        
        console.log('✅ 邮件列表已更新:', emails.length);
        setStatusMessage(`已加载 ${emails.length} 封邮件`, 'success');
    } catch (error) {
        console.error('加载邮件列表失败:', error);
        setStatusMessage('加载邮件列表失败: ' + error.message, 'error');
        emailListManager.clear();
    }
}, 500);

/**
 * 显示选中的邮件
 */
function displaySelectedEmail(email) {
    if (!email) return;
    
    // 显示邮件头部
    document.getElementById('emailFrom').textContent = `发件人: ${email.from || email.send || 'Unknown'}`;
    document.getElementById('emailSubject').textContent = email.subject || '无主题';
    document.getElementById('emailDate').textContent = formatDate(email.date || email.timestamp);
    document.getElementById('emailHeader').style.display = 'block';
    
    // 显示原始数据
    document.getElementById('rawData').textContent = JSON.stringify(email, null, 2);
    
    // 显示加载状态
    document.getElementById('loadingMessage').style.display = 'block';
    document.getElementById('emailFrame').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    
    // 显示邮件内容
    if (email.html) {
        displayEmailContent(email.html);
    } else if (email.body) {
        displayEmailText(email.body);
    } else if (email.text) {
        displayEmailText(email.text);
    } else {
        setStatusMessage('邮件内容为空', 'error');
        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
    }
    
    // 切换到邮件内容标签页
    switchTab('emailTab');
}

/**
 * 显示HTML邮件内容
 */
function displayEmailContent(html) {
    const iframe = document.getElementById('emailFrame');
    iframe.style.display = 'block';
    
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(html);
    iframe.contentWindow.document.close();
    
    document.getElementById('loadingMessage').style.display = 'none';
    setStatusMessage('邮件加载成功', 'success');
}

/**
 * 显示纯文本邮件
 */
function displayEmailText(text) {
    const iframe = document.getElementById('emailFrame');
    iframe.style.display = 'block';
    
    const htmlContent = `
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; margin: 0; }
                pre { white-space: pre-wrap; margin: 0; }
            </style>
        </head>
        <body><pre>${escapeHtml(text)}</pre></body>
        </html>
    `;
    
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(htmlContent);
    iframe.contentWindow.document.close();
    
    document.getElementById('loadingMessage').style.display = 'none';
    setStatusMessage('邮件加载成功', 'success');
}

/**
 * 清除邮件显示
 */
window.clearEmailDisplay = function() {
    document.getElementById('emailHeader').style.display = 'none';
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('emailFrame').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('rawData').textContent = '';
    AppState.selectedEmailIndex = -1;
    setStatusMessage('显示已清除', 'success');
};

/**
 * 切换标签页
 */
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.email-container').forEach(content => content.style.display = 'none');
    
    document.querySelector(`.tab[onclick*="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).style.display = 'block';
};

/**
 * 设置状态消息
 */
window.setStatusMessage = function(message, type = 'info') {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = 'status-message ' + type;
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            if (statusElement.textContent === message) {
                statusElement.textContent = '';
                statusElement.className = 'status-message';
            }
        }, 5000);
    }
};

// 折叠/展开功能
window.toggleImportSection = function(saveState = true) {
    const content = document.getElementById('importContent');
    const btn = document.getElementById('toggleImportBtn');
    const status = document.getElementById('sectionStatus');
    
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        btn.textContent = '▼';
        status.textContent = '展开';
        if (saveState) localStorage.setItem('importSectionCollapsed', 'false');
    } else {
        content.classList.add('collapsed');
        btn.textContent = '▶';
        status.textContent = '收起';
        if (saveState) localStorage.setItem('importSectionCollapsed', 'true');
    }
};

window.togglePurchaseSection = function(saveState = true) {
    const content = document.getElementById('purchaseContent');
    const btn = document.getElementById('togglePurchaseBtn');
    const status = document.getElementById('purchaseSectionStatus');
    
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        btn.textContent = '▼';
        status.textContent = '展开';
        if (saveState) localStorage.setItem('purchaseSectionCollapsed', 'false');
    } else {
        content.classList.add('collapsed');
        btn.textContent = '▶';
        status.textContent = '收起';
        if (saveState) localStorage.setItem('purchaseSectionCollapsed', 'true');
    }
};

window.toggleMailboxSection = function(saveState = true) {
    const content = document.getElementById('mailboxContent');
    const btn = document.getElementById('toggleMailboxBtn');
    const status = document.getElementById('mailboxSectionStatus');
    
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        btn.textContent = '▼';
        status.textContent = '展开';
        if (saveState) localStorage.setItem('mailboxSectionCollapsed', 'false');
    } else {
        content.classList.add('collapsed');
        btn.textContent = '▶';
        status.textContent = '收起';
        if (saveState) localStorage.setItem('mailboxSectionCollapsed', 'true');
    }
};

window.saveApiSettings = function() {
    AppState.apiBaseUrl = document.getElementById('apiBaseUrl').value.trim();
    AppState.apiPassword = document.getElementById('apiPassword').value;
    
    localStorage.setItem('apiBaseUrl', AppState.apiBaseUrl);
    localStorage.setItem('apiPassword', AppState.apiPassword);
    
    setStatusMessage('API设置已保存', 'success');
};

// 采购相关功能
function initPurchaseLibrary() {
    const saved = localStorage.getItem('purchaseLibrary') || '1';
    document.getElementById('purchaseLibrary').value = saved;
    populateCommodities(saved);
}

function populateCommodities(lib) {
    const select = document.getElementById('commodityId');
    select.innerHTML = '';
    (LIBRARIES[lib]?.items || []).forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = `${item.name}（ID:${item.id}）`;
        select.appendChild(opt);
    });
}

window.onPurchaseLibraryChange = function() {
    const lib = document.getElementById('purchaseLibrary').value;
    localStorage.setItem('purchaseLibrary', lib);
    populateCommodities(lib);
};

// ==================== 采购相关功能 ====================

// 查询库存
window.checkStock = async function() {
    const commodityId = document.getElementById('commodityId').value;
    const stockDisplay = document.getElementById('stockDisplay');
    
    stockDisplay.innerHTML = '正在查询库存...';
    stockDisplay.style.color = '#3498db';
    setStatusMessage('正在查询库存...', 'loading');
    
    try {
        const lib = document.getElementById('purchaseLibrary').value || '1';
        const response = await fetch(`${API_CONFIG.BASE_URL}/proxy/stock?commodity_id=${commodityId}&library=${lib}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        const data = await response.json();
        document.getElementById('rawData').textContent = JSON.stringify(data, null, 2);
        
        if (data && data.code === 200 && data.data) {
            const stockNum = data.data.stock || 0;
            const productName = data.data.name || '未知';
            
            stockDisplay.innerHTML = `
                产品: ${productName}<br>
                库存: ${stockNum} 个
            `;
            stockDisplay.style.color = stockNum > 0 ? '#27ae60' : '#e74c3c';
            setStatusMessage('库存查询成功', 'success');
        } else if (data && data.num !== undefined) {
            const stockNum = data.num || 0;
            const productName = data.name || '未知';
            
            stockDisplay.innerHTML = `
                产品: ${productName}<br>
                库存: ${stockNum} 个
            `;
            stockDisplay.style.color = stockNum > 0 ? '#27ae60' : '#e74c3c';
            setStatusMessage('库存查询成功', 'success');
        } else {
            stockDisplay.innerHTML = '库存查询失败：数据格式错误';
            stockDisplay.style.color = '#e74c3c';
            setStatusMessage('库存查询失败：数据格式错误', 'error');
        }
    } catch (error) {
        console.error('查询库存失败:', error);
        stockDisplay.innerHTML = `查询失败: ${error.message}`;
        stockDisplay.style.color = '#e74c3c';
        setStatusMessage('查询库存失败: ' + error.message, 'error');
    }
};

// 更新库存显示
window.updateStockDisplay = function() {
    const stockDisplay = document.getElementById('stockDisplay');
    stockDisplay.innerHTML = '点击"查询库存"获取当前库存信息';
    stockDisplay.style.color = '#3498db';
};

// 查询余额
window.checkBalance = async function() {
    const finalAppId = '1097';
    const finalAppKey = 'A2380737CA36CC61';
    const balanceDisplay = document.getElementById('balanceDisplay');
    
    balanceDisplay.innerHTML = '正在查询余额...';
    setStatusMessage('正在查询余额...', 'loading');
    
    try {
        const lib = document.getElementById('purchaseLibrary').value || '1';
        const response = await fetch(`${SUPABASE_API_BASE}/proxy/balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_id: finalAppId, app_key: finalAppKey, library: lib })
        });
        
        const data = await response.json();
        document.getElementById('rawData').textContent = JSON.stringify(data, null, 2);
        
        if (data.code === 200 && data.data) {
            balanceDisplay.innerHTML = `
                用户: ${data.data.username || '未知用户'} (ID: ${data.data.id || '未知'})<br>
                余额: ¥${data.data.balance || '0.00'}
            `;
            balanceDisplay.style.color = '#27ae60';
            setStatusMessage('余额查询成功', 'success');
        } else {
            throw new Error(data.message || '查询失败');
        }
    } catch (error) {
        balanceDisplay.innerHTML = `查询失败: ${error.message}`;
        balanceDisplay.style.color = '#e74c3c';
        setStatusMessage('查询余额失败: ' + error.message, 'error');
    }
};

// 购买邮箱
window.purchaseEmails = async function() {
    const appId = '';
    const appKey = '';
    const commodityId = document.getElementById('commodityId').value;
    const num = parseInt(document.getElementById('purchaseNum').value);
    
    const finalAppId = appId || '1097';
    const finalAppKey = appKey || 'A2380737CA36CC61';
    
    if (!num || num < 1 || num > 2000) {
        setStatusMessage('购买数量必须在1-2000之间', 'error');
        return;
    }
    
    setStatusMessage('正在购买邮箱...', 'loading');
    
    try {
        const lib = document.getElementById('purchaseLibrary').value || '1';
        const response = await fetch(`${API_CONFIG.BASE_URL}/proxy/purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app_id: finalAppId,
                app_key: finalAppKey,
                commodity_id: commodityId,
                num: num,
                library: lib
            })
        });
        
        const data = await response.json();
        document.getElementById('rawData').textContent = JSON.stringify(data, null, 2);
        
        if (data.code === 200 && data.data && data.data.cards) {
            const cards = data.data.cards;
            const newMailboxes = [];
            let successCount = 0;
            let errorCount = 0;
            
            for (const card of cards) {
                try {
                    const parts = card.split('----');
                    if (parts.length >= 4) {
                        const mailboxObj = {
                            email: parts[0],
                            password: parts[1],
                            client_id: parts[2],
                            refresh_token: parts[3]
                        };
                        
                        const exists = AppState.mailboxes.some(m => m.email.toLowerCase() === parts[0].toLowerCase());
                        if (!exists) {
                            AppState.mailboxes.push(mailboxObj);
                            newMailboxes.push(mailboxObj);
                            successCount++;
                        }
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    errorCount++;
                }
            }
            
            mailboxListManager.updateMailboxes(AppState.mailboxes);
            
            // 保存到服务器
            if (newMailboxes.length > 0) {
                try {
                    await fetch(`${API_CONFIG.BASE_URL}/mailboxes/batch`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mailboxes: newMailboxes })
                    });
                } catch (e) {
                    console.error('保存到服务器失败:', e);
                }
            }
            
            const totalPrice = data.data.total_price || '未知';
            const message = `成功购买 ${successCount} 个邮箱` +
                           (errorCount > 0 ? `，${errorCount} 个解析失败` : '') +
                           `。订单号: ${data.data.trade_no || '未知'}，总价: ¥${totalPrice}`;
            
            setStatusMessage(message, 'success');
        } else {
            const errorMsg = data.msg || '购买失败';
            setStatusMessage(`购买失败: ${errorMsg}`, 'error');
        }
    } catch (error) {
        setStatusMessage('购买邮箱失败: ' + error.message, 'error');
    }
};

// 清空收件箱和垃圾箱 - 使用防抖避免误操作
window.clearInbox = debounce(async function() {
    if (AppState.selectedMailboxIndex === -1) {
        setStatusMessage('请先选择一个邮箱', 'error');
        return;
    }
    
    if (!confirm('确定要清空所选邮箱的收件箱吗？此操作不可恢复！')) {
        return;
    }
    
    const mailbox = AppState.mailboxes[AppState.selectedMailboxIndex];
    setStatusMessage('正在清空收件箱...', 'loading');
    
    try {
        const apiBaseUrl = AppState.apiBaseUrl || document.getElementById('apiBaseUrl').value.trim();
        if (!apiBaseUrl) throw new Error('请先填写API地址');
        
        let url = `${apiBaseUrl}/process-inbox?refresh_token=${encodeURIComponent(mailbox.refresh_token)}&client_id=${encodeURIComponent(mailbox.client_id)}&email=${encodeURIComponent(mailbox.email)}`;
        
        if (AppState.apiPassword) {
            url += `&password=${encodeURIComponent(AppState.apiPassword)}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        document.getElementById('rawData').textContent = JSON.stringify(data, null, 2);
        
        // 检查是否成功
        if (data.error || data.message) {
            throw new Error(data.message || data.error || '清空失败');
        }
        
        clearEmailDisplay();
        emailListManager.clear();
        
        setStatusMessage('收件箱清空成功', 'success');
    } catch (error) {
        setStatusMessage('清空收件箱失败: ' + error.message, 'error');
    }
}, 1000);

window.clearJunk = debounce(async function() {
    if (AppState.selectedMailboxIndex === -1) {
        setStatusMessage('请先选择一个邮箱', 'error');
        return;
    }
    
    if (!confirm('确定要清空所选邮箱的垃圾箱吗？此操作不可恢复！')) {
        return;
    }
    
    const mailbox = AppState.mailboxes[AppState.selectedMailboxIndex];
    setStatusMessage('正在清空垃圾箱...', 'loading');
    
    try {
        const apiBaseUrl = AppState.apiBaseUrl || document.getElementById('apiBaseUrl').value.trim();
        if (!apiBaseUrl) throw new Error('请先填写API地址');
        
        let url = `${apiBaseUrl}/process-junk?refresh_token=${encodeURIComponent(mailbox.refresh_token)}&client_id=${encodeURIComponent(mailbox.client_id)}&email=${encodeURIComponent(mailbox.email)}`;
        
        if (AppState.apiPassword) {
            url += `&password=${encodeURIComponent(AppState.apiPassword)}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        document.getElementById('rawData').textContent = JSON.stringify(data, null, 2);
        
        // 检查是否成功
        if (data.error || data.message) {
            throw new Error(data.message || data.error || '清空失败');
        }
        
        clearEmailDisplay();
        emailListManager.clear();
        
        setStatusMessage('垃圾箱清空成功', 'success');
    } catch (error) {
        setStatusMessage('清空垃圾箱失败: ' + error.message, 'error');
    }
}, 1000);

// 获取最新邮件
window.fetchEmail = async function() {
    if (AppState.selectedMailboxIndex === -1) {
        setStatusMessage('请先选择一个邮箱', 'error');
        return;
    }
    
    const mailbox = AppState.mailboxes[AppState.selectedMailboxIndex];
    const folder = document.getElementById('mailboxFolderList').value;
    const responseType = document.getElementById('responseType').value;
    
    setStatusMessage('正在获取最新邮件...', 'loading');
    document.getElementById('loadingMessage').style.display = 'block';
    document.getElementById('emailFrame').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    
    try {
        const apiBaseUrl = AppState.apiBaseUrl || document.getElementById('apiBaseUrl').value.trim();
        if (!apiBaseUrl) throw new Error('请先填写API地址');
        
        let url = `${apiBaseUrl}/mail-new?refresh_token=${encodeURIComponent(mailbox.refresh_token)}&client_id=${encodeURIComponent(mailbox.client_id)}&email=${encodeURIComponent(mailbox.email)}&mailbox=${folder}&response_type=${responseType}`;
        
        if (AppState.apiPassword) {
            url += `&password=${encodeURIComponent(AppState.apiPassword)}`;
        }
        
        const response = await fetch(url);
        
        // 检查HTTP状态
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        document.getElementById('rawData').textContent = JSON.stringify(data, null, 2);
        
        // 检查API返回的数据
        let emails = [];
        if (Array.isArray(data)) {
            emails = data;
        } else if (data && data.data && Array.isArray(data.data)) {
            emails = data.data;
        } else if (data && !data.error && !data.message) {
            emails = [data];
        } else {
            throw new Error(data.message || data.error || '获取邮件失败');
        }
        
        if (!emails || emails.length === 0) {
            setStatusMessage('没有找到邮件', 'error');
            document.getElementById('emptyState').style.display = 'block';
            return;
        }
        
        const email = emails[0];
        displaySelectedEmail(email);
        
        // 刷新邮件列表
        loadEmailListInternal();
    } catch (error) {
        setStatusMessage('获取邮件失败: ' + error.message, 'error');
        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
    }
};

// ==================== 移动端适配功能 ====================

/**
 * 切换移动端视图
 */
window.switchMobileView = function(target) {
    // 更新导航按钮状态
    const navButtons = document.querySelectorAll('.mobile-nav-btn');
    navButtons.forEach(btn => {
        if (btn.dataset.target === target) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // 切换显示区域
    const sidebar = document.querySelector('.sidebar');
    const emailSidebar = document.querySelector('.email-sidebar');
    const mainContent = document.querySelector('.main-content');
    
    // 移除所有active类
    sidebar.classList.remove('active');
    emailSidebar.classList.remove('active');
    mainContent.classList.remove('active');
    
    // 添加active到目标区域
    switch(target) {
        case 'sidebar':
            sidebar.classList.add('active');
            break;
        case 'email-sidebar':
            emailSidebar.classList.add('active');
            break;
        case 'main-content':
            mainContent.classList.add('active');
            break;
    }
};

/**
 * 检测是否为移动设备
 */
function isMobileDevice() {
    return window.innerWidth <= 768;
}

/**
 * 初始化移动端视图
 */
function initMobileView() {
    if (isMobileDevice()) {
        // 默认显示设置页面
        switchMobileView('sidebar');
    } else {
        // 桌面端显示所有区域
        const sidebar = document.querySelector('.sidebar');
        const emailSidebar = document.querySelector('.email-sidebar');
        const mainContent = document.querySelector('.main-content');
        
        sidebar.classList.add('active');
        emailSidebar.classList.add('active');
        mainContent.classList.add('active');
    }
}

/**
 * 监听窗口大小变化
 */
window.addEventListener('resize', debounce(() => {
    initMobileView();
}, 300));

/**
 * 移动端优化：双击邮箱后自动切换到邮件列表
 */
const originalMailboxSelect = mailboxListManager ? mailboxListManager.onSelect : null;
if (isMobileDevice() && mailboxListManager) {
    mailboxListManager.onSelect = function(callback) {
        const wrappedCallback = async function(...args) {
            await callback(...args);
            // 切换到邮件列表视图
            if (isMobileDevice()) {
                switchMobileView('email-sidebar');
            }
        };
        if (originalMailboxSelect) {
            originalMailboxSelect.call(mailboxListManager, wrappedCallback);
        }
    };
}

// 页面加载时初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initApp();
        initMobileView();
    });
} else {
    initApp();
    initMobileView();
}

