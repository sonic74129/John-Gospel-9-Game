# 端到端完成政策

## 0. 最高产品/交付原则

本政策的最高 PRODUCT/DELIVERY 原则，是让 Copilot 快速迭代并自主把游戏推进到精美、
可玩且包含最终美术的端到端正式状态。人工审核、等待确认、灰盒、候选图和 placeholder
不得成为默认停止点，也不得被包装成完成。

Copilot 默认主动执行经文一致性、来源与 hash、权利 metadata、素材治理、安全、视觉与
玩法 QA、资产检查和 runtime 接入。它们是自动执行约束，不是要求用户逐步推动的工作流；
但自动执行不等于自动授予法律权利，也不能伪造外部批准、凭据或审核结果。

本政策不得通过新增 planning artifact、readiness flag、approval state、production stage
或 schema 落地。它只改变既有交付执行方式；现有 Story Planning Gate 仍是唯一 planning
artifact。

### 0.1 有界上下文执行

自主端到端交付采用事件驱动连续性，不做每轮状态抄写，也不使用 token 70%/80% 阈值作为
发送安全保证。仅在以下事件写入或刷新连续性记录：

1. phase transition。
2. 进入或退出 heavy/binary/media boundary。
3. 重工作业后即将等待用户输入。
4. checkpoint/continuation 创建、恢复或接管。

记录只含六个状态字段：

1. `objective`：当前有界目标。
2. `status`：已完成、进行中和可验证状态。
3. `anchors`：repository、branch、commit。
4. `decisions`：每项明确标为 confirmed 或 hypothesis。
5. `next_actions`：最多 3 项，并包含下一项 validation。
6. `risks_blockers`：风险、阻塞与解除条件。

执行与隔离规则：

- coordinator 绝不直接接收截图、binary 或 base64；不得把附件加载到其对话后再继续协调。
- 媒体检查必须交给范围有界的 child/session。结果只返回 durable path、SHA-256、status 和
  findings；禁止返回媒体本体、完整 transcript、重复通知或大型 diff/log。
- token utilization 与 serialized request payload bytes 是独立预算。token 尚有余量不代表
  payload 可发送，compact 也不能移除已累积的二进制负担；必须在发送前隔离两者。
- 重工作业后需要用户决定时，先写 compact decision brief 和 checkpoint，再从 clean
  continuation 调用 `ask_user`。decision brief 使用上述六字段，不建立新计划或状态机。
- 一旦出现 request-size failure，禁止在 poisoned session 中重试。保存未提交工作为已复核
  checkpoint 或持久 patch，保留 continuation metadata，缩小批次后从 clean continuation
  恢复。
- checkpoint/continuation metadata 必须保留六字段、父子 session/任务关系、最后已完成边界、
  durable asset path/hash/status/findings 和 validation 状态，接管者先核对后继续。
- 用户说要睡觉、外出、离线或暂时无法参与时，不创建固定 nightly schedule；完成所有不需要
  真正受限用户决定的工作。长任务从 checkpoint 续跑并跳过已关闭资产。

以上记录只复用既有 handoff/checkpoint；不得新增 story planning artifact、production stage、
runtime manifest、readiness flag 或 alternate plan schema。compact、委派与续接也不是绕过
安全、经文、权利、质量或完成门禁的理由。

## 1. 默认解释

当用户说“制作一个游戏”“把故事做出来”“完成这个故事”或同等表达时，默认要求是：

```text
完整资产清单
-> 最小地图 / 身份 / 比例 / 镜头 / 文字契约
-> 第一版正式资产完成、处理并接入
-> 逐 Beat / Stage 独立玩法验证
-> 玩法稳定后的集中 code review / refactor
-> 最后细节润色
-> 完整 QA 与可明确判断的 release 结果
```

不能把其中任何中间阶段自动解释成用户交付。

## Story Planning machine policy

