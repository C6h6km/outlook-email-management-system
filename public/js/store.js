/**
 * 状态管理 - 简单的Store模式
 * 集中管理应用状态，实现状态的可预测性和可追踪性
 */

import { ENV } from './config.js';

/**
 * Store 类 - 状态管理容器
 */
class Store {
    constructor(initialState = {}) {
        this.state = { ...initialState };
        this.listeners = new Map();
        this.mutations = new Map();
        this.actions = new Map();
    }
    
    /**
     * 获取状态
     */
    getState(path) {
        if (!path) return this.state;
        
        const keys = path.split('.');
        let value = this.state;
        
        for (const key of keys) {
            if (value === undefined) break;
            value = value[key];
        }
        
        return value;
    }
    
    /**
     * 注册 mutation（同步修改状态）
     */
    registerMutation(name, handler) {
        this.mutations.set(name, handler);
    }
    
    /**
     * 提交 mutation
     */
    commit(name, payload) {
        const mutation = this.mutations.get(name);
        
        if (!mutation) {
            console.error(`Mutation "${name}" not found`);
            return;
        }
        
        if (ENV.debug) {
            console.log(`[Mutation] ${name}`, payload);
        }
        
        // 执行 mutation
        mutation(this.state, payload);
        
        // 通知监听器
        this.notify(name, payload);
    }
    
    /**
     * 注册 action（异步操作）
     */
    registerAction(name, handler) {
        this.actions.set(name, handler);
    }
    
    /**
     * 分发 action
     */
    async dispatch(name, payload) {
        const action = this.actions.get(name);
        
        if (!action) {
            console.error(`Action "${name}" not found`);
            return;
        }
        
        if (ENV.debug) {
            console.log(`[Action] ${name}`, payload);
        }
        
        try {
            return await action(
                {
                    state: this.state,
                    commit: this.commit.bind(this),
                    dispatch: this.dispatch.bind(this),
                },
                payload
            );
        } catch (error) {
            console.error(`Error in action "${name}":`, error);
            throw error;
        }
    }
    
    /**
     * 订阅状态变化
     */
    subscribe(listener) {
        const id = Date.now() + Math.random();
        this.listeners.set(id, listener);
        
        // 返回取消订阅的函数
        return () => {
            this.listeners.delete(id);
        };
    }
    
