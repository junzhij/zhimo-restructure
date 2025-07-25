# 知墨学习平台 (ZhiMo Study Platform)

智能学习平台后端系统 - AI驱动的文档处理和学习辅助平台

## 功能特性

- 多格式文档上传和解析（PDF、Word、PPT、图片、网页）
- AI驱动的文档摘要生成
- 关键概念识别和提取
- 思维导图自动生成
- 智能练习题生成
- 多设备同步支持

## 技术栈

- **运行时**: Node.js (>=18.0.0)
- **框架**: Express.js
- **数据库**: MongoDB
- **AI服务**: OpenAI API
- **认证**: JWT Token
- **测试**: Jest

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- MongoDB
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 环境配置

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，配置必要的环境变量：
   - `MONGODB_URI`: MongoDB连接字符串
   - `JWT_SECRET`: JWT密钥
   - `OPENAI_API_KEY`: OpenAI API密钥

### 运行项目

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

### 运行测试

```bash
npm test
```

监听模式运行测试：
```bash
npm run test:watch
```

测试覆盖率：
```bash
npm run test:coverage
```

## 项目结构

```
src/
├── app.js              # 应用入口文件
├── controllers/        # 控制器层
├── services/          # 业务逻辑层
├── models/            # 数据模型层
├── routes/            # 路由定义
└── utils/             # 工具函数
    └── config.js      # 配置管理

tests/                 # 测试文件
```

## API文档

服务启动后，可以通过以下端点检查服务状态：

- `GET /health` - 健康检查

## 开发指南

### 代码规范

- 使用ES6+语法
- 遵循RESTful API设计原则
- 编写单元测试
- 使用有意义的提交信息

### 环境变量

所有配置通过环境变量管理，参考 `.env.example` 文件。

## 许可证

MIT License