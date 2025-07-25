// 测试环境变量加载
require('dotenv').config();

console.log('=== 环境变量测试 ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('AWS_REGION', process.env.AWS_REGION);
console.log('MYSQL_USER:', process.env.MYSQL_USER);
console.log('MYSQL_PASSWORD:', process.env.MYSQL_PASSWORD ? '***' : 'undefined');
console.log('MYSQL_DATABASE:', process.env.MYSQL_DATABASE);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '***' : 'undefined');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '***' : 'undefined');
console.log('===================');