以下单行规则是
[`policy/story-planning-policy.v1.json`](../policy/story-planning-policy.v1.json)
供 `@sonic74129/story-planning` 0.4.2 读取的原文锚点。它们将现有 Foundation 约束压缩到
唯一的 Story Plan，不建立额外计划、人工审批工作流或生产阶段状态。

- `planning/story-plan.v1.json` 是唯一 Story Plan artifact；不得以 alternate readiness flag、runtime manifest 或 production stage 代替 Gate。
- `personal-lightweight` 的最低经文证据是一份稳定 source artifact，记录 provider、locator、exact bytes 与 SHA-256，并由一名 designated owner/reviewer 批准；edition identity 与 exact text availability 必须分开记录，默认 edition 为 `CUV-1919-Shen-Traditional` / `zh-Hant`，不得静默替换为现代 CUV/CUNP、RCUV、CCB、YouVersion/API 或 `cmn-cu89t` 文本。
- Public/commercial/disputed-risk profile 可以在与风险直接相关时升级证据；`high-assurance` 必须显式选择，不得成为 `personal-lightweight` 的实现前置条件。
- Scripture text authority、public redistribution rights、designated owner/reviewer approval 与 TTS/voice redistribution 是四个独立 blocker；rights、TTS 或 public-release 未清只能阻塞对应发布，不得阻塞合规的 private map、art、runtime 与 QA。
- 玩家保持 witness 角色，不得控制耶稣、促成神迹、替经文人物作关键决定或改变经文结果。
- Scripture、narration 与 dialogue 默认采用 `map-visible-bottom-overlay`；普通经文/对白禁止居中或全屏静态人物卡；portrait 必须与地图 actor 引用同一 identity/version，禁止以 map sprite、atlas frame 或低分辨率地图角色放大冒充 portrait；spoken dialogue 绑定 speaker，scripture/narration 使用人物图时绑定 subject actor，无合法 actor 时使用 portraitless 底部面板。
- Required goals 不得只依赖 tiny invisible point trigger；必须有可理解 guidance 或 interaction fallback，并用 keyboard、pointer/touch 的完整 real-input playthrough 验证 anti-stuck，地图必须包含有意义的二维探索而非 single-axis corridor。
- 每个空间过渡必须声明 `player-seeks`、`npc-arrives`、`npc-leads-player` 或经审核的 `time-cut`；玩家位置只能来自当前玩家输入：固定点点击只生成一次到固定位置的路径，方向输入立即取消该路径，Space 不启动远距离导航，也不得持续追踪人物。当前视野内禁止无来源 visibility pop-in；人物必须从既有位置、合理入口、画面外或真实路径进入。normal choreography 必须通过声明路径或经审核的 time-cut 到达权威 final state，只有 skip、restore 或 re-entry 可以直接收敛。DEV Beat jump/checkpoint 可以恢复测试起点，但必须与 production normal play、正式完成证据及 production bundle 隔离。
- 每个可跳过 sequence 的 normal、skip、restart 与 re-entry 必须应用完全相同的 explicit final state 和 parity hash；相同 final state 不表示 normal 可以可见瞬移，normal 必须先完成已声明 choreography，再由权威 final state 收敛。

上述 presentation machine rule 只在实现前锁定避免架构返工的最小结构默认。桌面/移动比例、
blocking 动画连续性、截图、例外 reviewer 与可执行证据属于 implementation、browser QA 和
completion 的自动闭环，不阻塞开始实现，也不建立用户审批队列。完成最小 Gate 后，Copilot
必须立即产出 playable slice，并在 QA 与完成声明前关闭这些详细要求。

## Implementation / QA / completion late contracts

以下六项不是 machine `policyRules`，不得成为开始编码前的 Planning acceptance。Copilot 在
playable slice 已开始后自动执行，并在对应 implementation、browser QA 或 completion 阶段
fail closed；它们复用唯一 Story Plan 与现有 manifest/handoff，不新增 lifecycle artifact：

