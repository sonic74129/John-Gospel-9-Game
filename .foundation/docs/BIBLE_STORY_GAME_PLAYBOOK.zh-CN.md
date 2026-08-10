# 圣经故事游戏制作规范

> 版本：1.0
>
> 定位：后续所有圣经故事游戏的产品、叙事、美术、技术、Azure AI 和验收总规则
>
> 当前参考作品：《伯大尼见证者》（约翰福音 11 章）

快速入口：

- 第 2–4 节：经文、玩法和地图规则。
- 第 5–6 节：共用素材库与统一美术。
- 第 7 节：MAI Image 与 Azure 帐号。
- 第 8–9 节：Azure Speech、语音和音乐。
- 第 10–12 节：独立游戏架构与未来统一入口。
- 第 13–15 节：制作流程、验收和实施顺序。

## 0. 一句话总规则

每个圣经故事都做成一个可以独立运行、测试、构建和发布的小型叙事 RPG；各游戏
只共用稳定的引擎、UI、风格规范、时代素材包和生产工具，故事经文、地图布局、
人物状态、演出、语音和存档彼此隔离，未来再由一个轻量总入口统一发现和启动。

### 0.1 最高产品/交付原则

Foundation 的最高 PRODUCT/DELIVERY 原则，是让 Copilot 快速迭代并自主端到端交付精美、
可玩、包含最终美术的正式游戏。经文、来源与权利、安全、质量、资产 hash 和仓库独立性
是 Copilot 自动执行的约束，不是默认转交给用户的阶段工作流；人工复核、等待确认、灰盒、
候选图和 placeholder 均不得成为默认停止点。确实缺少凭据或法定授权时，不伪造完成，
只阻塞受影响步骤并继续其余工作。

默认先形成完整资产 inventory，只建立让资产可用的最小地图、身份、比例、镜头和文字
contract，再完成并接入第一版正式资产，随后逐 Beat/Stage 用 development-only 入口或
fixture 验证玩法。每个资产第一轮恰好生成一个输出，自动检查、处理并接入；多个候选只
作为明确例外。

### 0.2 上下文预算与协调

- 连续性是事件驱动的：仅在 phase transition、heavy/binary/media boundary、重工作业后
  即将等待用户输入，以及 checkpoint/continuation 接管时记录；不得在每轮重复六字段，
  也不得依赖 token 70%/80% 阈值防止请求过大。
- 记录恰好包含 `objective`、`status`、`anchors`（repository/branch/commit）、
  `decisions`（confirmed/hypothesis）、`next_actions`（最多 3 项且含 validation）和
  `risks_blockers`。
- coordinator 绝不直接接收截图、binary 或 base64。媒体检查由范围有界的 child/session
  完成，只回传 durable path、SHA-256、status 和 findings，不回传媒体、完整 transcript、
  重复通知或大型 diff/log。非媒体代码 child 沿用 commit、files、validation、assets 和
  blockers 的精简 handoff。
- token utilization 与 serialized request payload bytes 是独立预算，必须分别在发送前
  控制。重工作业后若必须 `ask_user`，先保存 compact decision brief/checkpoint，再从 clean
  continuation 发问。
- request-size failure 后禁止在 poisoned session 重试；保留六字段、父子 session/任务关系、
  最后已完成边界、durable asset metadata 和 validation 状态，从 clean continuation 接管。
- 这些内容只写入既有 handoff/checkpoint，不新增 planning artifact、production stage、
  runtime manifest、readiness flag 或 alternate plan schema。所有 child/continuation
  继承完整约束和完成定义。

这套游戏不是传统打怪升级 RPG。核心体验是：

> 阅读或听见经文线索 -> 在地图中探索 -> 观察人物与物件 -> 互动或回想 ->
> 观看经文事件在地图内发生 -> 带着经文记忆进入下一段。

## 1. 已锁定的方向

### 1.1 必须保留

- 俯视三分之四视角，可上下左右移动，也可点击地面寻路。
- 户外优先是一张连续可探索的世界；室内只在空间确实需要时独立。
- 剧情发生在可玩地图中，通过人物走位、动作、物件、镜头和对话推进。
- 对话时地图仍可见；对话肖像是地图人物的细节近景，不是另一个演员。
- 玩家通常是无名见证者、报信者、同行者或有限参与者。
- 核心经文、经文支持的动作、游戏桥接内容必须在数据层清楚区分。
- 普通流程和跳过演出必须收敛到完全相同的故事最终状态。
- 每个故事有自己的代码入口、内容、地图、测试、构建产物和版本。
- 共用素材必须有稳定 ID、版本、来源、用途、授权和兼容范围。
- 用户要求制作游戏时默认端到端完成；灰盒只是内部校验，不得作为停止点或最终交付。
- 用户睡觉、外出或无法参与时，不建立固定 nightly schedule；用 checkpoint 继续所有
  不需要真正受限用户决定的工作，单个资产阻塞只阻塞该资产。

### 1.2 已否决，不得恢复

- 不做战斗、生命值、装备、金币、经验值、等级或技能树。
- 不做改变圣经结果的分支、多结局、失败结局或限时挑战。
- 不让玩家控制耶稣、替经文人物作关键决定，或让玩家“促成神迹”。
- 不用五张风格不同的大背景不断硬切，造成空间失忆。
- 不把剧情做成全屏静态插画、章节插画或电影式定格图。
- 不把人物、活动墓石、可互动物件、文字或 UI 烘焙进地图。
- 不用重复明显的地面格纹，也不把不同光线、透视的贴纸物件硬拼成世界。
- 不继续以像素风为强制规范。最终权威风格是高清手绘绘本写实感。
- 不让对话肖像变成与地图角色不同脸、不同服装、不同年龄的写实演员。
- 不要求先完成全故事灰盒才开始正式美术；只先锁定当前资产所需的最小可用 contract。
- 不把“生成成功”当成验收；默认单输出必须自动检查、处理并接入真实游戏。
- 不在一个巨大 Scene 文件中硬编码所有坐标、对白、剧情和资源路径。
- 不复制整个旧游戏来开始新故事，再各自修改一份共用逻辑。
- 不让不同故事直接读取彼此的内部状态或本地存档。
- 不把 Azure key、Entra token、帐号 email 或任何凭据写进仓库。

## 2. 经文忠实度规则

### 2.1 四层内容分类

每一条可见对白、叙述和动作都必须属于以下一层：

| 层级 | 含义 | 是否允许 |
| --- | --- | --- |
| S0 经文原文 | 指定译本逐字文本及出处 | 必须优先 |
| S1 经文明示 | 经文明确记载的动作、地点、先后与人物关系 | 允许 |
| S2 批准的游戏桥接 | 为移动、寻找、教学或空间连续性添加的最少内容 | 受限允许 |
| S3 戏剧化补写 | 改写动机、神学解释、额外神迹、虚构结果 | 禁止 |

S2 必须同时满足：

- 不改变事件原因、人物身份、先后顺序和结果。
- 不替经文人物说新的神学结论。
- 不让桥接人物自称经文没有说过的目击者。
- 可删除时不影响对经文的正确理解。
- 在内容数据中标记为 `approved-bridge`，不能伪装成经文。

### 2.2 玩家能做与不能做

玩家可以：

