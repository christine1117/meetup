# Half Sugar 專案架構

一個專案、一起部署（Modular Monolith）。裡面分成四個模組，每個模組有清楚的邊界。

| 模組 | 資料夾 | 負責什麼 |
|---|---|---|
| Half Sugar | `src/halfsugar/` | 聊天交友：Explore、Brew、Mystery Cup、Chats、Me |
| Teams | `src/teams/` | 比賽組隊：選比賽、參賽卡、推薦、聊到半糖、組隊 |
| Competitions | `crawler/` + `data/` | 每天抓真實比賽，存成 `data/competitions.json` |
| Shared（共用核心） | `src/shared/` | 兩個 app 都用的東西：杯子圖、糖度規則、個人資料、資料格式約定 |

## 資料夾

```
meetup/
├─ index.html                 Half Sugar 入口（網址 /meetup/）
├─ teams/index.html           Teams 入口（網址 /meetup/teams/）
├─ landing/                   舊的介紹頁
├─ src/
│  ├─ shared/                 共用核心，不認識任何一個 app
│  │  ├─ core.js              小工具：$、uid、esc、safeUrl
│  │  ├─ i18n.js              介面文字（英文／中文）
│  │  ├─ flavors.js           領域 = 口味、Logo
│  │  ├─ cup.js               畫杯子和配料（只產生 SVG 文字）
│  │  ├─ sugar.js             糖度和「放涼」規則（純函式）
│  │  ├─ forms.js             表單欄位
│  │  ├─ profile.js           共用的個人資料（兩個 app 同一份）
│  │  ├─ contract.js          比賽資料的格式約定
│  │  ├─ log.js               錯誤紀錄
│  │  └─ styles/base.css
│  ├─ halfsugar/
│  │  ├─ main.js              入口：啟動
│  │  ├─ state.js             存檔資料
│  │  ├─ people.js            範例使用者
│  │  ├─ matching.js          推薦演算法
│  │  ├─ conversations.js     聊天、揭曉
│  │  ├─ simulate.js          範例使用者的回覆（有後端後移除）
│  │  ├─ toppings.js          配料和禮物盒
│  │  ├─ modal.js             彈出視窗
│  │  ├─ screens/*.js         每個頁面一個檔案
│  │  ├─ shell.js             版面和 render()
│  │  ├─ forms.js / actions.js / events.js
│  │  └─ router.js / ui.js
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
├─ crawler/
│  ├─ run.js                  總指揮：跑每個來源、檢查格式、存檔、寫 log
│  ├─ sources/                一個來源一個檔案：devpost.js、mlh.js、bhuntr.js
│  ├─ lib/                    http.js（禮貌請求）、text.js、team-size.js（判斷人數）、cache.js
│  └─ cache.json              已經查過的頁面，每天只重抓有變動的
├─ data/
│  ├─ competitions.json       爬蟲的產出，網頁讀這個
│  └─ competitions.schema.json 資料格式說明
├─ tests/                     node --test，不需要安裝任何套件
├─ tools/version.js           部署前蓋上版本號，避免瀏覽器混用新舊檔案
└─ .github/workflows/competitions.yml  每天 06:00（台灣時間）先測試、再爬蟲
```

## 模組邊界（誰可以用誰）

- `shared` 不 import 任何 app 的東西。
- `halfsugar` 和 `teams` 互相不 import，只透過 `shared` 共用。
- `crawler` 只用 `shared/contract.js`，跟網頁共用同一份資料格式。
- 每個 app 裡面分三層：
  - **資料**：`state`、`competitions`、`people`
  - **邏輯**：`matching`、`rules`、`chats`、`conversations`
  - **畫面**：`views`、`screens`、`render`、`shell`

## 六個原則怎麼做到

| 原則 | 這個專案怎麼做 |
|---|---|
| Separation of Concerns | 畫面（views/screens）只產生 HTML；邏輯（matching/rules）不碰畫面；資料存取（state/competitions/profile）集中在少數檔案 |
| Single Responsibility | 一個檔案一件事，例如 `team-size.js` 只判斷人數，`devpost.js` 只抓 Devpost |
| DRY | 杯子圖、糖度、表單、個人資料只寫一次，放在 `shared`。不為了重複兩行就硬抽象 |
| API Contract | `shared/contract.js` 定義一筆比賽長怎樣；爬蟲存檔前檢查，網頁讀取時再檢查，不合格的丟掉並記錄 |
| Security by Design | 所有輸出都經過 `esc()` 跳脫；外部連結只接受 http(s)（`safeUrl`）；爬蟲只抓 robots.txt 允許的公開頁面，並放慢速度。目前沒有後端、沒有密鑰；有後端後，權限檢查放伺服器、密鑰放 GitHub Secrets 或雲端環境變數 |
| Testability & Observability | 核心邏輯是純函式，`npm test` 會測（人數判斷、資料格式、配對、糖度）。錯誤都送到 `shared/log.js`；爬蟲每次都印出抓到幾筆、跳過幾筆、原因是什麼，紀錄留在 GitHub Actions |

## 常用指令

```
npm test         跑測試
npm run crawl    手動爬一次比賽
npm run serve    本機開網站：http://localhost:8000
npm run version  部署前蓋版本號
```

## 之後要接後端時改哪裡

- 個人資料：`src/shared/profile.js`（現在存在瀏覽器）
- 存檔：兩個 app 的 `state.js`
- 範例使用者和假回覆：`people.js`、`simulate.js`、`sample-people.js`，換成真的 API
- 比賽資料：爬蟲改成寫進資料庫，`teams/competitions.js` 改成呼叫 API。格式不變（照 contract）