- `portrait-framing-state-continuity`：implementation 建立 desktop/mobile baseline 与稳定 profile；同一角色的状态必须共享 identity/version，并以有来源状态表达 blind/washing/seeing 等强剧情变化，保持 head/chest crop、eye-line、subject scale 连续；禁止 map sprite 冒充 portrait、随机 framing 和散落硬编码，缺状态语义或 asset source 时 fail closed。
- `directional-runtime-mapping-consistency`：runtime 为每个会移动或转向的 actor 建立唯一 `direction -> frame -> flipX` 映射，声明 frame layout、方向语义、idle/walk coverage、foot baseline、frame key 和 mirror policy；缺帧、未知方向、未声明镜像或多重映射 fail closed。
- `multi-spawn-group-actor-independence`：implementation 为具有独立身份、移动或互动的 group 成员保留独立 actor/spawn、identity/version 与 runtime art/animation，禁止 group-wide texture substitution；只有明确的匿名 crowd 可复用 archetype。
- `ordered-beat-choreography`：implementation 为多角色移动/入场 Beat 建立 participants、ordered steps、entry source、path、end anchor 与 final convergence，并校验 sequence/path 双向引用；behavior evidence 必须证明顺序、无 pop-in、无可见 teleport 或 final-state snap。
- `four-direction-visual-qa-evidence`：browser QA 逐 actor 覆盖 up/down/left/right，记录 actor/spawn ID、运动向量、frame key、flipX 与截图；仅有 key、source mapping 或 final coordinate 不算视觉证据。
- `formal-assets-versioned-independence`：completion 前 formal map/character/audio assets 必须已在游戏内集成并以 real input 验证；所有依赖和素材保留 exact version、SHA-256 与 provenance，每个故事保持独立 repository，未关闭时不得声明完成。

## 2. 最小可用契约与独立玩法 fixture

正式资产生产前只建立让该资产可用且可验证的最小契约：

- 地图尺寸、关键路线、镜头与安全边界。
- 人物身份、方向、姿态、比例、foot anchor 与交互距离。
- 需要保持独立的前景、可移动物件、UI 和文字层。
- normal、skip、restart 与 re-entry 的 explicit final state。
- 桌面与窄屏的最小安全构图。

不得把“完成全故事灰盒”设为正式美术的串行前置门。内部灰盒、overlay 与测试 fixture
按 Beat/Stage 建立并保留在 development-only 路径，用来独立启动、重放和回归该段玩法；
production build 必须自动排除。立即安全、数据损坏或 runtime blocker 仍应当场修复。

除非用户明确要求 `graybox-only`，执行者不得在灰盒画面结束任务、把色块或 placeholder
称为完成，也不得把经文授权、人工审核或发布许可待定误当成停止其他制作的理由。

## 3. 单输出正式资产闭环与回滚

标准循环为：

```text
从完整 inventory 取下一个未关闭资产
-> 用稳定 prompt 输入恰好生成一个输出
-> 自动检查 acceptance
-> 处理 source 为 runtime output 并接入真实游戏
-> 用实际像素/音频重跑对应 Beat/Stage QA
-> 通过：继续下一资产或完整 QA
-> 失败：只升版并重新生成/处理该资产，保留旧版本与 hash
```

回滚规则：

- 第一轮默认且必须恰好生成一个输出；多个候选只在用户明确要求，或单输出无法完成明确
  验证时作为记录在案的例外。
- 自动检查后立即处理并接入，不停在 contact sheet、候选选择、selected source 或
  generated-but-unwired 文件。
- 保留已通过的契约、fixture、旧 source/runtime、版本和 SHA-256，确保可回滚。
- 不因一个正式资产失败而推翻已关闭且不受影响的角色、地图、UI 或音频素材。
- 先判断是 contract 问题、生成图问题还是 runtime 处理问题。
- contract 问题只修正受影响契约；生成问题只产生新 prompt/output version；处理问题只
  重跑处理。
- 回归通过后自动恢复正式图流程，不等待用户发出“继续”。
- Copilot 自动执行可由经文数据、既定 contract、metadata 和量化标准判断的复核。
- 只有法定授权、指定审核者批准或无法由现有约束判定的受限决定确实需要用户时才请求
  输入；等待期间继续所有不受影响的工作。

