# 端到端完成政策

## 1. 默认解释

当用户说“制作一个游戏”“把故事做出来”“完成这个故事”或同等表达时，默认要求是：

```text
经文与玩法契约
-> 内部几何验证
-> MAI 正式美术
-> runtime 集成
-> 关键 Speech / 字幕 / 音乐
-> 完整 QA
-> 固定且可运行的 release artifact
```

不能把其中任何中间阶段解释成用户交付，也不能把治理 evidence 变成人工等待点。无需
用户 review、approval、confirmation 或 wait；本政策中的自动继续义务覆盖下层流程的
任何相反 gate。

## 2. 灰盒是必须保留的 QA 基线

灰盒不是可省略的步骤。它是内部工程基线，用来锁定：

- 世界尺寸、区域和路线。
- 镜头与安全边界。
- 人物高度、门洞和交互距离。
- normal、skip、restart 和重进 final state。
- 桌面与窄屏可达性。

灰盒 contract、测试和必要 debug overlay 应保留在 development-only 路径，供正式图
接入后的回归比较。灰盒通过后必须立即进入 MAI 生产。执行者不得：

- 在灰盒画面处结束任务。
- 把灰盒称为“完整故事”“生产完成”“最终版”。
- 因为已经有可运行矩形、色块或候选角色，就跳过正式地图和人物。
- 把来源、权利或发布 evidence 状态误当成不能继续制作的理由。

## 3. 通过后自动生图与回滚循环

标准循环为：

```text
灰盒 QA 通过
-> 自动执行 MAI
-> 处理并接入正式图
-> 用实际像素重跑路线/比例/镜头/碰撞/遮挡 QA
-> 通过：继续下一资产或完整 QA
-> 失败：只回滚受影响区域到灰盒契约，修正、重验并重做受影响素材
```

回滚规则：

- 保留已通过的灰盒坐标、测试、截图或 overlay，不能在生图时删除 QA 基线。
- 不因一个正式资产失败而推翻已验收且不受影响的角色、地图或素材。
- 先判断是 contract 问题、生成图问题还是 runtime 处理问题。
- contract 问题先回灰盒修正；图片问题只产生新 prompt version；处理问题只重跑处理。
- 回归通过后自动恢复正式图流程。
- 经文、神学、权利或主观方向使用用户已给目标、Foundation 约束、可追溯来源与验收契约
  自主作出最小风险决定并记录依据，不把决定退回用户。

## 4. 强制继续的正式生产

内部几何锁定后，按 Foundation 第 7 节继续：

1. 复核 Azure subscription、resource、deployment、model 和 Entra 登录。
2. 建立故事自己的 prompt registry 与 story-style contract。
3. 生成 2–3 个母版/地图候选，用机器检查和 Copilot 视觉 QA 自动评分、选定并记录
   acceptance evidence。
4. 环境通过验收后自动生成并处理人物、特殊动作、肖像和活动物件；玩家控制角色必须形成
   `up`、`down`、`left`、`right` 四向正式 runtime 状态，不能停在候选生成。
5. 用实际图片重新校准 anchor、碰撞、导航、遮挡和镜头。
6. 将验收通过的 runtime assets 接入所有 Beat，并验证玩家移动时按方向切换、停止时
   保持最后朝向。
7. 完成关键 Speech、字幕 fallback、音频后期和 hash。
8. 执行正常、all-skip、restart、desktop、mobile 和浏览器视觉 QA。

如果已有 validated stable asset pack，可以复用，不必为了“使用 MAI”重复生成；但所有
story-local 缺口必须补齐，不能以灰盒替代。

## 5. 经文来源与非空门槛

用户明确指定和合本（CUV）并要求在线取得时，执行者必须：

1. 搜索可追溯、明确标示译本和经文范围的网页来源。
2. 将所需 verse 的正文填入唯一正式 scripture data，并检查 verse key 与范围完整。
3. 保存真实 `sourceUrl`、网站或发布者、页面标题、访问日期、范围和版本标示。
4. 分开记录 `sourceStatus`、逐字 `verificationStatus` 与分发 `rightsEvidenceStatus`。
5. 若来源冲突或缺节，交叉核对并记录采用理由；不得凭记忆补写。

本地没有经文副本或公开分发 evidence 不足，都不能成为留下空 `exactText`、`TODO` 或
placeholder 的理由。若来源冲突，按 registry 中的来源优先级、完整度和交叉一致性自动
选择并保存 diff；不得请求用户代为抄录或裁决。

经文正文缺失代表内容生产未完成，状态必须是 `in production`/`integration`，不能因为
已经部署私有预览或接入正式美术而写成 production complete 或完成。正文填入后自动执行
范围、hash、空值、UI 和双来源 diff 检查，再继续后续阶段。

