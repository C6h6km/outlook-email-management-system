const app = require('../server');

// Export the Express app as the serverless function handler
module.exports = app;



// Vercel Node.js Runtime config (use Node 22)
module.exports.config = {
  runtime: 'nodejs22.x'
};
