# Bible Game Foundation 最高指引

## 1. 目的

本指引定义所有圣经故事独立游戏不能违背的共同边界。它负责统一经文忠实、玩家权限、
核心体验、美术语言、素材治理和仓库关系，但不把所有故事合并成一个游戏。

## 2. 不可放宽的原则

### 2.0 最高产品/交付原则

- Foundation 存在的最高产品与交付目标，是让 Copilot 快速迭代并自主交付精美、可玩、
  包含最终美术的端到端正式游戏。
- 默认执行者是 Copilot：从完整资产盘点、最小可用契约、第一版正式资产、runtime 接入、
  逐 Beat/Stage 玩法验证、语音/字幕到完整 QA，应连续推进，不把步骤改造成等待用户逐批
  操作的工作流。
- 人工复核、等待确认、灰盒、候选图和 placeholder 都不是默认停止点或成功形状。只有
  用户明确缩小范围，才能把阶段产物作为本次交付。
- 经文核对、来源与 hash、权利状态、素材治理、安全检查、质量门禁和资产接入是自动执行
  的约束。速度不能绕过这些约束，约束也不应被实现成不必要的人工阶段门。
- 每个资产第一轮恰好生成一个输出；Copilot 自动检查、处理并立即接入真实游戏。多个候选
  只用于用户明确要求或单输出无法验证的例外，不得把 contact sheet、选图或未接线文件
  当作进度终点。
- 用户睡觉、外出或暂时不可用时，不建立固定 nightly schedule；Copilot 通过 checkpoint
  继续所有不需要真正受限用户决定的工作。单个资产阻塞不得冻结其他资产或玩法工作。
- 若凭据、法定授权或只有用户才能作出的受限决定确实不可用，只阻塞直接受影响步骤；
  Copilot 继续所有不依赖该阻塞的工作，如实标记状态，不伪造批准、素材或完成声明。

#### 2.0.1 最高运行规则：上下文有界

- 连续性记录是事件驱动的，不是每轮报告。仅在 phase transition、heavy/binary/media
  boundary、重工作业后即将等待用户输入，以及 checkpoint/continuation 接管时写入；不得
  使用“每轮六字段”或 token 70%/80% 阈值规则增加上下文。
- 每次连续性记录恰好覆盖六个状态字段：`objective`；`status`；
  `anchors`（repository/branch/commit）；`decisions`（逐项标明 confirmed 或 hypothesis）；
  `next_actions`（最多 3 项且包含 validation）；`risks_blockers`。
- coordinator 绝不直接接收截图、binary 或 base64。媒体检查必须在范围有界的 child/session
  内完成，只返回 durable path、SHA-256、status 和 findings；不得回传完整 transcript、
  重复通知或大型 diff/log。
- token utilization 与 serialized request payload bytes 是两个独立预算；任一都可能先触顶，
  所以 token compact 不能替代发送前的 payload 隔离。
- 重工作业后若下一步需要 `ask_user`，先形成 compact decision brief，保存 checkpoint，再用
  clean continuation 发问；不得让累积了媒体或大输出的 coordinator 直接等待后恢复。
- request-size failure 发生后，不得在已污染 session 中重试。保存可持久恢复的 patch 和
  checkpoint/continuation metadata，缩小批次并从 clean continuation 恢复。
- checkpoint 与 continuation 必须保留恢复所需 metadata，包括六字段、父子 session/任务
  关系、最后已完成边界、durable asset path/hash/status/findings 和 validation 状态。
- compact、委派或续接不降低经文、玩家权限、安全、权利、质量、来源/hash、状态等价或
  仓库独立要求；以上记录只进入既有 handoff/checkpoint，不新增 planning artifact、
  production stage、runtime manifest、readiness flag 或 alternate plan schema。

### 2.1 经文优先

- 经文事实、事件顺序、人物行为和关键话语以指定译本及审核结果为准。
- 不把推测、传统补充、角色心理或神学解释写成经文明说的事实。
- 玩家不能改变经文结局、控制耶稣、促成神迹或替经文人物作关键决定。
- 经文语音必须由正式 scripture data 生成并以 text hash 绑定。

### 2.2 玩家是见证者

- 玩家可以移动、观察、寻找、交谈、传递已经交托的信息和见证事件。
- 玩家位置只能来自当前玩家输入；固定点点击只产生一次到该固定位置的路径，不持续追踪人物，
  方向输入立即取消该路径，Space 只作近距离互动，不启动远距离导航。
- 探索帮助玩家记住经文，而不是靠复杂谜题、失败惩罚或分支结局改变故事。
- 普通探索不扣分；分数若存在，只表示经文观察，不评价信仰或属灵程度。

### 2.3 地图内叙事

- 使用三分之四俯视、上下左右、鼠标及可选触控操作。
- 户外优先采用连续可探索地图。
- 关键剧情通过地图内人物走位、动作、物件、遮挡层和对话呈现。
- 不以大量全屏剧情插画代替可玩的场景。
- normal 地图叙事以玩家探索或可见 NPC choreography 连接阶段状态；每个空间过渡必须声明
  `player-seeks`、`npc-arrives`、`npc-leads-player` 或经审核的 `time-cut`。
- 当前视野内禁止无来源 visibility pop-in；人物从既有位置、合理入口、画面外或真实路径进入。
- normal choreography 必须先到达权威 final state；skip、restore、re-entry 可以直接收敛，
  但相同 final state 不等于 normal 可以可见瞬移。
- 会移动或改变面向的人物必须在 up/down/left/right 中显示正确视觉朝向；运行时方向映射、
  镜像策略和画面证据必须一致，缺帧或未知方向不得静默 fallback。
