/**
 * 虚拟滚动列表类
 * 只渲染可见区域的列表项，大幅提升大数据量列表的性能
 */

import { rafThrottle } from './utils.js';

export class VirtualList {
    /**
     * @param {Object} options - 配置选项
     * @param {HTMLElement} options.container - 容器元素
     * @param {Array} options.data - 数据数组
     * @param {number} options.itemHeight - 每项的高度
     * @param {Function} options.renderItem - 渲染单项的函数
     * @param {number} options.bufferSize - 缓冲区大小（上下各多渲染几项）
     */
    constructor(options) {
        this.container = options.container;
        this.data = options.data || [];
        this.itemHeight = options.itemHeight || 80;
        this.renderItem = options.renderItem;
        this.bufferSize = options.bufferSize || 3;
        
        // 容器高度
        this.containerHeight = this.container.clientHeight;
        
        // 可见区域可以显示的项数
        this.visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
        
        // 当前渲染的范围
        this.startIndex = 0;
        this.endIndex = 0;
        
        // 内容容器
        this.contentContainer = null;
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化虚拟列表
     */
    init() {
        // 设置容器样式
        this.container.style.overflow = 'auto';
        this.container.style.position = 'relative';
        
        // 创建内容容器
        this.contentContainer = document.createElement('div');
        this.contentContainer.style.position = 'relative';
        this.contentContainer.style.height = `${this.getTotalHeight()}px`;
        this.container.appendChild(this.contentContainer);
        
        // 绑定滚动事件（使用RAF节流）
        const throttledScroll = rafThrottle(() => this.handleScroll());
        this.container.addEventListener('scroll', throttledScroll);
        
        // 初始渲染
        this.render();
    }
    
    /**
     * 获取总高度
     */
    getTotalHeight() {
        return this.data.length * this.itemHeight;
    }
    
    /**
     * 处理滚动事件
     */
    handleScroll() {
        const scrollTop = this.container.scrollTop;
        const newStartIndex = Math.floor(scrollTop / this.itemHeight);
        
        // 如果起始索引变化，重新渲染
        if (newStartIndex !== this.startIndex) {
            this.render();
        }
    }
    
    /**
     * 计算可见范围
     */
    getVisibleRange() {
        const scrollTop = this.container.scrollTop;
        
        // 计算起始和结束索引
        let startIndex = Math.floor(scrollTop / this.itemHeight);
        let endIndex = startIndex + this.visibleCount;
        
        // 添加缓冲区
        startIndex = Math.max(0, startIndex - this.bufferSize);
        endIndex = Math.min(this.data.length, endIndex + this.bufferSize);
        
        return { startIndex, endIndex };
    }
    
    /**
     * 渲染可见区域
     */
    render() {
        const { startIndex, endIndex } = this.getVisibleRange();
        
        // 保存当前范围
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        
        // 清空容器
        this.contentContainer.innerHTML = '';
        
        // 渲染可见项
        const fragment = document.createDocumentFragment();
        
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.renderItem(this.data[i], i);
            
            // 设置绝对定位
            item.style.position = 'absolute';
            item.style.top = `${i * this.itemHeight}px`;
            item.style.width = '100%';
            item.style.height = `${this.itemHeight}px`;
            item.style.boxSizing = 'border-box';
            
            fragment.appendChild(item);
        }
        
        this.contentContainer.appendChild(fragment);
    }
    
    /**
     * 更新数据
     * @param {Array} newData - 新数据
     */
    updateData(newData) {
        this.data = newData;
        this.contentContainer.style.height = `${this.getTotalHeight()}px`;
        this.render();
    }
    
    /**
     * 滚动到指定索引
     * @param {number} index - 索引
     */
    scrollToIndex(index) {
        const scrollTop = index * this.itemHeight;
        this.container.scrollTop = scrollTop;
    }
    
    /**
     * 获取当前数据
     */
    getData() {
        return this.data;
    }
    
    /**
     * 销毁虚拟列表
     */
    destroy() {
        this.container.innerHTML = '';
        this.contentContainer = null;
    }
}

/**
 * 简化版虚拟列表（使用transform代替绝对定位，性能更好）
 */
export class SimpleVirtualList {
    constructor(options) {
        this.container = options.container;
        this.data = options.data || [];
        this.itemHeight = options.itemHeight || 80;
        this.renderItem = options.renderItem;
        
        this.offset = 0;
        this.visibleCount = Math.ceil(this.container.clientHeight / this.itemHeight) + 2;
        
        this.init();
    }
    
    init() {
        this.container.style.overflow = 'auto';
        
        const throttledScroll = rafThrottle(() => this.update());
        this.container.addEventListener('scroll', throttledScroll);
        
        this.update();
    }
    
    update() {
        const scrollTop = this.container.scrollTop;
        const startIndex = Math.floor(scrollTop / this.itemHeight);
        const endIndex = Math.min(startIndex + this.visibleCount, this.data.length);
        
        const fragment = document.createDocumentFragment();
        const wrapper = document.createElement('div');
        wrapper.style.height = `${this.data.length * this.itemHeight}px`;
        wrapper.style.position = 'relative';
        
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.renderItem(this.data[i], i);
            item.style.position = 'absolute';
            item.style.top = `${i * this.itemHeight}px`;
            item.style.width = '100%';
            wrapper.appendChild(item);
        }
        
        this.container.innerHTML = '';
        this.container.appendChild(wrapper);
    }
    
    updateData(newData) {
        this.data = newData;
        this.update();
    }
}

