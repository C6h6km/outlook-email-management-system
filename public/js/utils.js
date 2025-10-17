/**
 * 性能优化工具函数库
 */

/**
 * 防抖函数 - 在事件停止触发n毫秒后才执行回调
 * 适用场景：搜索框输入、窗口resize、表单验证
 * @param {Function} func - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, delay = 300) {
    let timer = null;
    
    return function(...args) {
        const context = this;
        
        // 清除之前的定时器
        if (timer) {
            clearTimeout(timer);
        }
        
        // 设置新的定时器
        timer = setTimeout(() => {
            func.apply(context, args);
            timer = null;
        }, delay);
    };
}

/**
 * 节流函数 - 在n毫秒内最多执行一次回调
 * 适用场景：滚动事件、鼠标移动、resize事件
 * @param {Function} func - 要执行的函数
 * @param {number} delay - 时间间隔（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(func, delay = 200) {
    let lastTime = 0;
    let timer = null;
    
    return function(...args) {
        const context = this;
        const now = Date.now();
        
        // 计算剩余时间
        const remaining = delay - (now - lastTime);
        
        // 清除之前的定时器
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        
        // 如果已经过了延迟时间，立即执行
        if (remaining <= 0) {
            lastTime = now;
            func.apply(context, args);
        } else {
            // 否则等待剩余时间后执行
            timer = setTimeout(() => {
                lastTime = Date.now();
                func.apply(context, args);
                timer = null;
            }, remaining);
        }
    };
}

/**
 * 请求动画帧节流 - 使用requestAnimationFrame优化的节流
 * 适用场景：滚动、动画相关的频繁操作
 * @param {Function} func - 要执行的函数
 * @returns {Function} 节流后的函数
 */
export function rafThrottle(func) {
    let rafId = null;
    
    return function(...args) {
        const context = this;
        
        if (rafId) {
            return;
        }
        
        rafId = requestAnimationFrame(() => {
            func.apply(context, args);
            rafId = null;
        });
    };
}

/**
 * 批量DOM操作 - 使用文档片段优化DOM操作
 * @param {HTMLElement} container - 容器元素
 * @param {Function} createElements - 创建元素的函数，返回元素数组
 * @param {boolean} clear - 是否先清空容器
 */
export function batchUpdateDOM(container, createElements, clear = true) {
    const fragment = document.createDocumentFragment();
    const elements = createElements();
    
    elements.forEach(element => {
        fragment.appendChild(element);
    });
    
    if (clear) {
        container.innerHTML = '';
    }
    
    container.appendChild(fragment);
}

/**
 * 使用innerHTML批量更新（性能更好，但要注意XSS）
 * @param {HTMLElement} container - 容器元素
 * @param {string} html - HTML字符串
 */
export function fastUpdateHTML(container, html) {
    // 使用DOMParser可以更安全
    container.innerHTML = html;
}

/**
 * 转义HTML，防止XSS攻击
 * @param {string} str - 要转义的字符串
 * @returns {string} 转义后的字符串
 */
export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * 格式化日期
 * @param {string|Date} date - 日期
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 延迟执行
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 深拷贝对象
 * @param {*} obj - 要拷贝的对象
 * @returns {*} 拷贝后的对象
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj);
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    const clonedObj = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            clonedObj[key] = deepClone(obj[key]);
        }
    }
    
    return clonedObj;
}