- 走近、观察、交谈、跟随、传达经文已经交托的口信。
- 选择经文顺序、人物或记忆锚点。
- 触发观看某个事件，但关键动作仍由经文人物或群体完成。

玩家不能：

- 改变耶稣的话、行动和时间。
- 代替马大、马利亚、门徒或其他人物完成其经文角色。
- 亲自执行会被理解为造成神迹的动作。
- 因答错而阻断故事、改变结局或被评价为“信心不足”。

### 2.3 经文数据唯一来源

每个故事只能有一个正式经文数据源，例如：

```text
games/john-11-bethany/src/story/scripture.ts
```

它至少包含：

- 稳定 verse key，例如 `john11:25`。
- 原文、出处、译本、语言和审核状态。
- 正式审核者与审核日期。
- 游戏中是否完整显示、分句显示或只显示出处。

正式聚会前必须由指定教会审核者逐字核对。代码、字幕、语音和测试都从这里派生，
不得各自复制一份人工维护的经文。

可见内容也必须保留来源标签，例如“经文原文”“经文叙述”“情境重现”“游戏提示”；
不得让玩家把桥接对白误认为圣经原文。

## 3. 每个故事的标准玩法结构

### 3.1 默认范围

- 单个游戏建议 8–15 分钟；过长故事拆成独立章节游戏。
- 默认 8–24 个 `StoryBeat`，以经文事件而不是画面数量切分。
- 每个 Beat 只表达一个清楚的经文记忆点或空间行动。
- 关键语音默认只做 2–4 段，不追求全章配音。

### 3.2 核心互动

- `移动`：键盘方向键/WASD；鼠标或触控点击寻路。
- 固定点点击只产生一次到该固定世界坐标的路径，不得持续追踪人物或移动目标；任何方向输入
  立即取消该路径并恢复直接控制。
- `互动`：Space、点击人物或统一互动按钮。
- Space 只触发当前近距离可互动对象，不启动远距离导航，也不把玩家拉向人物。
- `观察`：靠近人物或物件时显示一行中性观察文字。
- `回想`：在经文揭示前进行短选择，不做复杂谜题。
- `跟随`：角色先在地图行动，再把控制权交还玩家。
- `观看`：关键经文事件自动演出，可跳过但不能被玩家改写。

### 3.3 StoryBeat 最小契约

每个 Beat 必须定义：

```ts
interface StoryBeat {
  id: string;
  order: number;
  verseKeys: readonly string[];
  sourceLevel: "scripture" | "approved-bridge";
  prerequisite: "story-start" | { beatCompleted: string };
  trigger: ProximityTrigger | InteractionTrigger | ArrivalTrigger |
    RecallTrigger | AutomaticTrigger;
  supportedActions: readonly SupportedAction[];
  recallBeforeReveal?: RecallQuestion;
  sequence?: MapSequenceDefinition;
  stageGoal: StageGoal;
  duringState?: StoryStateSnapshot;
  finalState: StoryStateSnapshot;
  spatialTransition?: SpatialTransitionContract;
  orderedChoreography?: OrderedChoreographyContract;
  handoff: "manual" | "automatic" | null;
  voiceCueIds?: readonly string[];
}
```

硬性要求：

- Beat 顺序、前置条件和 verse keys 可由测试完整枚举。
- 所有自动演出可取消、可跳过、不可重入。
- `completed` 与 `skipped` 都调用同一份 `finalState`。
- `finalState` 必须写明人物可见性、位置/姿态、标签、碰撞、镜头、物件和控制权。
- 不依赖“动画刚好跑完后的现场状态”作为真相。
- 每个空间过渡必须以 `player-seeks`、`npc-arrives`、`npc-leads-player` 或经审核的
  `time-cut` 声明 transition mode，并逐 Beat 记录 player control、actor path、entry/exit
  与 final convergence。
- 多角色移动或入场必须声明 `participants`、`orderedSteps`、`entrySource`、`path`、
  `endAnchor` 与 `finalConvergence`；每一步引用的 sequence/path 必须可反向定位该 Beat。
- 玩家位置只能由该时刻的玩家输入推进；剧情 sequence 不得把玩家无来源地传送到下一目标。

`orderedChoreography` 与 group 成员独立性是 late implementation contract：实现推进到该
Beat 时在既有 Story Plan/manifest 中补齐，不是开始编码前的 Planning acceptance；但在该
Beat 进入 runtime integration 时缺失必须 fail closed。

### 3.4 提示与计分

- 右上角最多一行短目标，使用“查看四周”“继续前行”“留心聆听”等动作词。
- 提示不得泄露人物身份、正确答案、精确路线或尚未揭示的经文。
- Blocking 对话或答题出现时隐藏或弱化目标。
- 若使用分数，只能称“经文观察”或类似名称。
- 普通探索、可选对话和找错人物不扣分。
- 明确经文题首次答错可有轻微扣分，但不得失败或卡关。
- 分数不是信仰、属灵程度或道德评价。

### 3.5 可选的经文记忆线索模式

需要玩家在地图中辨认人物或方向时，可以使用少量线索人物，但必须：

- 分散在不同可达区域，不围成一圈直接暴露答案。
- 每人旁边有可辨识的物件，例如饼、鱼、水器或泥碗。
- 接近时先显示一行中性观察文字，再由玩家决定是否互动。
- 最终可见标签不使用泛称“路人”；使用“拿着饼和鱼的人”等观察型描述，身份
  揭示后再替换为正式姓名。
- 只说 2–3 句忠于对应经文的自然短故事，并在结尾显示出处。
- 不自称经文没有说过的目击者，不增加人物心理或神学解释。
- 自由顺序、零扣分、不要求全部收集。
- 若承担路线提示，最后一句给出自然方向线索，不显示箭头或答案。
- 正确人物揭示后，临时线索、道具和匿名标签一起清理。

### 3.6 Scripture / Dialogue Presentation Contract

默认呈现模式是 `map-visible-bottom-overlay`。经文（scripture）、叙述（narration）和对白
（dialogue）必须先按用途分类，再选择文字、actor 与 portrait：

- `scripture` 显示指定译本的逐字文本与出处；不得改写为角色对白。
- `narration` 只描述经文明说的事件或已批准桥接；不得伪装成某角色说话。
- `dialogue` 只用于角色实际说出的内容，并绑定可见或已明确建立的 `speaker` actor。
- `scripture` / `narration` 使用人物图时必须绑定该段内容所指向的 `subject actor`；没有
  可合法绑定的 actor 时，使用不含 portrait 的底部面板，不得借用无关人物或匿名头像。

布局必须可测量：

- 地图可见区域指 viewport 中未被不透明剧情 UI 遮挡、仍显示 runtime 地图与 actor 的区域。
- 桌面 viewport 的地图可见区域不得低于 70%，底部 overlay 高度不得超过 30%。
- 移动端 viewport 的地图可见区域不得低于 50%；文字、出处、控件和安全区不得遮住关键 actor。
- 普通经文或对白禁止使用居中或全屏静态人物卡，禁止以普通剧情全屏静态插画代替地图演出。
- Blocking dialogue 可以锁定玩家移动和互动，但 runtime 地图、当前人物动作与合理环境运动
  仍须可见；不得把锁输入实现成冻结世界后切到静态卡。

