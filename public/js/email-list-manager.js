/**
 * 邮件列表管理器 - 优化DOM操作
 */

import { escapeHtml, formatDate } from './utils.js';

export class EmailListManager {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
        this.emailData = [];
        this.selectedIndex = -1;
        this.onSelectCallback = null;
    }

    /**
     * 渲染单个邮件项
     */
    renderEmailItem(email, index) {
        const item = document.createElement('li');
        item.className = 'email-item' + (index === this.selectedIndex ? ' selected' : '');
        item.dataset.index = index;

        // 点击事件
        item.onclick = () => this.selectEmail(index);

        // 主题
        const subject = document.createElement('div');
        subject.className = 'email-item-subject';
        subject.textContent = email.subject || '无主题';
        subject.title = email.subject || '无主题';

        // 发件人
        const from = document.createElement('div');
        from.className = 'email-item-from';
        from.textContent = `发件人: ${email.from || email.send || 'Unknown'}`;
        from.title = email.from || email.send || 'Unknown';

        // 日期
        const date = document.createElement('div');
        date.className = 'email-item-date';
        date.textContent = formatDate(email.date || email.timestamp);

        item.appendChild(subject);
        item.appendChild(from);
        item.appendChild(date);

        return item;
    }

    /**
     * 使用HTML模板渲染（性能更好的备选方案）
     */
    renderEmailItemFast(email, index) {
        const item = document.createElement('li');
        item.className = 'email-item' + (index === this.selectedIndex ? ' selected' : '');
        item.dataset.index = index;
        item.onclick = () => this.selectEmail(index);

        const subject = escapeHtml(email.subject || '无主题');
        const from = escapeHtml(email.from || email.send || 'Unknown');
        const dateStr = formatDate(email.date || email.timestamp);

        item.innerHTML = `
            <div class="email-item-subject" title="${subject}">${subject}</div>
            <div class="email-item-from" title="${from}">发件人: ${from}</div>
            <div class="email-item-date">${dateStr}</div>
        `;

        return item;
    }

    /**
     * 选择邮件
     */
    selectEmail(index) {
        if (index === this.selectedIndex) return;

        this.selectedIndex = index;

        // 重新渲染以更新选中状态
        this.render();

        // 触发回调
        if (this.onSelectCallback && this.emailData[index]) {
            this.onSelectCallback(this.emailData[index], index);
        }
    }

    /**
     * 更新邮件数据
     */
    updateEmails(emails) {
        this.emailData = emails || [];
        this.selectedIndex = -1;
        this.render();
    }

    /**
     * 渲染邮件列表（使用文档片段优化）
     */
    render() {
        if (!this.container) return;

        // 如果没有邮件，显示空状态
        if (this.emailData.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <p>没有找到邮件</p>
                </div>
            `;
            return;
        }

        // 使用文档片段批量创建DOM
        const fragment = document.createDocumentFragment();

        this.emailData.forEach((email, index) => {
            const item = this.renderEmailItem(email, index);
            fragment.appendChild(item);
        });

        // 一次性更新DOM
        this.container.innerHTML = '';
        this.container.appendChild(fragment);
    }

    /**
     * 添加邮件
     */
    addEmails(emails) {
        if (!Array.isArray(emails)) {
            emails = [emails];
        }

        this.emailData = [...this.emailData, ...emails];
        this.render();
    }

    /**
     * 清空邮件列表
     */
    clear() {
        this.emailData = [];
        this.selectedIndex = -1;
        this.render();
    }

    /**
     * 获取选中的邮件
     */
    getSelectedEmail() {
        return this.emailData[this.selectedIndex] || null;
    }

    /**
     * 设置选择回调
     */
    onSelect(callback) {
        this.onSelectCallback = callback;
    }

    /**
     * 滚动到指定邮件
     */
    scrollToIndex(index) {
        if (index >= 0 && index < this.emailData.length) {
            const items = this.container.querySelectorAll('.email-item');
            if (items[index]) {
                items[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    /**
     * 获取所有邮件数据
     */
    getEmails() {
        return this.emailData;
    }

    /**
     * 排序邮件
     */
    sortEmails(compareFn) {
        this.emailData.sort(compareFn);
        this.render();
    }

    /**
     * 按日期排序（最新的在前）
     */
    sortByDateDesc() {
        this.sortEmails((a, b) => {
            const dateA = new Date(a.date || a.timestamp || 0);
            const dateB = new Date(b.date || b.timestamp || 0);
            return dateB - dateA;
        });
    }

    /**
     * 销毁
     */
    destroy() {
        this.emailData = [];
        this.selectedIndex = -1;
        this.onSelectCallback = null;

        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

/**
 * 邮箱列表管理器（类似邮件列表管理器）
 */
export class MailboxListManager {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
        this.mailboxes = [];
        this.selectedIndex = -1;
        this.onSelectCallback = null;
        this.onDeleteCallback = null;
        this.batchSelection = new Set();
        this.bulkMode = false;
    }

    /**
     * 更新邮箱列表
     */
    updateMailboxes(mailboxes) {
        // 复制一份，避免与外部状态共享引用导致重复 splice
        this.mailboxes = Array.isArray(mailboxes) ? [...mailboxes] : [];
        this.selectedIndex = -1;
        this.render();
    }

    /**
     * 渲染邮箱列表（使用文档片段优化）
     */
    render() {
        if (!this.container) return;

        // 如果没有邮箱，显示空状态
        if (this.mailboxes.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <p>没有邮箱，请导入或添加</p>
                </div>
            `;
            return;
        }

        // 使用文档片段批量创建DOM
        const fragment = document.createDocumentFragment();

        this.mailboxes.forEach((mailbox, index) => {
            const item = this.createMailboxItem(mailbox, index);
            fragment.appendChild(item);
        });

        // 一次性更新DOM
        this.container.innerHTML = '';
        this.container.appendChild(fragment);
    }

    /**
     * 创建单个邮箱项
     */
    createMailboxItem(mailbox, index) {
        const item = document.createElement('li');
        const key = mailbox.id || mailbox.email;
        const isBatchSelected = this.batchSelection.has(key);
        item.className = 'mailbox-item' +
            (index === this.selectedIndex ? ' selected' : '') +
            (isBatchSelected ? ' selected' : '');

        // 长按检测变量
        let longPressTimer = null;
        let isLongPress = false;
        const LONG_PRESS_DURATION = 500; // 500ms 长按阈值

        // 触摸开始 - 启动长按计时
        const handleTouchStart = (e) => {
            if (e.target.classList.contains('delete-mailbox') || e.target.classList.contains('mailbox-select')) return;

            isLongPress = false;
            longPressTimer = setTimeout(async () => {
                isLongPress = true;

                // 触觉反馈（如果设备支持）
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }

                // 复制邮箱
                try {
                    await navigator.clipboard.writeText(mailbox.email);
                    this.showCopyToast(mailbox.email);
                } catch (err) {
                    // 降级方案
                    const textarea = document.createElement('textarea');
                    textarea.value = mailbox.email;
                    textarea.style.cssText = 'position:fixed;opacity:0;';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                        document.execCommand('copy');
                        this.showCopyToast(mailbox.email);
                    } catch {
                        window.setStatusMessage?.('复制失败', 'error');
                    }
                    document.body.removeChild(textarea);
                }
            }, LONG_PRESS_DURATION);
        };

        // 触摸结束 - 清除计时器
        const handleTouchEnd = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };

        // 触摸取消/移动 - 取消长按
        const handleTouchCancel = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            isLongPress = false;
        };

        // 点击行为：批量模式下切换选中；正常模式下选择邮箱
        item.onclick = (e) => {
            if (e.target.classList.contains('delete-mailbox') || e.target.classList.contains('mailbox-select')) return;

            // 如果是长按触发的，不执行点击
            if (isLongPress) {
                isLongPress = false;
                return;
            }

            if (this.bulkMode) {
                this.toggleBatchSelection(mailbox);
                return;
            }

            // 单击选择邮箱（移动端友好）
            this.selectMailbox(index);
        };

        // 绑定触摸事件（移动端长按复制）
        item.addEventListener('touchstart', handleTouchStart, { passive: true });
        item.addEventListener('touchend', handleTouchEnd, { passive: true });
        item.addEventListener('touchcancel', handleTouchCancel, { passive: true });
        item.addEventListener('touchmove', handleTouchCancel, { passive: true });

        // 桌面端：双击复制
        item.ondblclick = async (e) => {
            if (e.target.classList.contains('delete-mailbox')) return;

            try {
                await navigator.clipboard.writeText(mailbox.email);
                this.showCopyToast(mailbox.email);
            } catch (err) {
                window.setStatusMessage?.('复制失败', 'error');
            }
        };

        // 选择复选框（仅批量模式显示）
        if (this.bulkMode) {
            const selectCheckbox = document.createElement('input');
            selectCheckbox.type = 'checkbox';
            selectCheckbox.className = 'mailbox-select';
            selectCheckbox.checked = isBatchSelected;
            selectCheckbox.title = '选择用于批量操作';
            selectCheckbox.onclick = (e) => {
                e.stopPropagation();
                this.toggleBatchSelection(mailbox);
            };
            item.appendChild(selectCheckbox);
        }

        // 邮箱地址
        const emailDiv = document.createElement('div');
        emailDiv.className = 'mailbox-email';
        emailDiv.textContent = mailbox.email;
        emailDiv.title = '点击选择 | 长按复制';

        // 删除按钮
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-mailbox';
        deleteButton.innerHTML = '&#10005;';
        deleteButton.title = '删除此邮箱';
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            this.deleteMailbox(index);
        };

        item.appendChild(emailDiv);
        item.appendChild(deleteButton);

        return item;
    }

    /**
     * 显示复制成功的Toast提示
     */
    showCopyToast(email) {
        // 移除已有的toast
        const existingToast = document.querySelector('.copy-toast');
        if (existingToast) {
            existingToast.remove();
        }

        // 创建toast
        const toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.innerHTML = `<span>✓ 已复制</span><br><small>${email}</small>`;
        document.body.appendChild(toast);

        // 2秒后移除
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 1500);
    }

    /**
     * 选择邮箱
     */
    selectMailbox(index) {
        if (index === this.selectedIndex) return;

        this.selectedIndex = index;
        this.render();

        // 触发回调
        if (this.onSelectCallback && this.mailboxes[index]) {
            this.onSelectCallback(this.mailboxes[index], index);
        }
    }

    /**
     * 删除邮箱
     */
    deleteMailbox(index) {
        const mailbox = this.mailboxes[index];
        if (!mailbox) return;

        if (confirm(`确定要删除邮箱 ${mailbox.email} 吗？`)) {
            // 触发删除回调
            if (this.onDeleteCallback) {
                this.onDeleteCallback(mailbox, index);
            }
        }
    }

    /**
     * 移除邮箱（内部方法，由外部调用后更新）
     */
    removeMailbox(index) {
        const mailbox = this.mailboxes[index];
        this.mailboxes.splice(index, 1);

        // 从批量选择中移除
        if (mailbox) {
            const key = mailbox.id || mailbox.email;
            this.batchSelection.delete(key);
        }

        // 调整选中索引
        if (index === this.selectedIndex) {
            this.selectedIndex = -1;
        } else if (index < this.selectedIndex) {
            this.selectedIndex--;
        }

        this.render();
    }

    /**
     * 添加邮箱
     */
    addMailboxes(mailboxes) {
        if (!Array.isArray(mailboxes)) {
            mailboxes = [mailboxes];
        }

        this.mailboxes = [...this.mailboxes, ...mailboxes];
        this.render();
    }

    /**
     * 获取选中的邮箱
     */
    getSelectedMailbox() {
        return this.mailboxes[this.selectedIndex] || null;
    }

    /**
     * 获取选中的索引
     */
    getSelectedIndex() {
        return this.selectedIndex;
    }

    /**
     * 获取所有邮箱
     */
    getMailboxes() {
        return this.mailboxes;
    }

    /**
     * 获取批量选择的邮箱
     */
    getBatchSelectedMailboxes() {
        return this.mailboxes.filter(m => this.batchSelection.has(m.id || m.email));
    }

    /**
     * 获取批量选择数量
     */
    getBatchSelectedCount() {
        return this.batchSelection.size;
    }

    /**
     * 设置批量模式
     */
    setBulkMode(enabled) {
        this.bulkMode = !!enabled;
        if (!this.bulkMode) {
            this.clearBatchSelection();
        } else {
            this.render();
        }
    }

    /**
     * 全选或全不选
     */
    selectAllMailboxes() {
        this.batchSelection.clear();
        for (const mailbox of this.mailboxes) {
            const key = mailbox.id || mailbox.email;
            this.batchSelection.add(key);
        }
        this.render();
    }

    /**
     * 切换批量选择
     */
    toggleBatchSelection(mailbox) {
        const key = mailbox.id || mailbox.email;
        if (this.batchSelection.has(key)) {
            this.batchSelection.delete(key);
        } else {
            this.batchSelection.add(key);
        }
        this.render();
    }

    /**
     * 清空批量选择
     */
    clearBatchSelection() {
        this.batchSelection.clear();
        this.render();
    }

    /**
     * 设置选择回调
     */
    onSelect(callback) {
        this.onSelectCallback = callback;
    }

    /**
     * 设置删除回调
     */
    onDelete(callback) {
        this.onDeleteCallback = callback;
    }
}
