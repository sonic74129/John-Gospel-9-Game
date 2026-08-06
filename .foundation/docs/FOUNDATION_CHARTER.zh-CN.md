# Bible Game Foundation 最高指引

## 1. 目的

本指引定义所有圣经故事独立游戏不能违背的共同边界。它负责统一经文忠实、玩家权限、
核心体验、美术语言、素材治理和仓库关系，但不把所有故事合并成一个游戏。它的最高目的
是让 Copilot 快速迭代并自动交付完整可玩的正式产品，而不是增加人工流程。

## 2. 不可放宽的原则

### 2.0 自动完成优先

- 用户提出制作故事游戏后，Copilot 默认拥有从来源查找、内容录入、设计、生成、选图、
  处理、runtime 接线、测试、修复到 release artifact 的连续执行责任。
- Foundation 的每条治理规则都必须落成自动检查、可追溯 evidence 或确定性 fallback；
  不得要求用户担任 reviewer、approver、放行人或等待中的下一棒。
- 无需用户 review、approval、confirmation 或 wait/等待。任何下层规范、模板、本地规则、
  CODEOWNERS、metadata 或旧流程若暗示人工 gate，本节优先，该 gate 无效，Copilot 继续。
- 保留的 `review*`、provenance、rights 或 verification 字段全部由 Copilot 从可追溯
  evidence 自动填写和更新，不代表待用户处理的状态。
- 灰盒、candidate、contact sheet、DEV build、`private-preview`、`art-integrated`、
  provenance 状态和生成但未接线的文件都只是中间状态，流水线必须自动越过并继续。
- 来源或公开分发证据不足时，如实限制 `distributionScope`，但仍完成经文、正式美术、
  runtime、QA 和不可变 release；治理 metadata 不能变成空内容或停止生产的借口。
- 失败步骤自动执行有限重试、局部回滚和已声明兼容 fallback。只有所有自动恢复路径均有
  可复现失败证据时才可报告失败；失败不能伪装成完成，也不能要求用户替流水线收尾。
- Copilot 必须继续经过正式美术选定与处理、runtime 实际接线、自动测试和 production-mode
  实际游玩验证，直到完整可玩 release artifact 生成。

### 2.1 经文优先

- 经文事实、事件顺序、人物行为和关键话语以指定译本及自动核验证据为准。
- 用户明确指定和合本（CUV）并要求在线查找时，执行者必须主动从可追溯网页来源取得
  所需段落、交叉核对 verse 范围并填入正式 scripture data，不得留下空字符串、`TODO`
  或 placeholder。
- 在线取得的经文必须记录真实 URL、网站或发布者、页面标题、访问日期、经文范围及页面
  所标译本/简繁版本；来源引用、自动逐字核验和分发 evidence 分别记录，不把“网上可读”
  写成已获再分发许可，也不因此等待用户处理。
- 不把推测、传统补充、角色心理或神学解释写成经文明说的事实。
- 玩家不能改变经文结局、控制耶稣、促成神迹或替经文人物作关键决定。
- 经文语音必须由正式 scripture data 生成并以 text hash 绑定。

### 2.2 玩家是见证者

- 玩家可以移动、观察、寻找、交谈、传递已经交托的信息和见证事件。
- 探索帮助玩家记住经文，而不是靠复杂谜题、失败惩罚或分支结局改变故事。
- 普通探索不扣分；分数若存在，只表示经文观察，不评价信仰或属灵程度。

### 2.3 地图内叙事

- 使用三分之四俯视、上下左右、鼠标及可选触控操作。
- 户外优先采用连续可探索地图。
- 关键剧情通过地图内人物走位、动作、物件、遮挡层和对话呈现。
- 不以大量全屏剧情插画代替可玩的场景。
- 玩家控制角色的正式地图美术必须提供并在 runtime 显式接入上、下、左、右
  （`up`、`down`、`left`、`right`）四个方向；移动输入必须切换对应状态，停止后
  保留最后朝向，不能用候选图或单一静态图冒充完成。
- 正常演出与 skip 必须应用完全相同的 final state。

### 2.4 统一但克制的美术

- 温暖、克制、可爱但不幼稚的手绘绘本写实感。
- 人物身份、比例、衣着、材质、光向和镜头必须连续。
- 禁止现代物件、魔法光束、光环、神迹发光、恐怖腐败和夸张舞台姿态。
- 神迹通过人物、环境、动作和经文本身呈现，不用奇幻特效替代。

