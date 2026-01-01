/**
 * 移动端增强功能模块
 * 包含手势支持、下拉刷新、返回顶部等功能
 */

import { debounce, throttle } from './utils.js';

/**
 * 手势管理器 - 支持左右滑动切换视图
 */
class GestureManager {
    constructor() {
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        this.minSwipeDistance = 50; // 最小滑动距离
        this.enabled = this.isMobileDevice();
    }

    isMobileDevice() {
        return window.innerWidth <= 768;
    }

    init() {
        if (!this.enabled) return;

        const container = document.querySelector('.app-container');
        
        container.addEventListener('touchstart', (e) => {
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
        }, { passive: true });

        container.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].clientX;
            this.touchEndY = e.changedTouches[0].clientY;
            this.handleSwipe();
        }, { passive: true });
    }

    handleSwipe() {
        const deltaX = this.touchEndX - this.touchStartX;
        const deltaY = this.touchEndY - this.touchStartY;

        // 判断是否为水平滑动（水平距离 > 垂直距离）
        if (Math.abs(deltaX) < this.minSwipeDistance) return;
        if (Math.abs(deltaY) > Math.abs(deltaX)) return;

        const currentView = this.getCurrentView();

        if (deltaX > 0) {
            // 向右滑动 - 前一个视图
            this.navigateToPrevious(currentView);
        } else {
            // 向左滑动 - 下一个视图
            this.navigateToNext(currentView);
        }
    }

    getCurrentView() {
        const activeBtn = document.querySelector('.mobile-nav-btn.active');
        return activeBtn ? activeBtn.dataset.target : 'sidebar';
    }

    navigateToPrevious(current) {
        const views = ['sidebar', 'email-sidebar', 'main-content'];
        const currentIndex = views.indexOf(current);
        if (currentIndex > 0) {
            const prevView = views[currentIndex - 1];
            window.switchMobileView(prevView);
            this.showToast('← ' + this.getViewName(prevView));
        }
    }

    navigateToNext(current) {
        const views = ['sidebar', 'email-sidebar', 'main-content'];
        const currentIndex = views.indexOf(current);
        if (currentIndex < views.length - 1) {
            const nextView = views[currentIndex + 1];
            window.switchMobileView(nextView);
            this.showToast(this.getViewName(nextView) + ' →');
        }
    }

    getViewName(view) {
        const names = {
            'sidebar': '设置',
            'email-sidebar': '邮件列表',
            'main-content': '邮件内容'
        };
        return names[view] || view;
    }

    showToast(message) {
        const existing = document.querySelector('.gesture-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'gesture-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 1500);
    }
}

/**
 * 下拉刷新管理器
 */
class PullToRefresh {
    constructor(element, onRefresh) {
        this.element = element;
        this.onRefresh = onRefresh;
        this.touchStartY = 0;
        this.pullDistance = 0;
        this.threshold = 80; // 触发刷新的阈值
        this.isRefreshing = false;
        this.enabled = window.innerWidth <= 768;
    }