Portrait 是独立资产角色，不是地图素材的另一种缩放方式：

- 必须是专用 `story portrait` runtime asset，采用胸口以上近景，并在 manifest 中声明
  portrait 用途。
- 必须引用与地图 actor 相同的 identity/version；脸、年龄、发型、肤色、服装、材质和
  光向保持一致。
- 禁止直接使用或放大 map sprite、atlas frame、低分辨率地图角色充当 portrait UI。
- Spoken dialogue 的 portrait 绑定 `speaker`；scripture/narration 的 portrait 绑定
  `subject actor`，不得仅因版面空缺而显示其他人物。

所有角色共用一份可测试的 portrait framing contract，不允许各组件自由微调：

```ts
interface PortraitFramingContract {
  baseline: { focusY: number; scale: number; offsetY: number };
  mobileBaseline: { focusY: number; scale: number; offsetY: number };
  profiles: Readonly<Record<PortraitProfileId, PortraitFramingProfile>>;
}

interface PortraitState {
  id: string;
  meaning: string;
  assetSource: string;
  identityVersion: string;
}
```

- `baseline` 与 `mobileBaseline` 是全角色统一的默认构图；profile 只能以稳定 ID 按成人、儿童、
  群体等角色类型处理可解释的身体比例差异，不得按单张图或单句对白临时命名。
- profile 必须保留统一的 head/chest crop、eye-line 与 subject scale 构图语义；不能把 profile
  机制变成每个角色各自随意缩放和偏移。
- 同一角色可以有平静、哀伤、激动等多个 `portraitState`，但每个扩展状态必须声明状态语义、
  asset source，并引用同一 identity/version；缺任一项时 fail closed，不显示未受管状态。
- 强剧情变化优先切换有来源的 `portraitState`；禁止用随机 `offsetY`、`scale` 或 focus 偏移
  制造差异，状态切换也不得造成构图语义漂移。
- runtime 只按 `viewport-specific baseline -> profile` 的合同解析，不得依赖散落在组件、
  Beat 或对白数据中的硬编码微调代替合同。
- 资产生产顺序固定为：先定义关键剧情状态矩阵（每角色建议 1–3 个有语义状态），再生成
  source/runtime 资产，再接线，最后完成 desktop/mobile browser QA 与 fail-closed 校验。

这些量化要求是 implementation/browser-QA acceptance，不是开始实现前的审批门。完成最小
Planning Gate 后立即构建 playable slice；Copilot 在受影响 Beat 进入 QA 与完成声明前自动
测量并闭环。若实现中确需布局或比例例外，在 canonical Story Plan 的既有 contract 中记录：

1. 受影响的 `Beat`。
2. 例外理由。
3. 审核人。
4. 替代地图连续性方案。
5. 可执行验证证据，包括目标 viewport、地图可见比例、overlay 比例、real-input browser QA
   与对应截图。

身份一致、专用 portrait asset role、禁止 map sprite/atlas frame/低分辨率地图角色冒充
portrait，以及禁止普通剧情全屏静态插画，均不可豁免。例外复核由既有 designated reviewer
完成；不得建立新的用户逐项审批队列，详细证据也不得阻塞开始实现。

## 4. 地图与空间规则

### 4.1 推荐世界模型

每个故事使用：

```text
一套世界坐标
  + 地面/道路
  + 固定建筑与地形
  + 独立可互动或可移动物件
  + 人物
  + 前景遮挡
  + 碰撞、导航、触发和镜头数据
```

户外优先连续；同一地点内不要为了剧情段落反复切换独立背景。室内可作为独立
空间，但进出必须从实际门口发生，并使用淡出/淡入保持方位连续。

### 4.2 哪些画进大地图，哪些必须独立

可画进故事地图：

- 不会移动的道路、地表、山坡、远景岩石。
- 固定房屋主体、井、低墙和不参与剧情的植被。
- 同一光线和比例下的静态环境细节。

必须独立：

- 人物和人物阴影。
- 门、圆石、船、箱子等会移动或改变状态的物件。
- 会被点击、拾取、打开、移除或替换的物件。
- 屋顶、树冠、洞口前缘等需要遮挡人物的前景层。
- 文字、路标标签、UI 和任务指示。
- 神迹或关键事件所需的状态变化。

### 4.3 每张地图的数据契约

不得只交付一张 PNG。地图包至少包含：

```text
map image/source
map layout JSON
regions
walkable bounds
collision polygons
navigation grid
actor spawns
actor directional manifests
interaction anchors
sequence paths
ordered choreography steps
camera zones
foreground occluders
movable prop anchors
mobile/desktop safe framing
```

路线点与视觉锚点必须分开。例如“前往墓园的路线终点”不等于“洞口中心”。
所有关键动作都以实际图片像素校准的 anchor 为准，并保留 debug overlay。

### 4.4 最小契约后立即完成正式图

完整地图生产前只完成让该资产可用的最小校验：

1. 标出关键区域、路线、入口、互动点和镜头范围。
2. 用固定 identity/scale 的真实角色验证道路、门洞、姓名牌与群体站位。
3. 验证建筑、门、床、井、桌、树、墓穴与人物比例可信。
4. 定义 normal、skip、restart、re-entry 所需的 final state 和独立 fixture。
5. 锁定该资产的尺寸、光向、人物高度和必要地标坐标。

不得先要求全故事灰盒完成，也不得停在 contract、灰盒或 placeholder。最小契约可用后
立即继续第 7 节的稳定 prompt、单输出生成、自动视觉审查、runtime 处理与真实游戏接入。

layout contract、tests 和 development-only overlay 应保留为正式图回归基线。正式图造成
路线、比例、镜头、碰撞或遮挡回归时，只修正受影响契约或资产，升版并保留旧 hash，重跑
该 Beat/Stage QA；通过后自动继续，不推翻其他已关闭素材。

经文授权或人工审核待定时，继续所有不需要展示未授权逐字文本的地图、美术、人物、
动作、引擎和 QA 工作，并在现有 handoff 中列明发布 blocker，不能误判为生产停止或新增
状态字段。

### 4.5 地图演出连续性

- 每个空间过渡声明 `player-seeks`、`npc-arrives`、`npc-leads-player` 或经审核的
  `time-cut`；normal 地图叙事必须由玩家探索或可见 NPC choreography 连接阶段状态。
- 当前视野内禁止无来源 visibility pop-in；人物必须从既有位置、合理入口、画面外或真实
  actor path 进入，从门口、道路、洞口或画面边缘离开，不能从天空落下或凭空瞬移。
- 后续会移动的石头、门或物件从场景开始就存在；改变时保持视觉连续。
- 人物淡入必须发生在合理入口，并与碰撞、深度和镜头 anchor 一致。
- 时间跨越先让人物走向地图外或进入休息状态，再淡黑、显示时间文字并返回。
- 室内外转换从实际门口触发；未走到门口时不得自动换图。
- path 与 sequence 必须双向引用；禁止 orphan narrative path，也禁止没有既有位置、入口、
  画面外来源或路径依据的 visible toggle。
- 多角色移动或入场按 `orderedSteps` 执行；behavior evidence 必须逐步证明 participants、
  entry source、path、end anchor 的实际顺序，无 visibility pop-in，并连续收敛到
  `finalConvergence`。