- 多角色移动或入场必须按声明顺序执行，人物来源、路径、终点与 final convergence 可追溯。

### 2.4 地图可见的经文与对白

- 经文、叙述和对白默认在持续可见的可玩地图上使用底部 overlay 呈现；人物动作与空间
  连续性是叙事本体，不得被普通居中人物卡或全屏静态插画替代。
- Blocking 对话可以暂时锁定玩家移动，但地图和人物动作仍须可见。
- 使用肖像时，必须采用与地图人物同一 identity/version 的专用 story portrait runtime
  asset；不得放大 map sprite、atlas frame 或低分辨率地图角色冒充肖像。
- 该合同在实现前只锁定避免架构返工的最小结构默认；Copilot 完成最小 Gate 后立即产出
  playable slice，并在 browser QA 与完成声明前自动闭环比例、动画连续性和验证证据。
  详细证据不得成为开始实现的阻塞或新的用户审批队列。

### 2.5 统一但克制的美术

- 温暖、克制、可爱但不幼稚的手绘绘本写实感。
- 人物身份、比例、衣着、材质、光向和镜头必须连续。
- 群组中的独立剧情成员必须保留自己的 actor/spawn、identity/version 与 runtime art；
  只有不承担个体连续性的纯匿名 crowd 才可明示复用 archetype。
- 禁止现代物件、魔法光束、光环、神迹发光、恐怖腐败和夸张舞台姿态。
- 神迹通过人物、环境、动作和经文本身呈现，不用奇幻特效替代。

### 2.6 独立故事、版本化共用

- 每个故事一个独立 repository，可独立运行、测试、构建、回退和发布。
- 共用 SDK、素材、模板和 Hub 分别管理，不依赖另一个故事的源码。
- 故事必须锁定 SDK version、asset pack version 和 SHA-256。
- 不使用未固定的 `latest`、`main` dependency 或 Git submodule 作为默认共享方式。

### 2.7 默认端到端完成

- 用户要求制作、完成或建立一个游戏时，默认范围是可玩的正式完成版，不是灰盒。
- 默认顺序是：完整资产清单 -> 最小地图/身份/比例/镜头/文字契约 -> 第一版正式资产完成
  并接入 -> 逐 Beat/Stage 独立验证 -> 稳定后集中 code review/refactor -> 最后细节润色。
- 内部灰盒、overlay 和 fixture 只按需支持局部验证，不要求先完成全故事灰盒才开始正式
  美术；每个 Beat/Stage 必须有 development-only 独立入口或 fixture，且玩家版自动排除。
- 地图/环境、人物方向与姿态、肖像、道具、UI、语音、音频和 SFX 的可自动化缺口都应在
  用户离开期间继续准备，并关闭 prompt、source、runtime、provenance、version、SHA-256
  和 manifest。
- 正式资产接入后若发现比例、路线、镜头、碰撞或遮挡回归，只回滚受影响契约或资产，
  修正并重跑 QA；失败资产升 prompt/output version，保留旧 hash，再自动恢复。
- 只有用户明确要求 `graybox-only`，才可把灰盒作为本次交付。
- 凭据、资源或模型确实不可用且经过核对与有限重试，才算生产硬阻塞；经文待审核、
  发布授权待确认或 candidate pack 不稳定通常只是发布阻塞，不得成为停止其他制作的
  理由。
- 未完成时必须在现有 handoff 中明确说明仍在生产或发布受阻；不得新增状态字段，也不得
  使用“完整故事”“production complete”或“最终版”等成功形状描述。

## 3. 共同层与故事层

### Foundation 负责

- 最高规则与冲突优先级。
- 共用美术方向和时代/地区素材治理。
- pack schema、来源、hash、权利状态和发布门槛。
- 多仓库边界和新故事创建规则。

### SDK 负责

- StoryEngine、地图、导航、序列、音频、UI、schema 和 test kit。
- 只发布稳定 contract，不包含任何具体故事的经文、Beat、地图或语音。
- test kit 必须提供每个 Beat/Stage 可独立启动、注入前置状态和验证 normal/skip/restart/
  re-entry 的 development-only entry/fixture，并由 production build 自动排除。
- SDK 不得为本交付顺序新增 planning artifact、readiness flag、approval state、
  production stage 或 schema。

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

1. 经文忠实、玩家权限、安全与信任、法律与权利等不可放宽约束定义可接受解法边界。
2. 在该边界内，2.0 是最高 PRODUCT/DELIVERY 优先级；同时尊重用户明确要求的较小范围。
3. 本指引优先于制作规范和架构细节。
4. 已完整 QA 的契约优先于旧 prototype、旧 plan 或单一 branch tip。
5. stable pack 优先于 candidate；固定 release 优先于 `main`。
6. 故事本地规则可以更严格，但不能弱化上层原则。

## 5. 完成定义

一个故事只有同时满足以下条件才算完成或可发布：

- 经文逐字和事件顺序审核完成。
- 正常、skip、restart、desktop、mobile 和完整 playthrough 通过。
- 地图可达、触发唯一、人物状态连续、碰撞与遮挡正确。
- MAI 或已批准共享素材形成正式地图、人物、动作和肖像；灰盒色块、开发标签、
  region/Beat ID、placeholder 和 debug overlay 不出现在玩家版。
- 语音 hash、字幕 fallback、音乐 ducking 和授权记录完整。
- 所有素材有来源、版本、hash 和使用范围。
- 没有 token、key、未批准候选或故事外依赖进入发布包。

详细停止条件与执行顺序见
[端到端完成政策](END_TO_END_DELIVERY.zh-CN.md)。