## 4. 稳定输入、离开期间生产与关闭条件

每个图片、UI、语音、音频或 SFX 资产都必须以稳定 asset ID 驱动，不依赖聊天上下文。
输入至少包含：

- asset ID、family、runtime purpose。
- provider/model、model version、seed、dimensions 与 prompt/output version。
- style/identity/master/text 等依赖的固定 version/hash。
- 完整 prompt 或 source text，以及可测量 acceptance。
- 修订时的 `Revision target`、`Change only`、`Keep unchanged` 与可测量 `Acceptance`。

用户离开或长任务续跑时，Copilot 应根据 inventory 和 manifest 准备所有可自动化缺口：

1. 地图与环境。
2. 人物 identity、方向、姿态和动作。
3. 肖像与道具。
4. UI。
5. 语音、音频与 SFX。
6. 每项的 prompt/source/runtime/provenance/version/SHA-256/manifest。

资产只有在 source、runtime、接线、provenance、version、SHA-256 和对应 acceptance/玩法
验证全部关闭后才算 closed。resume 必须跳过 closed 资产；单项 blocker 只标记并跳过该项，
继续所有独立项。已经关闭的资产不得因 session 续接或用户离开而重新生成。

如果已有 approved stable asset pack，可以复用，不必为了“使用 MAI”重复生成；但所有
story-local 缺口必须补齐，不能以灰盒替代。玩法稳定后集中 code review/refactor，最后
才做非阻塞细节润色。

## 5. 阻塞分类

### 5.1 生产硬阻塞

只有以下情形允许停止相关生产步骤：

- Azure/MAI 凭据确实不可访问。
- 指定 deployment 或模型不可用，核对与有限重试仍失败。
- 缺少用户才能提供的受限输入，且没有合规的非虚构替代。
- 继续操作会违反经文、隐私、安全或权利要求。

遇到硬阻塞时：

- 只阻塞直接受影响的步骤。
- 继续所有不依赖该阻塞的工作。
- 明确记录失败命令、资源、状态和恢复条件。
- 不用成功形状 fallback 冒充正式资产。
- 不把可自动执行的来源核对、经文比较、质量检查或素材接入误报为需要用户操作的阻塞。

### 5.2 发布阻塞

以下通常不阻塞继续制作：

- 经文逐字授权或教会审核待完成。
- candidate pack 尚未提升 stable。
- 音乐公开授权待确认。
- 发布审批或 Hub 登记待完成。

这些项目应在现有 handoff 中明确报告为发布 blocker。可以继续非公开开发、MAI 美术、
引擎接线和 QA，但不得公开发布受限制内容，也不得为 blocker 新增状态字段。

## 6. 进度报告不是新状态机

本政策不新增或要求 manifest stage、readiness flag、approval state、planning artifact 或
schema。执行者在现有任务 handoff/checkpoint 中如实说明剩余资产、validation 和 blocker
即可；这些描述不能成为串行人工门，也不能替代唯一 Story Planning Gate。

## 7. 玩家版禁止残留

最终玩家版不得出现：

- 灰盒区域名称、英文 region ID 或碰撞边界。
- Beat ID、segment ID、source level 或内部 final-state 状态。
- “候选身分灰盒”“已套用确定最终状态”等开发文字。
- placeholder 矩形、纯色区域、debug anchor 和审图标签。
- candidate 素材警告或内部授权 metadata。

开发者可通过明确的 development-only flag 启用这些内容；production build 必须自动
排除，并由 bundle 检查验证。

## 8. 执行者完成声明

执行者只能在满足 Foundation 完成定义后说“完成”。否则应在现有 handoff 中明确仍在生产、
外部发布受阻或存在已验证硬阻塞，并列出直接受影响项，不得为此创建新状态字段或 artifact。

不得因测试通过、故事状态机完整或灰盒可走通，就提前结束端到端任务。