- normal choreography 必须先完成声明路径或经审核的 time-cut，再到达权威 final state；
  只有 skip、restore、re-entry 可以直接收敛。normal 与这些恢复路径使用同一组最终坐标、
  可见性、碰撞、镜头和标签状态，但状态相同不能作为 normal 可见瞬移的许可。
- DEV Beat jump/checkpoint 可以恢复独立测试起点，但不得进入 production normal play、
  正式完成证据或 production bundle。

## 5. 共用地图与人物素材库

结论：可以共用，而且应该共用；但不能把所有东西塞进一个会不断变化的“大素材
资料夹”。使用三层资产模型。

### 5.1 三层资产

| 层级 | 内容 | 示例 |
| --- | --- | --- |
| 全局共用 | UI、输入图标、通用引擎特效、字体规范、基础音频控制 | 对话框、喇叭、暂停菜单 |
| 时代/地区包 | 同时代建筑、服装、道路、植物、器皿、匿名人物原型 | `nt-judea-first-century` |
| 故事专用 | 完整地图布局、特殊动作、关键物件、经文、Beat、语音 | 伯大尼墓穴、拉撒路状态 |

### 5.2 复用判断

| 资产 | 默认是否共用 | 规则 |
| --- | --- | --- |
| 引擎、UI、输入、寻路 | 是 | 只能放 `packages/` |
| 色板、材质、光线、镜头规范 | 是 | 由 style pack 版本控制 |
| 地面、墙、树、器皿、家具 | 是 | 按时代/地区分类 |
| 匿名村民基础角色 | 是 | 故事可覆盖服装、年龄与颜色 |
| 耶稣等重复人物基础身份 | 条件共用 | 同一视觉年代可共用 master/base；故事姿态和肖像另加 |
| 完整地图 | 通常否 | 同地点、同年代、同路线需求时才复用 |
| 地图布局与触发坐标 | 否 | 必须属于故事 |
| 特殊剧情姿态 | 通常否 | 只有动作和身份完全相同时才提升到共用包 |
| 对话肖像 | 条件共用 | 身份、服装、年龄、情绪和光向必须一致 |
| 经文语音 | 否 | 与具体译本、verse keys 和 text hash 绑定 |
| 音乐 | 条件共用 | 必须确认授权、主题和混音适合 |

### 5.3 人物连续性

每个重复人物建立一个 `CharacterIdentityMaster`：

- 稳定人物 ID。
- 年龄范围、脸型、肤色、头发、胡须。
- 服装层次、主色、材质、鞋、随身物件。
- 地图四方向基础形态。
- 可复用的普通动作。
- 禁止特征。
- 所属时代、地区与故事时间。

地图角色、特殊姿态和肖像都必须引用同一 identity version。若故事相隔多年、
地点或服装情境明显不同，应建立明确 variant，不能强行用同一张图。

Story group 映射多个 map spawn 时：

- 有独立剧情身份、独立移动或独立互动的成员必须拥有独立 actor/spawn ID、
  identity/version 和 runtime art/animation；禁止以 group-wide texture substitution
  覆盖全部成员。
- 只有 Story Plan 明示为纯匿名 crowd、且不承担个体识别或连续性的成员可以复用 archetype。
- 一旦成员被单独点名、移动、互动或跨 Beat 追踪，就必须从 crowd 提升为独立 actor。

### 5.4 资产目录与版本

建议：

```text
packages/
  asset-catalog/
  assets-core/
  assets-nt-judea-first-century/
  art-direction/

games/<story-id>/
  public/assets/local/
  art/prompts/
  production/art-source/
```

每个资产 manifest 至少包含：

```json
{
  "id": "character.nt.jesus.base",
  "version": "1.0.0",
  "styleVersion": "storybook-realism-v1",
  "eraPack": "nt-judea-first-century",
  "sourceType": "mai-generated",
  "sourcePath": "...",
  "runtimePath": "...",
  "license": "...",
  "identityVersion": "jesus-v1",
  "approvedFor": ["map", "portrait-reference"],
  "dimensions": { "width": 0, "height": 0 },
  "sha256": "..."
}
```

规则：

- 已发布版本不可原地覆盖；修改必须升版本。
- 游戏锁定明确版本，不引用 `latest`。
- 故事只能依赖共用包，不能依赖另一个故事目录。
- 故事中证明可复用的资产经过审查后再“提升”到共用包。

### 5.5 人物方向与 runtime mapping

每个会移动或改变面向的 actor manifest 必须声明：

- frame layout 与 up/down/left/right 的视觉语义。
- 实际需要的 idle/walk coverage、foot baseline 与每个 runtime frame key。
- mirror policy 只能是 `distinct-frame` 或 `horizontal-mirror`。
- 唯一的 `direction -> frame -> flipX` 映射。

水平镜像可以使用，但必须由 manifest 明示，并在实际 runtime 像素上验证左右朝向、服装、
道具和不对称特征仍正确。缺帧、未知方向、未声明镜像或同一方向存在多重映射时 fail closed，
不得静默退回默认帧。仅检查 key、source mapping 或最终坐标不算视觉 QA；逐 actor 的
up/down/left/right 证据必须记录 actor/spawn ID、运动向量、frame key、flipX 与截图。

## 6. 统一美术风格

最终权威风格：

> 温暖、轻度卡通化的手绘绘本写实感；人物友善清楚但不是 Q 版，材质可信，
> 情绪克制，适合查经、投影和游戏互动。

### 6.1 地图

- 固定三分之四俯视 RPG 镜头。
- 高清手绘、线性过滤，不强制像素化，不使用 `image-rendering: pixelated`。
- 路线、人物、互动区和前景遮挡优先于装饰细节。
- 光线自然，阴影方向统一，禁止贴纸拼接感。

### 6.2 对话肖像

- 必须是专用 story portrait runtime asset 的胸口以上近景，可比地图更细致，但仍属于
  同一游戏世界。
- 脸、年龄、发型、肤色、服装层次、颜色、材质和光向必须匹配地图角色。
- 必须引用地图角色同一 identity/version；不得直接使用或放大 map sprite、atlas frame
  或低分辨率地图角色充当 portrait UI。
- 全角色使用统一 portrait framing baseline；desktop 与 mobile 都必须定义 `focusY`、
  `scale`、`offsetY`，角色类型差异只能通过稳定 profile ID 解析。
- 同一角色的多个状态保持 identity continuity 与相同构图语义；状态必须有 meaning 和
  asset source，不得用随机偏移或散落硬编码伪造状态变化。
- 半身肖像只用于可合法绑定 actor 的对话/叙事语境；actorless scripture/narration 使用
  portraitless 底部面板，不为填空补人物卡。
- 先定义关键剧情状态矩阵（每角色建议 1–3 个 `portraitState`），再生成资产；状态变化用于
  表达 questioning、agitated、seeking 等强剧情变化，不靠 framing 微调假装差异。
- 生产顺序是状态矩阵 -> source/runtime 资产 -> runtime 接线 -> browser QA/fail-closed 校验。
- 表情清楚但克制，不使用戏剧化哭喊或电影海报构图。
- 背景简单，无边框、文字、图标和水印。

### 6.3 通用色板

