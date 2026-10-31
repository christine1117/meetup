# Half Sugar 專案架構

一個專案、一起部署（Modular Monolith）。裡面分成三個模組，每個模組有清楚的邊界。
網站目前只有一個入口：組隊（Teams）。原本的 Half Sugar 聊天 app 已經拿掉，需要時可以從 git 紀錄找回。

| 模組 | 資料夾 | 負責什麼 |
|---|---|---|
| Teams | `src/teams/` | 比賽組隊：選比賽、參賽卡、推薦、聊到半糖、組隊 |
| Competitions | `crawler/`（Python）+ `data/` + `supabase/` | 每天抓真實比賽，用 LLM 讀懂組隊人數，存檔／存進資料庫 |
| Shared（共用核心） | `src/shared/` | 兩個 app 都用的東西：杯子圖、糖度規則、個人資料、資料格式約定 |

## 資料夾

```
meetup/
├─ index.html                 網站入口（Teams）
├─ teams/index.html           舊網址 /teams/ 自動轉到首頁
├─ src/
│  ├─ shared/                 共用核心，不認識任何一個 app
│  │  ├─ core.js              小工具：$、uid、esc、safeUrl
│  │  ├─ i18n.js              介面文字（英文／中文）
│  │  ├─ flavors.js           領域 = 口味、Logo
│  │  ├─ cup.js               畫杯子和配料（只產生 SVG 文字）
│  │  ├─ sugar.js             糖度和「放涼」規則（純函式）
│  │  ├─ forms.js             表單欄位
│  │  ├─ profile.js           個人資料（存在瀏覽器的那份）、Curious about 的選項
│  │  ├─ account.js           註冊、登入（email、Google、Apple、LinkedIn）、個人資料存進資料庫
│  │  ├─ supabase.js          連到資料庫
│  │  ├─ locales/zh.js        中文翻譯（每天自動補上新的）
│  │  ├─ contract.js          比賽資料的格式約定
│  │  ├─ log.js               錯誤紀錄
│  │  └─ styles/base.css
│  └─ teams/
│     ├─ main.js              入口：事件和啟動
│     ├─ competitions.js      讀比賽資料（資料存取層）
│     ├─ matching.js          配對演算法（純函式，有測試）
│     ├─ rules.js             組隊規則：人數上限、誰要同意、推薦分數
│     ├─ chats.js             聊天、組隊、禮貌結束
│     ├─ state.js             存檔資料
│     ├─ sample-people.js     範例使用者（有後端後移除）
│     ├─ options.js           參賽卡選項：職位、目標、時數、主題
│     ├─ views/*.js           畫面（只產生 HTML）
│     ├─ render.js            版面和 render()
│     ├─ forms.js / actions.js / router.js / ui.js
│     └─ teams.css
├─ crawler/                   Python 爬蟲（npm run crawl）
│  ├─ run.py                  總指揮：串起下面五步，印出紀錄
│  ├─ sources/                一個來源一個檔案：devpost.py、mlh.py、bhuntr.py
│  ├─ extract/
│  │  ├─ candidates.py        步驟 1：Regex 找「可能相關的段落」（只縮小範圍，不做判斷）
│  │  ├─ llm.py               步驟 2：LLM（OpenAI 或 Claude，看你放哪一把金鑰）讀段落，照固定格式回答
│  │  ├─ schema.py            步驟 3：Pydantic 定義格式，答案不合格式就拒收
│  │  └─ validate.py          步驟 4：Validator 檢查（見下表）
│  ├─ store/                  步驟 5：json_store.py（網站讀的檔案）、supabase_store.py（資料庫）
│  ├─ http.py / text.py / cache.py / config.py
│  ├─ tests/                  pytest
│  └─ cache.json              查過的頁面和 LLM 的答案，沒變就不重查、不重花錢
├─ data/
│  ├─ competitions.json       公開的比賽清單（網站讀這個）
│  ├─ review.json             要人工確認的比賽和原因
│  └─ competitions.schema.json 資料格式說明
├─ supabase/migrations/       資料庫結構：0001 比賽、0002 使用者（草稿）
├─ tests/                     node --test，不需要安裝任何套件
├─ tools/version.js           部署前蓋上版本號，避免瀏覽器混用新舊檔案
└─ .github/workflows/competitions.yml  每天 06:00（台灣時間）先測試、再爬蟲
```

## 模組邊界（誰可以用誰）

- `shared` 不 import 任何 app 的東西。
- `crawler`（Python）產出的格式，跟網頁的 `shared/contract.js` 是同一份約定；兩邊各自檢查。
- app 裡面分三層：
  - **資料**：`state`、`competitions`、`sample-people`
  - **邏輯**：`matching`、`rules`、`chats`
  - **畫面**：`views`、`render`

## 六個原則怎麼做到

