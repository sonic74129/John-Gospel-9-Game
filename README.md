# 生來瞎眼的人

以約翰福音 9:1–41 為範圍，透過對話、調查、證詞對照與衝突呈現經文的獨立敘事遊戲。

- Story ID：`john-9-man-born-blind`
- 經文：繁體中文和合本
- 語言：`zh-Hant`
- Foundation：`ac54fcac41a7080dc032e0dc801c0d28bfa2edd6`
- 玩家：不介入經文事件的無名觀察者

## 美術製作

正式私有預覽使用 `storybook-realism-v1` 的故事本地地圖、人物、狀態姿勢、前景遮擋與
活動物件。Prompt registry 位於 `art/prompts/`；不可變候選、manifest、review 與選定
source 分別保存在 `production/art-pipeline/` 和 `production/art-source/`。只有
`public/assets/art/manifest.json` 記錄的處理後 PNG/WebP 會進入遊戲。

```bash
# 檢查計畫
npm run art:generate -- --family environment-outdoor \
  --asset environment.john9-world-base --dry-run

# start / resume / regenerate
npm run art:generate -- --family environment-outdoor \
  --asset environment.john9-world-base --mode start

# 人工審查後選圖
npm run art:generate -- --family environment-outdoor \
  --asset environment.john9-world-base --select 2 \
  --reason "Recorded measurable visual acceptance reason."

# 以 Lanczos 處理選定 source；不覆寫既有 runtime
npm run art:process
```

生成器只在本機透過 Azure CLI 取得記憶體中的 Entra token，絕不把 token、header、帳號或
tenant 寫入檔案。所有生成與 Foundation pack 目前仍為 private-preview candidate：
`releaseEligible=false`、`publicRedistributionApproved=false`。