- 暖石灰岩 `#D2B887`
- 陶土 `#A85F3E`
- 灰橄榄 `#66704B`
- 柔和蓝 `#526C73`
- 深梅色 `#5A3D4B`
- 沙色 `#C5A16E`
- 天然亚麻 `#E2D2B2`
- 暖深阴影 `#3C352F`

### 6.4 禁止内容

- 现代物件、现代墓园设施或不合年代建筑。
- 光环、魔法光束、神迹发光、奇幻粒子。
- 恐怖、腐败、尸体伤害、骨头、血腥。
- 欧洲化固定脸谱、王室服装、英雄盔甲。
- 夸张舞台姿态、满屏特效、嵌入文字或 UI。

## 7. MAI Image 标准运行手册

### 7.1 当前锁定的 Azure 环境

以下配置已于 2026-08-02 通过 Azure CLI 核对；以后执行前仍必须重新验证资源和部署
状态，不假设 Preview 服务永久不变。

| 项目 | 值 |
| --- | --- |
| Azure 订阅名称 | `MCAPS-Hybrid-REQ-132159-2025-sonicchung` |
| Subscription ID | `550d1332-62fa-4132-8473-b6af0bc88dfd` |
| Resource group | `rg-sonicchung-7894_ai` |
| Azure AI resource | `ai-johnrpg-sonic-74129` |
| Kind / SKU / Region | `AIServices` / `S0` / `eastus` |
| Custom endpoint | `https://ai-johnrpg-sonic-74129.cognitiveservices.azure.com/` |
| MAI deployment | `mai-image-2-5-pro` |
| Model | `MAI-Image-2.5-Pro@2026-06-19` |
| Deployment SKU | `GlobalStandard`, capacity `1` |
| Authentication | Azure CLI + Entra ID |
| Local key authentication | 已关闭，`disableLocalAuth=true` |

“使用哪个帐号”的执行规则：

- 使用当前能访问上述订阅的组织 Azure 帐号登录 Azure CLI。
- 帐号 email 与 tenant ID 不写进仓库；本机用
  `az account show --query user.name -o tsv` 核对。
- 真正需要固定的是上表的订阅、资源组、资源和部署。
- 不得改用同一帐号下其他 Speech、OpenAI 或 AI Services 资源。

### 7.2 登录与核对

```bash
az login
az account set --subscription "MCAPS-Hybrid-REQ-132159-2025-sonicchung"
az account show \
  --query '{name:name,id:id,state:state,isDefault:isDefault}' -o json

az cognitiveservices account show \
  --resource-group rg-sonicchung-7894_ai \
  --name ai-johnrpg-sonic-74129 \
  --query '{name:name,kind:kind,location:location,endpoint:properties.endpoint,disableLocalAuth:properties.disableLocalAuth}' \
  -o json

az cognitiveservices account deployment list \
  --resource-group rg-sonicchung-7894_ai \
  --name ai-johnrpg-sonic-74129 \
  --query '[].{deployment:name,model:properties.model.name,version:properties.model.version}' \
  -o json
```

期望看到：

- 订阅状态 `Enabled`。
- 资源位于 `eastus`。
- `disableLocalAuth` 为 `true`。
- 部署名称为 `mai-image-2-5-pro`，模型版本为 `2026-06-19`。

### 7.3 本地环境变量

只在当前 shell 或未提交的 `.env.local` 中设置：

```bash
export AZURE_SUBSCRIPTION_ID="550d1332-62fa-4132-8473-b6af0bc88dfd"
export AZURE_MAI_ENDPOINT="https://ai-johnrpg-sonic-74129.cognitiveservices.azure.com/"
export AZURE_MAI_DEPLOYMENT="mai-image-2-5-pro"
```

禁止：

- `az cognitiveservices account keys list`
- 将 access token、Authorization header 或 key 写入文件、日志、截图或 Git
- 在前端浏览器中直接调用 MAI
- 把生成端点当作游戏运行时依赖

游戏发布包只能包含已经审核和处理过的静态图片。

### 7.4 Prompt registry

Prompt 不散落在聊天或脚本中。统一存放：

```text
art/prompts/style.json
art/prompts/masters.json
art/prompts/environment-interior.json
art/prompts/environment-outdoor.json
art/prompts/characters-core.json
art/prompts/characters-supporting.json
art/prompts/portraits.json
```

每个条目必须有：

- 稳定 asset ID、family 和 runtime 用途。
- 锁定 provider/model、模型版本、seed、dimensions 和 prompt/output version。
- 第一轮输出数恰好为 `1`；多个候选必须记录明确例外原因。
- 完整可发送 prompt，而不是依赖聊天上下文。
- 身份、镜头、比例、色板、材质、光向。
- 必须出现与明确禁止内容。
- 可测量的机器与视觉 acceptance。
- 依赖的 style/identity/master/text 版本与 hash。
- 修订时的 `Revision target`、`Change only`、`Keep unchanged` 和可测量 `Acceptance`。

### 7.5 正确生成顺序

1. 完整资产 inventory：地图/环境、人物方向与姿态、肖像、道具、UI、语音、音频、SFX。
2. 只建立当前资产所需的最小 style/identity/scale/camera/text contract。
3. 完成并接入第一版正式地图/环境与核心人物 baseline。
4. 按 dependency 顺序关闭其余人物、姿态、肖像、道具和 UI。
5. 关闭语音、音频与 SFX 及其字幕/runtime fallback。
6. 逐 Beat/Stage 用独立 development-only fixture 验证实际资产。

纯 style reference 不能成为停止点；凡有 runtime 用途的输出必须继续处理并接入真实游戏。

### 7.6 生成、续跑与接线

以下命令沿用当前管线；未来应移到共用 `packages/art-pipeline`：

```bash
# 只检查稳定输入、模型、版本、单输出数与输出路径
npm run art:generate -- \
  --family master \
  --asset master.house-interior \
  --dry-run

# 第一次生成；已有 run 时必须失败，避免覆盖
npm run art:generate -- \
  --family master \
  --asset master.house-interior \
  --mode start

# 只根据 manifest 续跑未关闭资产；已关闭资产必须跳过
npm run art:generate -- \
  --family master \
  --asset master.house-interior \
  --mode resume

# 明确建立新 run，不覆盖旧 run
npm run art:generate -- \
  --family master \
  --asset master.house-interior \
  --mode regenerate
```

`start`、`resume` 和 `regenerate` 之后，执行者必须自动调用故事仓库现有的检查、处理、接线
与 fixture 验证命令；不得假设一个不存在的通用命令，也不得增加人工 select 步骤。

每次只运行一个 family。脚本通过 Azure CLI 取得
`https://cognitiveservices.azure.com/` 的 Entra token，并调用：

```text
POST <custom-endpoint>/mai/v1/images/generations
model = mai-image-2-5-pro
```

### 7.7 单输出自动验收门槛

- 每个资产第一轮恰好生成一个输出，并按 style、identity、比例、路线、文字禁区和 runtime
  acceptance 自动检查。
- 地图输出必须叠加真实角色验证比例、道路、门洞、姓名牌和群体站位；音频输出必须验证
  文本 hash、时长、格式、响度与 fallback。