| 原則 | 這個專案怎麼做 |
|---|---|
| Separation of Concerns | 畫面（views/screens）只產生 HTML；邏輯（matching/rules）不碰畫面；資料存取（state/competitions/profile）集中在少數檔案 |
| Single Responsibility | 一個檔案一件事，例如 `team-size.js` 只判斷人數，`devpost.js` 只抓 Devpost |
| DRY | 杯子圖、糖度、表單、個人資料只寫一次，放在 `shared`。不為了重複兩行就硬抽象 |
| API Contract | 爬蟲用 Pydantic（`schema.py` 的 `Published`）、網頁用 `shared/contract.js` 檢查同一個格式；資料庫再用欄位限制檢查一次。不合格的丟掉並記錄 |
| Security by Design | 所有輸出都經過 `esc()` 跳脫；外部連結只接受 http(s)（`safeUrl`）；爬蟲只抓 robots.txt 允許的公開頁面，並放慢速度。目前沒有後端、沒有密鑰；有後端後，權限檢查放伺服器、密鑰放 GitHub Secrets 或雲端環境變數 |
| Testability & Observability | 核心邏輯是純函式，`npm test` 跑網頁和爬蟲的測試（Validator 每一條規則都有測試，LLM 用假的回答測）。錯誤都送到 `shared/log.js`；爬蟲每次印出每個來源找到、公開、跳過、待確認各幾筆和原因，紀錄留在 GitHub Actions，待確認清單在 `data/review.json` |

## 組隊人數怎麼抓

```
網頁 → Regex 找可能段落 → LLM 理解規則 → Pydantic 統一格式 → Validator 檢查 → 存檔 / 資料庫
```

LLM 被要求：只抓參賽人數、上下限分開、沒寫就是 null、不要跟年齡／獎項名額／指導老師／隊伍數量搞混、不同組別分開、每一條都要附原文、不確定就標記人工確認。

| 狀況 | 系統處理 |
|---|---|
| Min = 5、Max = 2 | 不合理，標記錯誤，不公開 |
| 網站只說最多 5 人 | Min 保留 null，顯示「Max 5 people」 |
| 「可以個人或最多 8 人」 | 記下「可個人參賽」，顯示「1–8 people」 |
| 同時有高中組、大專組 | 分別儲存不同組別 |
| 主頁寫 2–4 人、規則頁寫 3–5 人 | 標記衝突，不公開人數，人工確認 |
| 「最多 5 名學生及 1 名指導老師」 | 參賽者 5、指導老師 1，分開存 |
| LLM 給的原文在網頁上找不到 | 不公開那條人數 |
| LLM 自己說不確定 | 不公開人數，人工確認 |

用哪一家 LLM：有 `OPENAI_API_KEY` 就用 OpenAI（預設 gpt-5-mini），有 `ANTHROPIC_API_KEY` 就用 Claude（預設 claude-sonnet-5-5）。想換型號，在 GitHub 設定一個 `LLM_MODEL` 變數。兩家的回答都要通過同樣的 Pydantic 和 Validator 檢查。

兩把金鑰都沒有時：已公開的比賽維持原樣，黑客松照常列出（人數顯示看官網），其他新比賽先不公開，等可以讀了再說。

## 翻譯

- **比賽內容**：LLM 每天讀比賽時同時寫英文和中文，自動完成。
- **介面文字**：`tools/translate_ui.py` 每天找出沒有中文的新文字，交給 LLM 翻譯，檢查（`{0}` 不能少、產品名稱保留英文）後寫進 `src/shared/locales/zh.js`。已經有的行不會被改，所以人工修過的翻譯會留著。

## 常用指令

```
npm run setup    第一次：建立 Python 環境、安裝套件
npm test         跑全部測試（網頁 + 爬蟲）
npm run crawl    手動爬一次比賽（試跑：CRAWL_LIMIT=5 CRAWL_OUT_DIR=/tmp/x npm run crawl）
npm run serve    本機開網站：http://localhost:8000
npm run translate 補上缺的中文翻譯（需要 LLM 金鑰）
npm run version  部署前蓋版本號
```

## 雲端怎麼分工（建議）

| 需要的東西 | 用什麼 | 為什麼 |
|---|---|---|
| 使用者註冊、登入 | Supabase Auth | 不用自己寫密碼系統 |
| 資料庫 | Supabase（Postgres） | 結構在 `supabase/migrations/`；權限用資料庫的 row-level security 檢查 |
| 即時聊天 | Supabase Realtime | 同一個服務，不用另外架 |
| 網站 | Cloudflare（meetup.christine921117.workers.dev） | 登入和資料都在 Supabase，網站本身不需要伺服器；GitHub 有新版本就自動更新 |
| 每天爬蟲 + LLM + 翻譯 | GitHub Actions | 每天 06:00 跑，LLM 金鑰（OpenAI 或 Claude）放 GitHub Secrets |
| 需要藏金鑰的伺服器程式 | Supabase Edge Functions | 例如管理員確認人數的操作 |
| Docker | 目前不需要 | 沒有自己架的伺服器 |

## 之後要接後端時改哪裡

- 已完成：帳號和個人資料在 Supabase（`shared/account.js`），比賽從 Supabase 讀（讀不到時改讀每日檔案）
- 下一步：隊伍、參賽卡和聊天存進資料庫（現在在瀏覽器）；範例使用者 `sample-people.js` 換成真的使用者
