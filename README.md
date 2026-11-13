# AVS 视觉工坊 R2.0.1

SillyTavern 1.19.0 前端扩展，配合 AVS V4.1.10 角色档案使用。

## 安装

在 SillyTavern：扩展（Extensions）→ 安装扩展（Install Extension），输入本仓库地址 `https://github.com/<你的用户名>/avs-visual-workshop`，使用默认 main 分支，安装后刷新页面。

**这只是视觉工坊前端扩展。** 还需要从AVS完整整合安装包导入配套的V4.1.10 Core、R2角色档案UI和全局世界书。仅通过 GitHub 安装本扩展，不会自动安装酒馆助手脚本或世界书。

## 源码文件

- `manifest.json`：SillyTavern 扩展清单
- `index.js`：入口与界面
- `style.css`：样式
- `logic.js`：提示词及角色数据读取
- `engines.js`：图像生成及数据提供商适配
- `storage.js`：扩展的本地持久化

请不要向公开仓库提交API Key、用户聊天记录、浏览器存储导出或其他隐私数据。

## 说明

本仓库文件来自 AVS R2.0.1 原始整合包，未修改执行源码。真实 Pixiv 月榜及生图API功能仍受服务商凭据、网络和兼容性限制。V4.1.10 Core和世界书不会被本仓库修改。