### 2.5 独立故事、版本化共用

- 每个故事一个独立 repository，可独立运行、测试、构建、回退和发布。
- 共用 SDK、素材、模板和 Hub 分别管理，不依赖另一个故事的源码。
- 故事必须锁定 SDK version、asset pack version 和 SHA-256。
- 不使用未固定的 `latest`、`main` dependency 或 Git submodule 作为默认共享方式。

### 2.6 默认端到端完成

- 用户要求制作、完成或建立一个游戏时，默认范围是可玩的正式完成版，不是灰盒。
- 灰盒是必须完成并保留的内部 QA 基线，但不是里程碑交付物或停止点。
- 灰盒的几何、镜头、比例和路线通过后，必须在同一工作流继续 MAI 正式美术、处理、
  runtime 接入、关键语音/字幕和完整 QA。
- 正式图接入后若发现比例、路线、镜头、碰撞或遮挡回归，回滚受影响部分到已保留的
  灰盒契约，修正并重跑 QA，再只重新生成或处理受影响素材，然后继续向完成推进。
- 灰盒绝不是产品交付；流水线不得把任何阶段性请求解释成停止端到端工作的许可。
- 凭据、资源或模型不可用时，自动核对、有限重试并按 registry 使用兼容 fallback；
  candidate pack 不稳定时自动生成或处理 story-local 正式资产。
- 未完成时必须明确写 `in production` 或 `recovering`；不得使用“完整故事”、
  “production complete”“最终版”或治理等待状态等停止形状描述。
- DEV 英文、debug 标签与内部 QA metadata 只证明工程状态，不等于玩家看见了已本地化的
  正式内容；`private-preview` 和 `art-integrated` 也不是完成状态。经文正文仍为空时，
  无论美术是否接入或预览是否可访问，都必须保持 `in production`。

## 3. 共同层与故事层

### Foundation 负责

- 最高规则与冲突优先级。
- 共用美术方向和时代/地区素材治理。
- pack schema、来源、hash、分发 evidence 和自动发布门禁。
- 多仓库边界和新故事创建规则。

### SDK 负责

- StoryEngine、地图、导航、序列、音频、UI、schema 和 test kit。
- 只发布稳定 contract，不包含任何具体故事的经文、Beat、地图或语音。

### Story repository 负责

- 指定经文、Beat、StageGoal、人物状态、地图坐标和完整流程。
- 故事专用人物、肖像、特殊动作、语音和结尾。
- 自己的 lockfile、CI、release、存档和回归测试。

### Hub 负责

- 发现、启动、继续和显示公开进度。
- 只读取稳定 manifest 和 release artifact。
- 不读取或修改故事内部状态机。

## 4. 变更优先级

发生冲突时：

1. 经文和用户明确目标优先。
2. 第 2.0 节“自动完成优先”高于所有下层 workflow gate。
3. 本指引优先于制作规范和架构细节。
4. 已完整 QA 的契约优先于旧 prototype、旧 plan 或单一 branch tip。
5. stable pack 优先于 candidate；固定 release 优先于 `main`。
6. 故事本地规则可以更严格，但不能弱化上层原则或增加人工等待。

## 5. 完成定义

一个故事只有同时满足以下条件才算完成或可发布：

- 指定经文正文非空，带可追溯来源记录，自动逐字比对、范围和事件顺序核验完成。
- 正常、skip、restart、desktop、mobile 和完整 playthrough 通过。
- 地图可达、触发唯一、人物状态连续、碰撞与遮挡正确。
- 玩家控制角色使用自动验收通过的正式 runtime 美术；上、下、左、右四向状态均可由
  移动触发，且方向切换与停止朝向测试通过。
- MAI 或 validated 共享素材形成正式地图、人物、动作和肖像；灰盒色块、开发标签、
  region/Beat ID、placeholder 和 debug overlay 不出现在玩家版。
- production build 的玩家可见文字为目标语言正式内容；DEV 英文和内部 QA metadata
  不得作为完成证据。
- 语音 hash、字幕 fallback、音乐 ducking 和分发 evidence 完整且 scope 如实。
- 所有素材有来源、版本、hash 和使用范围。
- 没有 token、key、未验收候选或故事外依赖进入发布包。

详细执行状态与自动恢复见
[端到端完成政策](END_TO_END_DELIVERY.zh-CN.md)。
