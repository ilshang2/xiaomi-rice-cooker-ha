# 米家電子鍋 × Home Assistant：把電子鍋變成舒肥鍋

[English](README.md) | **繁體中文**

把一台便宜的智慧電子鍋（**米家電子鍋 mini，`chunmi.cooker.tw1`**，台灣版）改造成可客製化的低溫／舒肥鍋，
並提供好看的 Home Assistant 儀表板卡片。

這台電鍋**沒有開放目標溫度設定**，但它的食譜其實是 176 位元組的單純封包（表頭＋加熱曲線＋CRC），
並且接受**區網本地**送出。這個專案：

1. 在 Home Assistant 裡**啟動 15 種內建食譜，包含優格這類原本只能用 App 啟動的食譜**，可自訂時長、預約、
   自動保溫，不經小米雲端（[格式說明](docs/recipe-format.zh-TW.md)）。
2. 做一個**舒肥模式**：由 Home Assistant 盯著內鍋溫度，反覆開關電鍋內建的「保溫」模式
   （用自動化做成恆溫器）。

> **與小米無關。** 這是業餘的逆向研究專案，風險自負，請先讀[安全與限制](#安全與限制)。


<p align="center">
<img src="docs/img/card-cook-idle.png" width="23%"> <img src="docs/img/card-cook-running.png" width="23%">
<img src="docs/img/card-sousvide-recipes.png" width="23%"> <img src="docs/img/card-sousvide-running.png" width="23%">
</p>

*截圖由真實卡片算繪；「進行中」的畫面使用示範數值。*

![示範動畫](docs/demo.gif)

[![在 YouTube 觀看](https://img.youtube.com/vi/iS_5qySGZCk/hqdefault.jpg)](https://youtu.be/iS_5qySGZCk)

**▶ [在 YouTube 觀看](https://youtu.be/iS_5qySGZCk)**（約 44 秒）｜[下載 1080p mp4](docs/demo.mp4)

## 可以做到什麼

- 自訂 Lovelace 卡片 `custom:cooker-card`，三個分頁：溫度環、狀態標籤、兩段式確認、倒數。
- **烹飪分頁**：6 種啟動模式（精煮飯、快煮飯、煮粥、保溫、*自選*、再加熱）與煮好自動保溫開關。
- **食譜分頁（新）**：基本模式以外的 11 種食譜：燉煮、**優格**、嬰兒粥、泡麵、蛋糕、煲湯、再加熱、關東煮、
  熱米飯、香甜煮、極速煮；可調時長（在該食譜自己的範圍內）、**預約開始**、自動保溫；優格另有實驗性的**發酵溫度**（30～50 °C）。
  封包在瀏覽器裡組好、本地送出。
- **舒肥分頁（外部控溫）**：目標溫度 30～約 75 °C、時間最長 24 小時，一般模式（±1 °C）或安靜模式
  （±2.5 °C，提示音少約 3/4），含過溫與感測離線保護；食譜預設（溫泉蛋、鮭魚、牛排、雞胸…）與
  兩段式嬰兒粥（55 °C 吸水，再交給原廠煮粥）。
- [`tools/cookcode.py`](tools/cookcode.py) 與 [`data/recipes.json`](data/recipes.json)：在腳本與自動化裡組封包、送出。
- [食譜格式](docs/recipe-format.zh-TW.md)與[通訊協定筆記](docs/protocol-notes.zh-TW.md)：關於這台電鍋，
  我們摸清的與沒摸清的全部整理。

![食譜分頁](docs/img/card-recipes.png)

## 做不到的事（與原因）

- **自由設計加熱曲線。** 食譜封包裡的曲線（第 20–173 位元組）只解開一部分（已知階段的目標溫度與功率），
  所以目前卡片只能改表頭（時間、預約、自動保溫）加上優格的溫度。可以跑 15 種內建食譜，不能設計新的。見[食譜格式](docs/recipe-format.zh-TW.md)的「尚未解開的部分」。
- 舒肥分頁仍是反覆開關保溫模式，每次啟動／停止電鍋都會**嗶一聲**；安靜模式只能減少次數，不能消音。
  （食譜分頁只啟動一次，不會反覆嗶。）
- 煮滾型食譜（蛋糕、泡麵、煮飯）依設計會全力加熱到約 100～105 °C。

## 需求

- 安裝 [`xiaomi_miot`](https://github.com/al-one/hass-xiaomi-miot) 整合（本地模式）並加入電鍋。實體名稱預期為
  `sensor.chunmi_tw1_c3d7_cooker`、`sensor.chunmi_tw1_c3d7_temp`、`button.chunmi_tw1_c3d7_cancel_cooking`…，
  請把 YAML 與 `card/cooker-card.js` 開頭 `E` 表裡的 `c3d7` 換成你自己的裝置後綴。
- [`ha/helpers.yaml`](ha/helpers.yaml) 的輔助實體與 [`ha/automations.yaml`](ha/automations.yaml) 的自動化。

## 安裝

1. **輔助實體**：把 `ha/helpers.yaml` 併入 `configuration.yaml`（或在介面建立同名實體），重新啟動。
2. **自動化**：把 `ha/automations.yaml` 加到你的 `automations.yaml`，修改實體 ID 後重新載入。
3. **卡片**：把 `card/cooker-card.js` 複製到 `/config/www/cooker-card.js`，在「設定 → 儀表板 → 資源」新增
   網址 `/local/cooker-card.js`、類型 *JavaScript 模組*；新增卡片：
   ```yaml
   type: custom:cooker-card
   ```
4. 卡片介面文字是繁體中文，直接寫在檔案裡，要翻譯很容易。

## 舒肥控溫原理

- `sousvide_start`：`input_boolean.sousvide_run` 開啟時設定結束時間（電鍋忙碌中會拒絕）。
- `sousvide_control`（每次溫度更新與每 30 秒）：加熱中，溫度 ≥ 目標 −1.5 °C（安靜模式 −1 °C）就取消；
  待機中，溫度 ≤ 目標 −2 °C（安靜 −4 °C）就啟動保溫（`start-cook` 參數 4）；超過目標 +8 °C 強制取消；
  到結束時間就停止，若開了「結束後接原廠煮粥」，等電鍋待機後啟動原廠煮粥程式（參數 3）。
- `sousvide_stop`：舒肥關閉時取消電鍋；溫度感測離線 3 分鐘自動停止。
- `cooker_slot5*`：按下「自選」45 秒後，讀 `menu` 屬性的食譜位元組，把名稱顯示在按鈕上。

用水實測，目標 60 °C：一般模式約 ±1 °C、安靜模式約 ±2.5 °C。溫度感測解析度 1～2 °C，約 30 秒更新一次。

## 安全與限制

- **請務必內鍋放水測試，並留在附近。** 加熱是由軟體啟動的。
- 保溫模式只加熱到它自己的平台（**實測約 73～75 °C**）。更高的目標**未測試、很可能達不到**，
  即使介面滑桿允許到 90 °C。
- 食譜預設（時間與溫度）是常見的家用舒肥數值，**沒有驗證食品安全**；低溫（< 55 °C）加長時間有細菌風險。
  嬰兒副食品請依兒科建議，不要依本專案。
- 千萬不要呼叫電鍋的 `set-factory-reset` 動作（siid 4、aiid 4），也不要寫入 `bell` 屬性。
- 若自動化失效（HA 或 Wi-Fi 斷線）會有危險，就不要用：HA 停擺時，電鍋會一直加熱到它自己的恆溫器斷電。

## 給小米的小小願望

食譜封包格式後來證實是讀得懂的，但加熱曲線欄位沒有公開，電鍋也還是沒有目標溫度屬性。如果小米公開曲線格式，
或加上目標溫度屬性，自訂食譜與真正的恆溫控制就很容易，我們就能把保溫開關的變通方法收起來。
（沒有施壓、也沒有任何關係，只是一個喜歡這台小電鍋的使用者的期待。）

## 資料

`data/recipe-cake.csv`、`data/recipe-noodle.csv`：兩個米家食譜（鍋內有水）每 10 秒的溫度／階段紀錄。
欄位：時間、狀態、menu 末幾個位元組、總分鐘、剩餘秒、階段、°C。

## 授權

MIT，見 [LICENSE](LICENSE)。歡迎貢獻（其他型號、其他食譜、通訊協定發現）。
