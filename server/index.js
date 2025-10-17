/**
 * 服务器入口文件
 */

const app = require('./app');
const config = require('./config');

// 启动服务器
app.listen(config.port, config.host, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   Easy Outlook Server v1.2.0          ║
╠═══════════════════════════════════════╣
║  Environment: ${config.env.padEnd(24)}║
║  Port:        ${config.port.toString().padEnd(24)}║
║  Health:      http://${config.host}:${config.port}/api/health  ║
╚═══════════════════════════════════════╝
    `.trim());
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('\n正在关闭服务器...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    process.exit(0);
});

