# AVS 视觉工坊 R2.9.0

SillyTavern 1.19.0 前端扩展。入口为「AVS 悬浮球 → 文生图」，从 V4.1.10 正式档案读取角色和当前穿搭。

自动配图只需首次配置 API，并上传一张画风参考图。每次普通 AI 回复结束后，插件等待档案同步，自动选景、编译、生成和入库。手动创作支持立绘、角色视角插画、实时画面插画和正文转漫画，可逐张预览调整。Nai 4 Full 与 Nai 5 Full 分别使用对应的提示词配置。附 19 类、2,361 条本地素材记录和 1,910 张不同本地图。

将本目录全部内容置于扩展目录，或发布到自己的 GitHub 仓库根目录后在 SillyTavern 用 URL 安装。分类索引见 `resource_library/README.md`，离线浏览页见 `resource_library/浏览素材仓库.html`。

R2.8.1 已移除商品联网链路。手动覆盖安装时，先清理扩展内旧 `resource_library`、`licenses`、`commerce.js`、`commerce_ui.js` 和 `COMMERCE_GUIDE.md`，再复制整个扩展目录。完整包的安装脚本会处理这些文件并保留 Pixiv 月榜数据。

服饰和配饰素材根据正文和当前物品编译。素材来源、署名和图像范围见 `THIRD_PARTY_NOTICES.md` 与 `data/source_manifest.json`。