    init() {
        if (!this.enabled) return;

        this.createRefreshIndicator();
        
        this.element.addEventListener('touchstart', (e) => {
            if (this.element.scrollTop === 0) {
                this.touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        this.element.addEventListener('touchmove', (e) => {
            if (this.isRefreshing) return;
            
            const touchY = e.touches[0].clientY;
            const diff = touchY - this.touchStartY;

            if (diff > 0 && this.element.scrollTop === 0) {
                this.pullDistance = Math.min(diff, this.threshold * 1.5);
                this.updateIndicator();
            }
        }, { passive: true });

        this.element.addEventListener('touchend', async () => {
            if (this.pullDistance >= this.threshold && !this.isRefreshing) {
                this.isRefreshing = true;
                this.showRefreshing();
                
                try {
                    await this.onRefresh();
                } catch (error) {
                    console.error('刷新失败:', error);
                }
                
                this.hideRefreshing();
                this.isRefreshing = false;
            }
            
            this.pullDistance = 0;
            this.updateIndicator();
        }, { passive: true });
    }

    createRefreshIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'pull-refresh-indicator';
        indicator.innerHTML = `
            <div class="refresh-spinner"></div>
            <span class="refresh-text">下拉刷新</span>
        `;
        this.element.insertBefore(indicator, this.element.firstChild);
        this.indicator = indicator;
    }

    updateIndicator() {
        if (!this.indicator) return;
        
        const progress = Math.min(this.pullDistance / this.threshold, 1);
        this.indicator.style.transform = `translateY(${this.pullDistance}px)`;
        this.indicator.style.opacity = progress;

        const text = this.indicator.querySelector('.refresh-text');
        if (progress >= 1) {
            text.textContent = '释放刷新';
        } else {
            text.textContent = '下拉刷新';
        }
    }

    showRefreshing() {
        if (!this.indicator) return;
        this.indicator.classList.add('refreshing');
        this.indicator.style.transform = `translateY(${this.threshold}px)`;
        this.indicator.querySelector('.refresh-text').textContent = '刷新中...';
    }

    hideRefreshing() {
        if (!this.indicator) return;
        setTimeout(() => {
            this.indicator.classList.remove('refreshing');
            this.indicator.style.transform = 'translateY(0)';
            this.indicator.style.opacity = '0';
        }, 500);
    }
}

/**
 * 返回顶部按钮
 */
class BackToTop {
    constructor() {
        this.button = null;
        this.scrollThreshold = 300;
        this.enabled = true;
    }

    init() {
        if (!this.enabled) return;

        this.createButton();
        this.bindEvents();
    }

    createButton() {
        this.button = document.createElement('button');
        this.button.className = 'back-to-top';
        this.button.innerHTML = '↑';
        this.button.setAttribute('aria-label', '返回顶部');
        this.button.style.display = 'none';
        document.body.appendChild(this.button);
    }

    bindEvents() {
        // 监听滚动事件（使用节流优化）
        const checkScroll = throttle(() => {
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollY > this.scrollThreshold) {
                this.button.style.display = 'flex';
            } else {
                this.button.style.display = 'none';
            }
        }, 200);

        window.addEventListener('scroll', checkScroll, { passive: true });

        // 点击返回顶部
        this.button.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

/**
 * 触摸反馈增强
 */
class TouchFeedback {
    constructor() {
        this.enabled = 'ontouchstart' in window;
    }

    init() {
        if (!this.enabled) return;

        // 为所有按钮和可点击元素添加触摸反馈
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('button, .mailbox-item, .email-item, .tab');
            if (target) {
                target.classList.add('touching');
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            const target = e.target.closest('button, .mailbox-item, .email-item, .tab');
            if (target) {
                setTimeout(() => {
                    target.classList.remove('touching');
                }, 150);
            }
        }, { passive: true });

        document.addEventListener('touchcancel', (e) => {
            const target = e.target.closest('button, .mailbox-item, .email-item, .tab');
            if (target) {
                target.classList.remove('touching');
            }
        }, { passive: true });
    }
}

/**
 * 深色模式管理器
 */
class DarkModeManager {
    constructor() {
        this.enabled = this.loadPreference();
        this.toggle = null;
    }

    init() {
        this.createToggle();
        this.applyMode();
        this.bindEvents();
    }

    createToggle() {
        const toggle = document.createElement('button');
        toggle.className = 'dark-mode-toggle';
        toggle.innerHTML = this.enabled ? '☀️' : '🌙';
        toggle.setAttribute('aria-label', '切换深色模式');
        toggle.title = '切换深色模式';
        
        const header = document.querySelector('.header');
        if (header) {
            header.appendChild(toggle);
            this.toggle = toggle;
        }
    }

    bindEvents() {
        if (!this.toggle) return;

        this.toggle.addEventListener('click', () => {
            this.enabled = !this.enabled;
            this.applyMode();
            this.savePreference();
            this.toggle.innerHTML = this.enabled ? '☀️' : '🌙';
        });
    }

    applyMode() {
        if (this.enabled) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    loadPreference() {
        const saved = localStorage.getItem('darkMode');
        if (saved !== null) {
            return saved === 'true';
        }
        // 默认跟随系统设置
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    savePreference() {
        localStorage.setItem('darkMode', this.enabled);
    }
}

/**
 * 骨架屏加载
 */
class SkeletonLoader {
    static show(container, type = 'list') {
        const skeleton = document.createElement('div');
        skeleton.className = `skeleton skeleton-${type}`;
        
        if (type === 'list') {
            skeleton.innerHTML = `
                ${Array(5).fill(0).map(() => `
                    <div class="skeleton-item">
                        <div class="skeleton-line skeleton-line-title"></div>
                        <div class="skeleton-line skeleton-line-text"></div>
                        <div class="skeleton-line skeleton-line-text short"></div>
                    </div>
                `).join('')}
            `;
        } else if (type === 'email') {
            skeleton.innerHTML = `
                <div class="skeleton-header">
                    <div class="skeleton-line skeleton-line-title"></div>
                    <div class="skeleton-line skeleton-line-text"></div>
                </div>
                <div class="skeleton-content">
                    <div class="skeleton-line skeleton-line-text"></div>
                    <div class="skeleton-line skeleton-line-text"></div>
                    <div class="skeleton-line skeleton-line-text short"></div>
                </div>
            `;
        }
        
        container.innerHTML = '';
        container.appendChild(skeleton);
    }

    static hide(container) {
        const skeleton = container.querySelector('.skeleton');
        if (skeleton) {
            skeleton.remove();
        }
    }
}

/**
 * 长按菜单（用于邮箱/邮件项的操作）
 */
class LongPressMenu {
    constructor() {
        this.menu = null;
        this.currentTarget = null;
        this.pressTimer = null;
        this.pressDelay = 500; // 长按延迟（毫秒）
    }

    init() {
        this.createMenu();
        this.bindEvents();
    }

    createMenu() {
        this.menu = document.createElement('div');
        this.menu.className = 'long-press-menu';
        this.menu.style.display = 'none';
        document.body.appendChild(this.menu);
    }

    bindEvents() {
        // 监听邮箱和邮件项的长按
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.mailbox-item, .email-item');
            if (!target) return;

            this.currentTarget = target;
            this.pressTimer = setTimeout(() => {
                this.showMenu(e.touches[0], target);
            }, this.pressDelay);
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (this.pressTimer) {
                clearTimeout(this.pressTimer);
                this.pressTimer = null;
            }
        }, { passive: true });

        document.addEventListener('touchmove', () => {
            if (this.pressTimer) {
                clearTimeout(this.pressTimer);
                this.pressTimer = null;
            }
        }, { passive: true });

        // 点击其他地方关闭菜单
        document.addEventListener('click', (e) => {
            if (this.menu && !this.menu.contains(e.target)) {
                this.hideMenu();
            }
        });
    }

    showMenu(touch, target) {
        if (!this.menu) return;

        // 振动反馈（如果支持）
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        // 确定菜单内容
        let menuItems = [];
        if (target.classList.contains('mailbox-item')) {
            menuItems = [
                { label: '复制邮箱信息', action: 'copy-mailbox' },
                { label: '删除邮箱', action: 'delete-mailbox', danger: true }
            ];
        } else if (target.classList.contains('email-item')) {
            menuItems = [
                { label: '标记为已读', action: 'mark-read' },
                { label: '移至垃圾箱', action: 'move-junk' },
                { label: '删除', action: 'delete-email', danger: true }
            ];
        }

        // 生成菜单HTML
        this.menu.innerHTML = menuItems.map(item => `
            <button class="menu-item ${item.danger ? 'danger' : ''}" data-action="${item.action}">
                ${item.label}
            </button>
        `).join('');

        // 定位菜单
        this.menu.style.left = touch.clientX + 'px';
        this.menu.style.top = touch.clientY + 'px';
        this.menu.style.display = 'block';

        // 绑定菜单项点击事件
        this.menu.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                this.handleMenuAction(item.dataset.action, target);
                this.hideMenu();
            });
        });
    }

    hideMenu() {
        if (this.menu) {
            this.menu.style.display = 'none';
        }
        this.currentTarget = null;
    }

    handleMenuAction(action, target) {
        switch (action) {
            case 'copy-mailbox':
                if (window.exportSelectedMailbox) {
                    // 先选中该邮箱
                    target.click();
                    setTimeout(() => window.exportSelectedMailbox(), 100);
                }
                break;
            case 'delete-mailbox':
                if (confirm('确定要删除这个邮箱吗？')) {
                    const deleteBtn = target.querySelector('.delete-mailbox');
                    if (deleteBtn) deleteBtn.click();
                }
                break;
            case 'mark-read':
                console.log('标记为已读功能待实现');
                break;
            case 'move-junk':
                console.log('移至垃圾箱功能待实现');
                break;
            case 'delete-email':
                console.log('删除邮件功能待实现');
                break;
        }
    }
}

/**
 * 初始化所有移动端增强功能
 */
export function initMobileEnhancements() {
    console.log('🚀 初始化移动端增强功能...');

    // 手势管理
    const gestureManager = new GestureManager();
    gestureManager.init();

    // 下拉刷新（邮件列表）
    const emailList = document.getElementById('emailList');
    if (emailList) {
        const pullToRefresh = new PullToRefresh(emailList, async () => {
            if (window.loadEmailList) {
                await window.loadEmailList();
            }
        });
        pullToRefresh.init();
    }

    // 返回顶部按钮
    const backToTop = new BackToTop();
    backToTop.init();

    // 触摸反馈
    const touchFeedback = new TouchFeedback();
    touchFeedback.init();

    // 深色模式
    const darkMode = new DarkModeManager();
    darkMode.init();

    // 长按菜单
    const longPressMenu = new LongPressMenu();
    longPressMenu.init();

    console.log('✅ 移动端增强功能初始化完成');
}

// 导出工具类
export {
    GestureManager,
    PullToRefresh,
    BackToTop,
    TouchFeedback,
    DarkModeManager,
    SkeletonLoader,
    LongPressMenu
};