- “没有报错”不等于通过；通过后必须立即处理 source、生成 runtime、接线并运行对应
  Beat/Stage fixture。
- 不得停在 contact sheet、候选选择、review 目录、selected source 或
  generated-but-unwired 文件。
- 多个候选只允许作为用户明确要求或单输出无法验证的例外，并记录原因；它们仍不得成为
  人工逐批 gate。
- 需要外部权利授权或指定审核者批准的输出可继续完成非公开集成与 QA，但不得因此自动
  提升为 stable 或公开发布。
- 输出失败时只为该资产建立新版本，保留旧 source/runtime/hash；`v2+` 必须写明
  `Revision target`、`Change only`、`Keep unchanged` 和可测量 `Acceptance`。

### 7.8 版本化输出

```text
production/art-pipeline/runs/<family>/<asset>/<promptVersion>/run-NNN/
production/art-pipeline/manifests/<family>/<asset>/<promptVersion>/
production/art-source/<family>/<asset>/<promptVersion>/
public/assets/art/<family>/<asset>/<promptVersion>/run-NNN/
```

- 原始生成 source 不直接打进发布包。
- 运行时只使用经过裁切、去背景、缩放和压缩的输出。
- 高清手绘默认使用 Lanczos；只有明确的像素资产才使用 nearest。
- 每个 runtime 输出记录源图、prompt/output version、run、处理参数、provenance 和 hash。
- manifest 记录 closed/remaining/blocker 所需事实，但不得成为新的 planning、readiness、
  approval 或 production-stage schema。

### 7.9 模型或资源不可用时

- 先检查订阅、RBAC、资源状态、部署和区域。
- 对限流使用有限重试与退避。
- Preview 或部署消失时停止该资产，不得静默换模型。
- 只有在更新 style bible、registry 和兼容版本并得到批准后，才可更换模型。

## 8. Azure Speech 与语音规范

### 8.1 当前资源

Speech 与 MAI 使用同一个项目资源：

| 项目 | 值 |
| --- | --- |
| Subscription | `MCAPS-Hybrid-REQ-132159-2025-sonicchung` |
| Resource group | `rg-sonicchung-7894_ai` |
| Resource | `ai-johnrpg-sonic-74129` |
| Region | `eastus` |
| Endpoint | `https://ai-johnrpg-sonic-74129.cognitiveservices.azure.com/` |
| Authentication | Entra ID only |
| Output | MP3, 24 kHz, 160 kbps, mono |

当前已验证声音：

| 用途 | Voice | 状态 | 规则 |
| --- | --- | --- | --- |
| 旁白 | `zh-CN-YunyangNeural` | GA | 默认旁白方向 |
| 耶稣 | `zh-CN-Bo:MAI-Voice-2` | Preview | 每次先查 voice list；不可用时不得伪装成功 |

`zh-CN-Mei:MAI-Voice-2`、`zh-CN-Lan:MAI-Voice-2` 等旧试听方向尚未成为
全项目正式默认声音。新角色必须先做少量 A/B 试听并批准。

### 8.2 语音范围

每个故事默认只做：

1. 开场经文或场景建立。
2. 全故事最重要的一段宣告。
3. 必要时再增加 1–2 段记忆价值明显的经文。

先完成、接入和验证少量关键语音，再决定是否扩充。不要一开始规划几十句和多版本，
导致经文、声音与游戏接入同时失控。

### 8.3 Entra 调用方法

不要把以下 token 输出到终端日志；执行前关闭 shell trace：

```bash
set +x

ACCESS_TOKEN="$(az account get-access-token \
  --subscription "550d1332-62fa-4132-8473-b6af0bc88dfd" \
  --resource "https://cognitiveservices.azure.com/" \
  --query accessToken -o tsv)"

RESOURCE_ID="$(az cognitiveservices account show \
  --resource-group rg-sonicchung-7894_ai \
  --name ai-johnrpg-sonic-74129 \
  --query id -o tsv)"

AUTH_TOKEN="aad#${RESOURCE_ID}#${ACCESS_TOKEN}"
```

先列出声音，确认 voice 名称和状态：

```bash
curl --fail-with-body --silent --show-error \
  "https://ai-johnrpg-sonic-74129.cognitiveservices.azure.com/tts/cognitiveservices/voices/list" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

合成：

```bash
curl --fail-with-body --silent --show-error \
  -X POST \
  "https://ai-johnrpg-sonic-74129.cognitiveservices.azure.com/tts/cognitiveservices/v1" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/ssml+xml" \
  -H "X-Microsoft-OutputFormat: audio-24khz-160kbitrate-mono-mp3" \
  --data-binary @cue.ssml \
  --output cue.raw.mp3

unset AUTH_TOKEN ACCESS_TOKEN RESOURCE_ID
```

### 8.4 SSML 规则

- 文本必须从正式 scripture data 自动取得，禁止凭记忆手打第二份。
- 允许 `mstts:express-as`、`styledegree`、`prosody rate` 和 `<break>`。
- 情绪克制，语速可稍快但不能损失经文清晰度。
- 已验证 MAI endpoint 对 `prosody volume="+2dB"` 等可能返回 400；音量统一放到
  后期或 runtime 处理。
- SSML 去掉标签与 `<break>` 后，文字必须逐字等于 `exactText`。
- Preview voice 的状态必须写进 metadata，不能标成 GA。

### 8.5 经文 hash

每个 cue 保存 verse keys，并按以下格式计算 SHA-256：

```ts
JSON.stringify([
  [verseKey1, verseText1],
  [verseKey2, verseText2]
])
```

运行时播放前重新从当前 scripture data 计算 hash：

- 相同：允许播放。
- 不同：视为 stale audio，不播放旧音频。
- 使用完整当前字幕继续游戏。
- 开发环境报告 expected/actual hash。
- 不得为了让测试通过而改 manifest hash。

### 8.6 音频后期与 metadata

正式 voice 目标：

- MP3 24 kHz / 160 kbps / mono。
- 只裁掉不合理的首尾静音，不剪掉自然停顿。
- 约 `-16 LUFS integrated`。
- `True Peak <= -1.5 dBTP`。
- 句级 cue 第一段从 0 开始，最后一段结束时间等于文件 duration。
- 记录文件 SHA-256、时长、采样率、声道、bitrate、LUFS 和 True Peak。

建议目录：

```text
production/audio-source/voice/<cue-id>.ssml
production/audio-source/voice/<cue-id>.source.json
public/assets/audio/voice/<cue-id>.mp3
```

### 8.7 Runtime 语音行为

- 开始按钮的用户手势负责解锁浏览器音频。
- 进入对应 Beat 时自动播放；喇叭按钮从头重播。
- 同时只能有一个 voice。
- 推进对白、skip、切 Beat、切场景、重开或离开时立即停止并归零。
- 暂停和页面不可见分别记录原因；所有原因解除后才恢复。
- 静音同时控制 music 与 voice。
- voice 播放时 BGM duck 到约 30%；结束或停止后恢复。
- 播放失败、404、解码失败或 hash 失效都不能阻断剧情。
- 字幕永远存在，语音是增强层，不是游戏推进条件。

### 8.8 当前已完成的正式参考

《伯大尼见证者》当前只发布两段正式语音：

| Cue | Voice | 时长 | Runtime 文件 |
| --- | --- | --- | --- |
| `opening-john11-1-3` | `zh-CN-YunyangNeural` GA | 18,447 ms | `public/assets/audio/voice/opening-john11-1-3.mp3` |
| `jesus-resurrection-life` | `zh-CN-Bo:MAI-Voice-2` Preview | 16,619 ms | `public/assets/audio/voice/jesus-resurrection-life.mp3` |

对应 SSML 与 source metadata 位于 `production/audio-source/voice/`。旧的马大、马利亚、
“耶稣哭了”“拉撒路出来”等 A 版试听没有发布，也不能直接提升为共用资产。

## 9. 音乐规范

每个故事统一使用四种音乐状态：

```ts
type MusicState = "exploration" | "dialogue" | "revelation" | "silence";
```

- `exploration`：可循环，保持空间和移动感。
- `dialogue`：可循环，更安静，给文字留空间。
- `revelation`：关键宣告、神迹后反思，通常不循环。
- `silence`：重要经文、哀伤或动作前主动留白。

运行规则：

- 状态切换使用交叉淡化。
- 语音播放时只调整 music gain，不修改源文件。
- 暂停、visibility、mute 和 restart 状态一致。
- 音乐授权必须记录；用户提供音乐不自动等于可在所有游戏公开复用。
- 共用音乐必须提升到有授权 metadata 的共享包，否则保留在故事本地。

当前伯大尼游戏可作为混音参考，但不是所有故事必须使用的固定曲目：

| 状态 | Runtime 文件 | 当前基础音量 | 循环 |
| --- | --- | --- | --- |
| exploration | `theme-1-morning-loop.mp3` | 0.34 | 是 |
| dialogue | `theme-2-between-lines-loop.mp3` | 0.24 | 是 |
| revelation | `theme-3-quiet-before-dawn.mp3` | 0.16 | 否 |

## 10. 推荐工程结构

每个故事使用独立 GitHub repository。只有共用 SDK 在自己的 repository 内部使用
npm workspaces 管理紧密相关 packages：

```text
<github-org>/
  bible-game-sdk
  bible-game-assets
  bible-story-template
  bible-story-john-11-bethany
  bible-story-<next-story>
  bible-games-hub
  bible-game-art-production    # 规模扩大后集中排队 MAI
