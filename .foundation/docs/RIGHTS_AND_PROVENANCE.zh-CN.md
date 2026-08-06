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

## 4. 在线经文来源记录

当用户指定和合本（CUV）并明确要求在线查找时，故事执行者应直接完成来源查找和内容
录入，不等待用户另行粘贴经文。每次录入至少记录：

- 原始页面 URL、网站或发布者、页面标题与访问日期。
- 经文范围、页面标示的译本名称，以及简体/繁体或其他可见版本差异。
- 录入内容与 verse key 的覆盖、hash、空值和交叉来源差异检查。
- 若首个来源不可访问、缺节或与另一来源冲突，实际采用的替代来源和差异处理说明。

可追溯来源证明文字从哪里取得，不自动证明公开复制或再分发许可。流水线必须自动保存
来源和分发 evidence，不要求用户审核或确认。evidence 不足时自动使用 private
distribution scope 并继续完成不可变 release；不能留空经文、停在 preview 或伪造公开
许可。

## 5. 自动分发 evidence

流水线对每个 pack 自动收集并保存：

- `evidenceCollector: "copilot"`，明确没有待处理的用户 reviewer。
- 当时适用的 Microsoft/Azure 服务条款或许可证快照及其 URL/hash。
- prompt、参考素材、模型、后期处理和生成 run 的可追溯记录。
- 人物形象、音乐、字体和经文译本的来源与允许使用范围 evidence。
- pack 自己的 LICENSE/NOTICE 或明确的 private-only distribution scope。

自动证据明确支持公开复制和再分发时才设置 public scope；否则设置 private scope，并
继续生成、接线、测试和发布完整私有 artifact。provenance 是机器可验证事实，不是等待
repository owner、用户或 reviewer 放行的工作队列。

旧来源若带 `review`、`approval` 或 rights 字段，只作为导入事实；Copilot 必须自动迁移、
填充和验证当前 evidence 字段，不得把旧字段解释成新的人工确认步骤。

本文件记录工程来源，不构成法律意见。

## 6. 本次排除

- 原项目没有 license/notice 记录的音乐没有迁移。
- John 11 经文语音和 SSML 属于故事内容，没有迁移。
- 故事地图、坐标、人物肖像和未批准生成候选没有迁移。
- raw manifest 中的本机绝对路径没有迁移。