## 6. 自动恢复与分发范围

### 6.1 自动恢复

任何失败先由流水线处理：

- Azure/MAI 失败：核对登录、资源、部署和配额，有限重试后使用 registry 中已声明的
  兼容生成 fallback，或使用满足同一验收契约的 story-local 正式资产。
- 来源失败：切换下一个可追溯来源并保留失败 URL 与差异证据。
- 候选失败：只修正已观察缺陷并生成新 prompt version，不回退到 placeholder。
- runtime/QA 失败：局部回滚到灰盒契约、修正、重接并重测。
- 权利 evidence 不足：保持内容完整，自动选择 `distributionScope: "private"`。

所有 fallback 必须写进 registry/manifest，不能静默降低经文忠实、正式美术、runtime
接线或 QA 标准。只有上述路径均有可复现失败证据时才可标记 `recovering-failed`；这不是
完成状态，也不能要求用户承担 reviewer、approver 或手工补齐职责。

### 6.2 分发 evidence

来源、模型、处理、hash、许可证/条款快照和使用范围由流水线自动收集到 provenance
manifest。它们决定分发范围，不决定产品是否继续完成：

- evidence 明确支持公开分发：`distributionScope: "public"`。
- evidence 不足或只支持私有使用：`distributionScope: "private"`，产出不可变、完整、
  可运行的 private release artifact，而不是临时 preview。
- candidate pack 不能直接进入 release 时，自动复制合规来源或重新生产 story-local
  正式资产并锁定 hash，不能停在 candidate。

为兼容旧 schema 而保留的 review/provenance/rights 字段也由 Copilot 自动完成；空值、
`pending-human`、`awaiting-approval` 或同类状态不得进入玩家内容或阻止正式美术、
runtime 接线、自动测试和 production-mode 实际游玩。

## 7. 阶段状态

故事只能使用以下阶段：

| 阶段 | 含义 | 可称完成 |
| --- | --- | --- |
| `internal-graybox` | 几何与状态内部验证 | 否 |
| `art-production` | MAI/共享正式素材生产与接入 | 否 |
| `integration` | 全故事、语音和平台整合 | 否 |
| `release-candidate` | 完整 QA 中 | 否 |
| `recovering` | 自动重试、fallback 或局部修复中 | 否 |
| `released` | 所有完成定义通过并产出固定 artifact | 是 |

阶段和 `distributionScope` 必须写进故事 manifest。private/public 都可使用 `released`；
差别只在可分发范围，不能以 private scope 降低产品完成定义。

`private-preview` 是访问范围，`art-integrated` 是资产接入描述，两者都不是
`productionStage`，也不能覆盖上表的完成定义。

## 8. 玩家版禁止残留

最终玩家版不得出现：

- 灰盒区域名称、英文 region ID 或碰撞边界。
- Beat ID、segment ID、source level 或内部 final-state 状态。
- “候选身分灰盒”“已套用确定最终状态”等开发文字。
- 只为 DEV/内部 QA 准备的英文说明、状态文字、审图结论或 metadata。
- placeholder 矩形、纯色区域、debug anchor 和审图标签。
- candidate 素材警告或内部授权 metadata。
- 空经文框、空 `exactText`、`TODO` 或“稍后补经文”等成功形状 fallback。

开发者可通过明确的 development-only flag 启用这些内容；production build 必须自动
排除，并由 bundle 扫描和玩家视角的 production-mode 完整游玩验证。内部 QA 页面或
DEV build 通过不能替代这项玩家版检查。

## 9. 玩家控制角色四向门槛

玩家控制的 RPG 角色只有同时满足以下条件才算正式美术已接入：

- 已验收 runtime asset 明确映射 `up`、`down`、`left`、`right`，每个方向至少有
  可用的 idle 与 movement 状态。
- 键盘、点击寻路和触控所产生的移动向量使用同一方向解析规则，并切换到对应正式状态。
- 停止移动后显示最后朝向的 idle；方向快速切换、对角输入和场景重进不退回 placeholder。
- 自动测试逐一触发四向移动并断言当前 runtime state/animation；浏览器 QA 确认实际像素
  不是候选 sheet、单向静态图或 debug fallback。

生成四向候选、把 sheet 放进目录、只声明 manifest mapping 或仅展示 contact sheet，
都不等于 runtime 已接入，也不能作为完成证据。

## 10. 执行者完成声明

执行者只能在满足 Foundation 完成定义并生成固定 release artifact 后说“完成”。否则
持续自动执行并使用：

- `in production`：仍在主动继续制作。
- `recovering`：正在重试、局部回滚或执行兼容 fallback。
- `recovering-failed`：所有自动恢复路径均有可复现失败证据；不是成功交付。

不得因测试通过、故事状态机完整或灰盒可走通，就提前结束端到端任务。