```

### 10.1 共用 SDK repository

`bible-game-sdk` 内部建议：

```text
packages/
  engine/
  story-runtime/
  map-runtime/
  sequence-runtime/
  audio-runtime/
  ui/
  content-schema/
  asset-client/
  art-pipeline/
  test-kit/
  create-story/
```

适合进入 `packages/`：

- `StoryEngine`
- `MapSequence` 与 Phaser adapter
- `ActorRegistry`
- `PlayerController`
- `NavigationGrid`
- `Trigger` / `ProximityTrigger`
- `AreaRuntime`
- `AudioManager` / `VoiceManager`
- 对话、姓名牌、目标、暂停与响应式 UI
- 资产路径、hash、尺寸和状态契约测试

这些 packages 发布为固定版本的 `@bible-game/*` npm packages。故事 repo 只能依赖
正式版本，不能引用 SDK 的 `main` branch 或本机路径。

### 10.2 共用素材 repository

`bible-game-assets` 发布版本化 asset packs：

```text
packs/
  core-ui/
  nt-judea-first-century/
  ot-egypt/
  ot-canaan/
```

共享包只包含已批准 runtime assets、identity master、manifest、hash、授权和兼容
范围。完整故事地图、经文语音、坐标、Beat 和未批准候选不进入共享素材库。

故事以 `assets.lock.json` 锁定 pack 版本；构建时复制到自己的发布包，运行时不依赖
会变化的远端 `latest`。

### 10.3 必须留在具体故事 repository

每个 `bible-story-<id>` 必须拥有：

- `ScriptureContent`
- `VerseBeats`
- `StageGoals`
- `WorldLayout`
- 特殊探索内容
- 故事地图 anchors
- 人物在本故事的状态与特殊姿态
- Voice manifest 与正式语音
- 故事 Scene adapter 和完整流程测试

### 10.4 独立性规则

- 每个故事 repo 都有自己的 `package.json`、入口、测试、lockfile、release 和 `dist/`。
- 每个游戏在自己的 repo 中单独执行：

```bash
npm ci
npm run dev
npm test
npm run build
```

- 游戏只能 import 已发布的 `@bible-game/*` packages 与自己的目录。
- 共用包升级后，逐个游戏验证再更新版本。
- 一个故事出错时，不需要启动或修改其他故事。
- 每个游戏可以独立部署到 `/games/<story-id>/`。
- 不使用 Git submodule 作为默认共享方式。

详细拓扑、版本、CI、创建 repo 和迁移流程见
[多仓库与共用库架构建议](MULTI_REPO_ARCHITECTURE.zh-CN.md)。

## 11. 故事 manifest

每个游戏对外只暴露稳定 metadata：

```json
{
  "schemaVersion": "1.0.0",
  "id": "john-11-bethany",
  "version": "1.0.0",
  "templateVersion": "1.0.0",
  "title": "伯大尼见证者",
  "passage": {
    "book": "John",
    "chapter": 11,
    "verses": "1-46",
    "translation": "CUV-Simplified"
  },
  "engineApiVersion": 1,
  "sdkVersion": "1.2.1",
  "stylePack": "storybook-realism-v1",
  "assetPacks": {
    "core-ui": "1.0.0",
    "nt-judea-first-century": "1.1.0"
  },
  "entry": "/games/john-11-bethany/",
  "estimatedMinutes": 12,
  "languages": ["zh-CN"],
  "capabilities": {
    "keyboard": true,
    "pointer": true,
    "touch": true,
    "voice": true,
    "offlineAfterLoad": true
  },
  "artifactSha256": "<dist-sha256>"
}
```

Hub、部署工具和目录页只能依赖这个 manifest，不能 import 游戏内部 Beat、Scene 或
存档类型。Hub 只接收通过全部发布门禁的 immutable release；不得新增 `productionStage`、
readiness、approval 或 delivery-policy 字段来代替发布验证。

## 12. 未来统一界面

统一界面在第二个故事完成并证明共用接口后再实现，避免只根据一个游戏过早抽象。

Hub 负责：

- 按书卷、人物、主题或时长显示游戏。
- 显示封面、经文范围、预计时间、语言和完成状态。
- 启动、继续、重开或返回查经页面。
- 保存全局设置：语言、总音量、静音、字幕、全屏偏好。
- 记录每个故事的公开进度：未开始、进行中、完成、最后游玩时间。

Hub 不负责：

- 加载所有游戏代码到一个 bundle。
- 共享故事内部状态机。
- 直接修改某个游戏的 Beat、地图或人物。
- 把多个游戏合并成一个难以调试的 Scene。

推荐运行方式：

```text
/                         -> Hub
/games/john-11-bethany/   -> 独立静态应用
/games/<next-story>/      -> 独立静态应用
```

各故事 repo 独立发布 `dist.zip`、`game.manifest.json` 和 SHA-256。Hub 的部署流程只
下载已锁定 release、校验 hash，再解压到对应 `/games/<story-id>/`。这样最终同源，
但源码、测试、版本和回滚仍彼此独立。

游戏接受同源返回地址：

```text
?return=/%23john-games
```

存档和设置按命名空间隔离：

```text
bible-games:settings:v1
bible-games:progress:john-11-bethany:v1
bible-games:save:john-11-bethany:v1
```

## 13. 新故事标准执行顺序

以下是同一连续交付任务的执行顺序，不是 planning Gate、approval state、production stage
或新 schema。用户要求制作完整游戏时，Copilot 持续推进；用户睡觉、外出或离线时也使用
checkpoint/resume 继续所有不需要真正受限决定的工作，不创建固定 nightly schedule。
最小 Planning Gate 关闭后立即开始 playable slice；第 2 项起是实现中的自动闭环，不得变成
开始编码前必须验收的完整 inventory 或 choreography 文档。

1. 读取唯一 Story Plan，锁定经文范围、译本、玩家 witness 边界、事件顺序和发布 blocker。
   同时锁定 `map-visible-bottom-overlay` 与 actor/portrait 绑定。
2. 派生完整资产 inventory：地图/环境、人物方向与姿态、肖像、道具、UI、语音、音频、
   SFX，以及每项 prompt/source/runtime/provenance/version/SHA-256/manifest；方向 manifest
   必须关闭 frame layout、direction semantics、coverage、foot baseline、frame key 与 mirror
   policy；实现推进时补齐独立 group 成员和每个多角色 Beat 的 ordered choreography。
3. 选择可复用资产并记录 story-local 缺口；只建立第一批资产所需的最小
   map/identity/scale/camera/text contract。
4. 对每个资产恰好生成一个第一轮输出，自动验收、处理并接入真实游戏；失败只升版重做
   该资产，resume 跳过 closed 资产。
5. 完成第一个正式资产 baseline 后，为每个 Beat/Stage 建立 independent development-only
   entry/fixture，逐段验证 real input、四方向视觉证据、ordered choreography、
   normal/skip/restart/re-entry 和 final-state parity。
6. 扩展并接入全部 Beat、地图路径、人物动作、问答、语音/字幕、音乐、UI 和结尾；单项
   blocker 不阻塞其他独立项。
7. 玩法稳定后集中执行 code review/refactor；此前只立即修复安全、数据损坏和 runtime
   blocker，避免在正式玩法尚未稳定时反复大规模整理。
8. 最后润色非阻塞细节，再执行自动契约测试、normal/all-skip、desktop/mobile、音频、
   网络、console、资源、production-cleanliness 和离线构建 QA。
9. 所有发布门禁通过后独立 build/deploy 并更新 catalog；Hub 不改游戏内部代码。

经文、音乐或公开分发审批尚未完成时，必须继续所有不受限制的美术、runtime 集成和 QA，
并在现有 handoff 中如实列出发布 blocker，不新增状态字段，也不能称为“已发布”。

## 14. 每个游戏的完成定义

### 经文

- 正式文本、出处、译本和审核状态齐全。
- 所有 Beat 的经文支持动作可追溯。
- 游戏桥接内容有显式标记。
- 未出现改变经文结果的互动。

### 可玩性

- 从开始页不使用开发捷径可走到结尾。
- 键盘、鼠标/触控、互动、暂停、重开可用。
- 无当前输入时玩家不移动；固定点点击不会追踪人物，方向输入立即取消点击路径，Space 不会
  启动远距离导航。
- 不会卡在障碍、触发器或输入锁。
- normal 与 all-skip 最终状态一致，且 normal 先以可见 choreography 到达该状态，不发生
  可见 final-state delta。

### 地图

- 所有主要路线可达。
- 门、道路、人物、建筑和姓名牌比例可信。
- 可移动物件、碰撞、前景和视觉 anchor 一致。
- browser QA 证明 NPC 坐标连续；当前视野内不存在无来源 visibility pop-in、人物从天空
  落下、物件中途突然出现或标签脱离人物。
- 多角色 Beat 的 behavior evidence 证明 participants 按 ordered steps 从声明 entry source
  沿 path 到达 end anchor，并连续收敛到 final state。

### 美术

- 符合指定 style/identity/era 版本。
- 地图与肖像是同一人物。
- 每个会移动或转向的 actor 都有唯一 direction -> frame -> flipX 映射；缺帧、未知方向、
  未声明镜像与多重映射均 fail closed。
- 每个 actor 的 up/down/left/right 都有包含 actor/spawn ID、运动向量、frame key、flipX
  和截图的视觉证据；仅 key、source mapping 或 final coordinate 不算通过。
- 独立剧情成员有独立 actor/spawn、identity/version 与 runtime art/animation；不存在
  group-wide texture substitution，匿名 crowd 复用有 Story Plan 明示。
- 无文字、水印、现代物件、奇幻光效和恐怖内容。
- 所有资产有 source、manifest、版本与 runtime mapping。
- 玩家版使用批准的正式资产，不含灰盒色块、placeholder、debug overlay、region ID、
  Beat/segment ID、候选说明或内部 final-state 状态。

### 音频

- Start 解锁、自动播放、重播、single-active、mute、pause、stop 正常。
- 语音 hash 与当前经文一致。
- stale、404、解码或 autoplay 失败时字幕继续。
- 音乐 duck 后能正确恢复。

### UI 与响应式

- 至少验证 `1280x720` 与 `390x844`。
- 在 real-input browser QA 中测量桌面地图可见区域不低于 70%、overlay 不高于 30%，移动端
  地图可见区域不低于 50%；Blocking dialogue 期间地图和人物动作仍可见。
- 对话、肖像、目标、经文出处和按钮不互相遮挡。
- 目标不泄露身份或答案。
- Blocking UI 不允许背景点击误跳过多段。

### 工程

- 该游戏的 typecheck、测试和 build 独立通过。
- 发布包不依赖 MAI、Speech 或其他运行时云端调用。
- 无 token、key、个人帐号、未授权素材或生产候选进入发布包。
- Console、page error、unhandled rejection 与关键资源 404 为 0。
- DEV Beat jump/checkpoint 与 production normal play、正式完成证据和 production bundle
  完全隔离；不得以 DEV jump 作为唯一端到端证据。
- immutable release 与 artifact SHA-256 已生成，全部发布门禁通过；未通过时不得宣称完成，
  也不得新增 manifest stage 或 readiness flag 冒充发布验证。

## 15. 建议实施顺序

1. 先从完整 QA 基线逐项重放后期批准修复，得到真正稳定的《伯大尼见证者》版本。
2. 创建 `bible-game-sdk`，抽出已有测试保护的引擎、序列、导航、音频和 UI。
3. 创建 `bible-game-assets`，只提升已证明可复用的 runtime assets。
4. 将伯大尼迁移为独立 `bible-story-john-11-bethany` repo。
5. 建立 `bible-story-template`，只含最小地图、两名角色、三个 Beat 和测试。
6. 用第二个独立故事 repo 验证 SDK、模板与共用资产边界。
7. 第二个故事独立发布后，再制作 `bible-games-hub`。
8. 三个以上故事或并行美术生产时，再建立中央 MAI production queue。

最重要的判断是：**先独立、再共用；先证明复用、再提升到共用库；Hub 最后接入，
而不是一开始把所有故事绑成一个大游戏。**
