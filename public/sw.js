/**
 * Service Worker - PWA离线支持
 * 版本：v2.0
 */

const CACHE_NAME = 'easy-outlook-v2.1';
const RUNTIME_CACHE = 'easy-outlook-runtime-v2.1';

// 需要缓存的静态资源
const STATIC_ASSETS = [
    '/index-optimized.html',
    '/css/styles.css',
    '/css/mobile.css',
    '/js/app.js',
    '/js/mobile-enhance.js',
    '/js/mail-api-utils.js',
    '/js/utils.js',
    '/js/email-list-manager.js',
    '/js/error-handler.js',
    '/js/logger.js',
    '/js/store.js',
    '/js/config.js',
    '/manifest.json'
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', (event) => {
    console.log('[SW] 安装中...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] 缓存静态资源');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] 安装完成，跳过等待');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] 安装失败:', error);
            })
    );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
    console.log('[SW] 激活中...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                            console.log('[SW] 删除旧缓存:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] 激活完成，接管所有客户端');
                return self.clients.claim();
            })
    );
});

// 拦截请求 - 缓存策略
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 跳过非GET请求
    if (request.method !== 'GET') {
        return;
    }

    // 跳过chrome扩展请求
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    // API请求 - 网络优先策略
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // 页面导航 - 网络优先，避免旧HTML被缓存卡住
    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }

    // 静态资源 - 缓存优先策略
    if (STATIC_ASSETS.some(asset => url.pathname === asset)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // 其他请求 - 网络优先，缓存降级
    event.respondWith(networkFirst(request));
});

/**
 * 缓存优先策略
 * 适用于静态资源
 */
async function cacheFirst(request) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        
        if (cached) {
            console.log('[SW] 从缓存返回:', request.url);
            return cached;
        }
        
        console.log('[SW] 缓存未命中，从网络获取:', request.url);
        const response = await fetch(request);
        
        // 缓存成功的响应
        if (response.ok) {
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.error('[SW] 缓存优先策略失败:', error);
        return new Response('网络错误', { status: 503 });
    }
}

/**
 * 网络优先策略
 * 适用于动态内容和API请求
 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        
        // 缓存成功的响应（运行时缓存）
        if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.log('[SW] 网络请求失败，尝试从缓存返回:', request.url);
        
        // 尝试从运行时缓存返回
        const runtimeCache = await caches.open(RUNTIME_CACHE);
        const cached = await runtimeCache.match(request);
        
        if (cached) {
            console.log('[SW] 从运行时缓存返回');
            return cached;
        }
        
        // 尝试从静态缓存返回
        const staticCache = await caches.open(CACHE_NAME);
        const staticCached = await staticCache.match(request);
        
        if (staticCached) {
            console.log('[SW] 从静态缓存返回');
            return staticCached;
        }
        
        // 都没有，返回离线页面
        return new Response(
            `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>离线模式 - Easy Outlook</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .container {
                        text-align: center;
                        padding: 40px;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 20px;
                        backdrop-filter: blur(10px);
                    }
                    h1 { font-size: 2.5rem; margin-bottom: 20px; }
                    p { font-size: 1.2rem; margin-bottom: 30px; }
                    button {
                        padding: 15px 30px;
                        font-size: 1rem;
                        background: white;
                        color: #667eea;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: bold;
                    }
                    button:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📵 离线模式</h1>
                    <p>您当前处于离线状态，部分功能可能无法使用</p>
                    <button onclick="window.location.reload()">重新连接</button>
                </div>
            </body>
            </html>
            `,
            {
                status: 503,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
        );
    }
}

// 消息事件 - 与主线程通信
self.addEventListener('message', (event) => {
    console.log('[SW] 收到消息:', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'CLEAR_CACHE') {
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            event.ports[0].postMessage({ success: true });
        });
    }
});

// 后台同步事件（未来功能）
self.addEventListener('sync', (event) => {
    console.log('[SW] 后台同步:', event.tag);
    
    if (event.tag === 'sync-emails') {
        event.waitUntil(syncEmails());
    }
});

/**
 * 同步邮件（示例）
 */
async function syncEmails() {
    console.log('[SW] 同步邮件中...');
    // 这里可以实现后台同步逻辑
    return Promise.resolve();
}

// 推送通知事件（未来功能）
self.addEventListener('push', (event) => {
    console.log('[SW] 收到推送通知');
    
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Easy Outlook';
    const options = {
        body: data.body || '您有新的邮件',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: data,
        actions: [
            { action: 'view', title: '查看', icon: '/icons/icon-96x96.png' },
            { action: 'close', title: '关闭', icon: '/icons/icon-96x96.png' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// 通知点击事件
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] 通知被点击:', event.action);
    
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/index-optimized.html')
        );
    }
});

console.log('[SW] Service Worker 已加载');


