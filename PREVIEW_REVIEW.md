# 来源与筛选记录 · 2026-11-18

用户修正名称采用 **澜姿**。GitHub来源门槛为核对时至少100星；星数是当时快照，之后可能变化。

| 来源 | 当时星数 | 本包实际采用 | 排除内容 |
|---|---:|---|---|
| [拍片哥女装](https://github.com/paipiange/nvzhuang) | 2890 | data-anime.js的1320条及无人动漫衣装缩略图 | 真人衣装分库、全部人像模特库、试穿身份素材 |
| [澜姿](https://github.com/wzc520pyfm/gen-ai-pose-image) | 981 | 98组常规匿名姿势，共490视角缩略图 | 成人动作组、脸库、默认鲸娘角色形象 |
| [中国传统花纹](https://github.com/dososo/chinese-traditional-patterns) | 364 | 100张独立纹样原始PNG及名称/分类 | 卡片文字、纸张、版式不进入画风 |
| [PixelFX](https://github.com/patch-gg/pixelfx) | 7969 | 81个非人物特效的文字候选 | 演示人物、角色/生物图、像素画风强制迁移 |
| [ArtCraft](https://github.com/storytold/artcraft) | 41376 | 学习画布、场景编排和多步创作流程；未捆绑代码或图片 | 不冒充服饰图片库 |

Mirage、punl skill 不能唯一确认作者/仓库，目前未使用，也未换成未经确认的同名项目。

## 可追溯文件

`data/source_manifest.json` 列出来源提交、星数快照、1910张图的路径与SHA256；仓库原始衣装数据、澜姿catalog、花纹JSON、PixelFX目录位于 `resource_library/sources`。本包另有370条独立编写的常见设计术语，不复制被排除的低星库来改名冒充原创。

## 图片检查范围

已查看12张黑色礼服样本、40张跨分组姿势样本和100张纹样总览；源数据中无人衣装的标注不等于人工逐张验收1320图。所有启用图片编译的内置素材在进入导演前还要实际视觉筛查。筛查模型可能判断错误，不宣称绝对无误。

## 署名

澜姿程序MIT；姿势原作作者ギア（giaaibusi），来源 ai-pose-gallery；中文整理 Anhao / ai-pose-gallery-zh。画作非商业范围说明与程序许可证分开保留。中国传统花纹为CC-BY-NC-4.0，保留来源署名。拍片哥女装与PixelFX各自许可证位于licenses目录，原始图片归属说明保留在来源记录。AVS的开源非商业用途不会把第三方图片改称AVS原创。

旧PerfectLab人物照片、旧美甲人手照片及其余低星素材项目全部从本包内置目录移除；原有历史图库属于用户数据，不会自动删除。
