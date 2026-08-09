# World 内容

本目录只放当前故事地图契约。运行时直接使用完整的单张 2688×1792 横向背景，
不裁块、不拼接、不补纯色缺角；两个现有玩法区域继续紧凑承载约翰福音 9 章全故事走位：

- `courtyard`：背景图中央偏右的开放石板区；开场群像以 `courtyard.man-center`
  为视觉与视线汇聚点；同一片安全铺地随后复用于查问、父母进退、赶出、耶稣进入、
  相信与结尾，不另建空旷长廊。
- `siloam-pool`：由短而半径校验过的 `man-to-pool` 路线抵达；洗眼后在池北侧的
  `pool.neighbors` 紧凑集结。
- 后续演出只使用 `pool-to-neighbors`、`group-to-inquiry`、`parents-entry`、
  `parents-exit`、`expulsion`、`jesus-entry` 与 `ending` 短路径。所有点均位于当前
  可行走多边形内并避开水池、建筑、花木与墙体碰撞。
- 完整源图中的其余绘制区域会保留在背景中，但当前版本不额外开放新的玩法区域。

- layout
- anchors
- collisions
- navigation
- spawns
- occlusion
- map sequence final states

`framing.json` 同时锁定桌面 1280×720 与 390×844 的开场、洗眼安全取景。后续隐藏
角色沿用旧完整故事的 actor ID，等待故事层显式显示与调度。

完整故事地图和坐标不能提升为共享素材。
