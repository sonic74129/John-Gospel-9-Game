# 权利与来源说明

## 1. 仓库状态

本仓库为 private。当前没有附加开放源代码许可证或素材再分发许可证，也不因文件被放入
GitHub 就自动授予公开复制、修改或再分发权。

## 2. 指引来源

最高制作规范和架构文件来自：

```text
repository: sonic74129/JohnRPGGame
guidance commit: cfb8e7f
date: 2026-08-02
```

## 3. 首批图片来源

首批候选来自：

```text
repository: sonic74129/JohnRPGGame
QA baseline: 660e3f94655e66be2486f97b7917d151f3add1e3
provider: Azure AI Foundry
deployment: mai-image-2-5-pro
model: MAI-Image-2.5-Pro@2026-06-19
authentication used by production pipeline: Azure CLI / Entra ID
```

原项目 manifest 将对应 source run 标记为 `approved`。本仓库保留 source/runtime
配对、模型版本、源 commit 和确定性 SHA-256，但把跨故事状态重新设为 `candidate`。

## 4. 发布前权利检查

公开发布任何 pack 前，repository owner 必须确认：

- 当时适用的 Microsoft/Azure 服务条款允许目标使用和分发方式。
- 输入 prompt、参考素材和后期处理没有引入第三方受限内容。
- 人物形象、音乐、字体和经文译本分别有适当权限。
- pack 明确附带自己的 LICENSE/NOTICE；不能依赖本文件替代法律授权。

本文件记录工程来源，不构成法律意见。

## 5. 本次排除

- 原项目没有 license/notice 记录的音乐没有迁移。
- John 11 经文语音和 SSML 属于故事内容，没有迁移。
- 故事地图、坐标、人物肖像和未批准生成候选没有迁移。
- raw manifest 中的本机绝对路径没有迁移。