    /**
     * 通知所有监听器
     */
    notify(mutationName, payload) {
        this.listeners.forEach(listener => {
            try {
                listener(mutationName, payload, this.state);
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        });
    }
}

// 创建全局状态
const store = new Store({
    // 邮箱相关状态
    mailboxes: [],
    selectedMailboxIndex: -1,
    
    // 邮件相关状态
    emails: [],
    selectedEmailIndex: -1,
    currentFolder: 'INBOX',
    
    // UI状态
    loading: false,
    statusMessage: '',
    statusType: 'info',
    
    // 设置
    apiBaseUrl: '',
    apiPassword: '',
    
    // 采购状态
    purchaseLibrary: '1',
    balance: null,
    stock: null,
});

// ==================== Mutations ====================

// 邮箱相关
store.registerMutation('SET_MAILBOXES', (state, mailboxes) => {
    state.mailboxes = mailboxes;
});

store.registerMutation('ADD_MAILBOXES', (state, mailboxes) => {
    state.mailboxes = [...state.mailboxes, ...mailboxes];
});

store.registerMutation('REMOVE_MAILBOX', (state, index) => {
    state.mailboxes.splice(index, 1);
    
    // 调整选中索引
    if (index === state.selectedMailboxIndex) {
        state.selectedMailboxIndex = -1;
    } else if (index < state.selectedMailboxIndex) {
        state.selectedMailboxIndex--;
    }
});

store.registerMutation('SELECT_MAILBOX', (state, index) => {
    state.selectedMailboxIndex = index;
});

// 邮件相关
store.registerMutation('SET_EMAILS', (state, emails) => {
    state.emails = emails;
    state.selectedEmailIndex = -1;
});

store.registerMutation('SELECT_EMAIL', (state, index) => {
    state.selectedEmailIndex = index;
});

store.registerMutation('SET_FOLDER', (state, folder) => {
    state.currentFolder = folder;
});

// UI状态
store.registerMutation('SET_LOADING', (state, loading) => {
    state.loading = loading;
});

store.registerMutation('SET_STATUS', (state, { message, type = 'info' }) => {
    state.statusMessage = message;
    state.statusType = type;
});

store.registerMutation('CLEAR_STATUS', (state) => {
    state.statusMessage = '';
    state.statusType = 'info';
});

// 设置
store.registerMutation('SET_API_CONFIG', (state, { apiBaseUrl, apiPassword }) => {
    if (apiBaseUrl !== undefined) state.apiBaseUrl = apiBaseUrl;
    if (apiPassword !== undefined) state.apiPassword = apiPassword;
});

// 采购
store.registerMutation('SET_PURCHASE_LIBRARY', (state, library) => {
    state.purchaseLibrary = library;
});

store.registerMutation('SET_BALANCE', (state, balance) => {
    state.balance = balance;
});

store.registerMutation('SET_STOCK', (state, stock) => {
    state.stock = stock;
});

// ==================== Actions ====================

// 加载邮箱列表
store.registerAction('loadMailboxes', async ({ commit }, apiClient) => {
    commit('SET_LOADING', true);
    
    try {
        const mailboxes = await apiClient.getMailboxes();
        commit('SET_MAILBOXES', mailboxes);
        return mailboxes;
    } catch (error) {
        commit('SET_STATUS', { 
            message: `加载邮箱失败: ${error.message}`, 
            type: 'error' 
        });
        throw error;
    } finally {
        commit('SET_LOADING', false);
    }
});

// 添加邮箱
store.registerAction('addMailboxes', async ({ commit }, { apiClient, mailboxes }) => {
    commit('SET_LOADING', true);
    
    try {
        const result = await apiClient.addMailboxesBatch(mailboxes);
        commit('ADD_MAILBOXES', result.data);
        
        const message = `成功添加 ${result.added} 个邮箱` +
                       (result.skipped > 0 ? `，跳过 ${result.skipped} 个重复邮箱` : '');
        
        commit('SET_STATUS', { message, type: 'success' });
        return result;
    } catch (error) {
        commit('SET_STATUS', { 
            message: `添加邮箱失败: ${error.message}`, 
            type: 'error' 
        });
        throw error;
    } finally {
        commit('SET_LOADING', false);
    }
});

// 删除邮箱
store.registerAction('deleteMailbox', async ({ commit, state }, { apiClient, index }) => {
    const mailbox = state.mailboxes[index];
    if (!mailbox) return;
    
    try {
        if (mailbox.id) {
            await apiClient.deleteMailbox(mailbox.id);
        }
        
        commit('REMOVE_MAILBOX', index);
        commit('SET_STATUS', { message: '邮箱已删除', type: 'success' });
    } catch (error) {
        commit('SET_STATUS', { 
            message: `删除邮箱失败: ${error.message}`, 
            type: 'error' 
        });
        throw error;
    }
});

// 加载邮件列表
store.registerAction('loadEmails', async ({ commit, state }, apiClient) => {
    if (state.selectedMailboxIndex === -1) {
        commit('SET_STATUS', { message: '请先选择一个邮箱', type: 'error' });
        return;
    }
    
    commit('SET_LOADING', true);
    
    try {
        const mailbox = state.mailboxes[state.selectedMailboxIndex];
        const emails = await apiClient.getEmails(
            mailbox,
            state.currentFolder
        );
        
        commit('SET_EMAILS', emails);
        commit('SET_STATUS', { 
            message: `已加载 ${emails.length} 封邮件`, 
            type: 'success' 
        });
        
        return emails;
    } catch (error) {
        commit('SET_STATUS', { 
            message: `加载邮件失败: ${error.message}`, 
            type: 'error' 
        });
        throw error;
    } finally {
        commit('SET_LOADING', false);
    }
});

// 导出store实例
export default store;

// 导出Store类供其他地方使用
export { Store };



