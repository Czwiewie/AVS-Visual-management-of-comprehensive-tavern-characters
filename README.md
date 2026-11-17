# AVS 视觉工坊 R2.6.0

面向 SillyTavern 1.19.0 的浏览器前端扩展。入口仍是原 AVS 悬浮球 → 文生图；角色档案组件维持 V4.1.10。

- 本地2483条视觉候选词，含发型、服饰、表情、姿势、配饰、美甲与装饰；6张经过类别检查的本地示例。
- 指定女角色立绘、指定角色视角插画、实时画面插画、正文转漫画使用不同的8层模板。
- 提示词API检索并选择有依据的角色片段；Nai 4 Full / Nai 5 Full 编译成全局与独立角色槽，保留物品ID、穿戴状态与可见性。
- 生成后先临时预览；保存时进入图库，并可插入对应AI回复的媒体附件，正文文本保持原样。
- 旧API配置、图库及画风继续使用原存储键。不要清除站点数据。

## 安装与更新

本目录全部文件都是仓库内容，manifest.json 必须在仓库根目录。新增 data/visual_catalog.js、data/mode_templates.js、源码模块、licenses/、previews/ 必须一起上传。若已有 data/pixiv-monthly.json，请保留已同步的真实榜单。

GitHub URL安装：SillyTavern → 扩展管理 → 安装扩展 → 输入你自己的本仓库URL。也可使用完整包根目录的本地安装脚本。详细步骤见完整包《00_先读我_安装与更新.md》。

## 配置

设置 → 生图引擎 → NovelAI官方API → 明确选择 V4 Full 或 V5 Full。V4 Full 与 V4.5 Full 是不同型号，本版不会将旧V4.5设置自动改成V4。OpenAI兼容服务的实际模型ID与提示词适配型号分别配置；不要把适配型号当成真实模型识别器。

中文档案用于Nai时，请启用独立提示词API或“使用主API”，返回本版要求的英文分层JSON。素材自动检索默认开启，普通玩家无需逐项挑选。

## 检查范围

已通过编译、接口协议与DOM事件链路的离线模拟检查。Token预算使用明确标注的保守估算；未集成精确的目标模型tokenizer。未使用真实NovelAI密钥生图，未进行Android实机验收。Chromium在本次构建环境因进程所需本地socket被禁止而未能启动，不能据此声称CSS真机验收通过。

来源与许可见 THIRD_PARTY_NOTICES.md 和 data/source_manifest.json。词条是候选语言，逐条效果均未经过Nai生图验证。
