# 入校輔導紀錄

供督導教授在 iPad mini 現場記錄入校輔導，並於電腦續編、匯出《115-DEMO-D01 數位學習示範學校輔導紀錄表》Word 檔的離線網頁程式（PWA）。

- 所有紀錄只存在使用者裝置的瀏覽器（IndexedDB），不會上傳。本儲存庫僅含程式、空白樣板與虛構示範資料。
- 跨裝置以「訪視檔」（UTF-8 JSON）交接；匯入時預覽新增／相同／衝突，衝突須逐筆選擇。

## 安裝到 iPad
1. 以 Safari 開啟網址，等待「設定 → 離線使用」顯示「已可離線使用」。
2. 分享 → 加入主畫面。之後可在飛航模式下開啟。

## 部署
純靜態檔案，無建置步驟。GitHub Pages：Settings → Pages → Deploy from branch → `main` / root。
更新程式時請同步修改 `sw.js` 的 `VERSION`，使用者會看到「新版本已就緒」提示；紀錄不受影響。

## 檔案
| 檔案 | 用途 |
|---|---|
| index.html / styles.css / app.js | 介面與流程 |
| store.js | IndexedDB 與修訂號衝突偵測 |
| docx-fill.js | 依儲存格定位套入 Word 樣板，含樣板版本檢核 |
| template.docx | 空白原表 |
| sw.js | 離線快取 |
