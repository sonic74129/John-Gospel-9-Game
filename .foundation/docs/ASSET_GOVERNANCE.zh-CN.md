# 共享素材治理

## 1. 三层素材

| 层级 | 示例 | 默认归属 |
| --- | --- | --- |
| 平台共用 | UI、输入提示、通用交互音、schema | Foundation / SDK |
| 时代地区包 | 第一世纪犹太地块、石屋、陶器、衣料 | Foundation asset pack |
| 故事专用 | 伯大尼完整地图、马大肖像、John 11 语音 | Story repository |

完整地图、经文语音、Beat、坐标和故事状态永远不因为视觉相似而提升为共享素材。

## 2. 生命周期

```text
candidate
-> validated
-> stable
-> deprecated
```

### candidate

- 已知来源和原项目批准记录。
- 尚未证明跨故事复用。
- 不允许故事 production build 自动依赖。

### validated

- 至少第二个独立故事实际接入。
- 尺寸、锚点、碰撞、镜头和风格契约通过。
- provenance 与 distribution-scope evidence 已自动记录。

### stable

- 作为不可变 release 发布。
- 有 SemVer、manifest、SHA-256、兼容范围和迁移说明。
- 修复必须发布新版本，禁止原地覆盖。

### deprecated

- 保留旧 release 和 hash。
- 标记替代版本与停止支持时间。
- 不破坏仍锁定旧版本的故事。

## 3. 提升门槛

素材从 candidate 提升前由流水线自动生成以下 evidence：

1. 第二个故事是否真的需要，而不是“可能需要”？
2. 是否属于同一时代、地区、镜头和比例？
3. 人物身份是否应该跨故事固定？
4. runtime 锚点、透明边缘、尺寸和压缩是否稳定？
5. 来源、模型、prompt version、自动/人工处理事实和 SHA-256 是否完整？
6. 是否允许私有使用、发布和再分发？
7. 升级后是否会改变已经发布的故事？

任一项不清楚时保持 candidate，但故事流水线不得停下：自动改用 stable pack、处理
story-local 正式资产或重新生成，并继续 runtime 接线与 QA。

## 4. Pack 规则

- 一个 pack 只服务一个清楚的兼容范围。
- `0.x` 仅用于 candidate/validated；第一个 stable release 从 `1.0.0` 开始。
- 每个 release 包含 `pack.json`、`manifest.json` 和 runtime files。
- `manifest.json` 由脚本生成，记录每个文件的 bytes、尺寸和 SHA-256。
- source/master 可以保留用于再处理，但故事 build 只复制 runtime files。
- 故事以 `assets.lock.json` 锁定 release URL、version 和 artifact SHA-256。

## 5. 人物身份

- 耶稣等跨故事人物可以建立 identity pack，但必须逐故事复核时代、年龄、服装和叙事
  连续性。
- identity pack 不隐式漂移；Copilot 根据故事 contract 显式锁定版本并自动验证。
- 马大、马利、拉撒路等与具体叙事状态紧密相关的人物默认留在故事 repo。
- 肖像必须从同一 identity 生成，不能另选不一致的演员脸。

## 6. 当前首批候选

`nt-judea-first-century@0.1.0`：

- 已批准的第一世纪室内生活道具母图与透明 runtime atlas。
- 已批准的户外地块母图与 runtime atlas。
- 已批准但尚需拆分/透明化验证的世界物件母图。

`identity-jesus-storybook@0.1.0`：

- 已批准的角色 source sheet。
- 288 × 800 runtime sheet，四方向、三列动作映射。

两者都尚未经过第二个故事验证，因此不能标记 stable。
