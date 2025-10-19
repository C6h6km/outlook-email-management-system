// 使用新架构的 Express 应用（含服务层，支持 Vercel Blob 持久化）
const app = require('../server/app');

// Export the Express app as the serverless function handler
module.exports = app;



// Vercel Node.js Runtime config (use Node 22)
module.exports.config = {
  runtime: 'nodejs22.x'
};
