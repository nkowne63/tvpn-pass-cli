# デュアルEdge運用ガイド

このガイドでは、通常のEdgeとVPN用Edgeを並行して使い分ける運用方法を説明します。

## なぜ2つのEdgeを使い分けるのか

### 利点

1. **パフォーマンス**: 通常のサイトはVPNを経由せず、高速アクセス
2. **安定性**: プロキシの問題が通常のブラウジングに影響しない
3. **明確な区別**: どちらのネットワーク経由かが一目瞭然
4. **セッション分離**: 学内/学外のセッションを分離できる

### 使い分けの例

| 用途 | 使用するEdge |
|------|-------------|
| 一般的なWebブラウジング | 通常のEdge |
| YouTubeやNetflix | 通常のEdge |
| 東大図書館の電子ジャーナル | VPN用Edge |
| 学内限定Webサイト | VPN用Edge |
| 学内サーバーの管理画面 | VPN用Edge |

## セットアップ

### 1. ショートカットの作成

#### 1.1 通常のEdge

デスクトップに既存のEdgeショートカットがあることを確認。

#### 1.2 VPN用Edge

[EdgeでのProxy設定ガイド](./EDGE_PROXY_SETUP.md)を参照して作成。

重要なポイント：
```
--proxy-server="socks5://localhost:1080" --user-data-dir="%LOCALAPPDATA%\Microsoft\Edge-VPN"
```

### 2. アイコンのカスタマイズ

#### 2.1 VPN用Edgeのアイコン変更

見分けやすくするため、異なるアイコンを設定します：

1. ショートカットを右クリック→「プロパティ」
2. 「アイコンの変更」をクリック
3. 以下のいずれかを選択：
   - `%SystemRoot%\System32\SHELL32.dll` から別のアイコン
   - カスタムアイコンファイル（.ico）を使用

#### 2.2 推奨アイコン配色

- **通常Edge**: 青系（デフォルト）
- **VPN用Edge**: 赤系、緑系、または黄色系

### 3. 配置とアクセス

#### 3.1 デスクトップ配置

```
┌─────────────────────────┐
│  Desktop                │
│                         │
│  🔵 Edge                │
│  (通常)                  │
│                         │
│  🔴 Edge (T-VPN)        │
│  (VPN経由)              │
│                         │
└─────────────────────────┘
```

#### 3.2 タスクバーへのピン留め

両方をタスクバーに追加：

1. 各ショートカットを右クリック
2. 「タスクバーにピン留めする」

**重要**: タスクバーからの起動でもプロキシ設定は維持されます。

#### 3.3 スタートメニュー

1. ショートカットを右クリック
2. 「スタートにピン留めする」

## 運用フロー

### 起動順序

```
1. Windows起動
   ↓
2. (オプション) WSL自動起動
   ↓
3. Docker T-VPNプロキシ起動
   ↓
4. 両方のEdgeを使用可能
```

### 日常的な使い方

#### パターン1: 朝の起動

```bash
# WSL内で
cd ~/tvpn-pass-cli
docker-compose up -d

# 接続確認（30秒～1分待つ）
docker-compose logs -f
```

接続確認後、両方のEdgeを使用開始。

#### パターン2: 自動起動設定済み

Windowsにログインするだけで自動的にプロキシが起動します。

### シナリオ別の使い分け

#### シナリオ1: 論文検索

1. **VPN用Edge**で大学図書館ポータルを開く
2. 論文を検索してPDFをダウンロード
3. 必要に応じて**通常のEdge**で関連情報を検索

#### シナリオ2: 学内システムへのアクセス

1. **VPN用Edge**で学内ポータル、成績システムなどにアクセス
2. **通常のEdge**でメール、カレンダーなど一般的なサービスを使用

#### シナリオ3: Web開発

1. **通常のEdge**で開発中のサイトをテスト
2. **VPN用Edge**で学内APIサーバーへのアクセスをテスト

## プロキシが立っていない場合の挙動

### 現象

**VPN用Edgeを起動した場合**:

1. Edgeウィンドウは正常に開く
2. ページの読み込みが開始される
3. タイムアウトまで待機（通常15-30秒）
4. エラーメッセージ表示:
   ```
   ERR_SOCKS_CONNECTION_FAILED
   プロキシサーバーに接続できません
   ```

### 視覚的な違い

| 状態 | VPN用Edge | 通常のEdge |
|------|-----------|-----------|
| プロキシ起動中 | ✅ ページ読み込み成功 | ✅ ページ読み込み成功 |
| プロキシ停止中 | ❌ 接続エラー | ✅ ページ読み込み成功 |

### 対処方法

#### 方法1: プロキシを起動

```bash
# WSL内で
cd ~/tvpn-pass-cli
docker-compose up -d

# ログで接続確認
docker-compose logs -f
```

「VPN connected successfully」が表示されたら、Edgeでページを再読み込み。

#### 方法2: 一時的に通常のEdgeを使用

学内リソースが不要な場合は、通常のEdgeに切り替え。

## トラブルシューティング

### 問題1: 2つのEdgeを同時に起動できない

**症状**: VPN用Edgeを起動すると、通常のEdgeが閉じる

**原因**: `--user-data-dir`が設定されていない

**解決方法**:
ショートカットのリンク先を確認：
```
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --proxy-server="socks5://localhost:1080" --user-data-dir="%LOCALAPPDATA%\Microsoft\Edge-VPN"
```

### 問題2: VPN用Edgeが正しく動作しているか不明

**確認方法**:

1. VPN用Edgeで[https://ipinfo.io](https://ipinfo.io)を開く
2. 表示されるIPアドレスを確認
3. 通常のEdgeで同じページを開く
4. IPアドレスが異なれば、VPNが機能している

**期待される結果**:
- VPN用Edge: 学内ネットワークのIPアドレス（例: 133.11.x.x）
- 通常のEdge: 自宅/オフィスのIPアドレス

### 問題3: どちらのEdgeを使っているか分からなくなる

**解決方法**:

#### 方法1: ウィンドウタイトルを確認

VPN用Edgeは異なるプロファイルを使用するため、タイトルバーに「Edge (T-VPN)」と表示される（ショートカット名による）。

#### 方法2: ブックマークを色分け

- **VPN用Edge**: 学内リソースのブックマークのみ
- **通常Edge**: 一般的なブックマーク

#### 方法3: テーマを変更

1. VPN用Edgeの設定を開く
2. 「外観」→「テーマ」
3. 異なるテーマを選択（例: ダークモード）

### 問題4: ブックマークが同期されない

**原因**: 異なるユーザーデータディレクトリを使用しているため、ブックマークは同期されません。

**解決方法（必要な場合）**:

両方のEdgeで同じMicrosoftアカウントにサインインすると、ブックマークが同期されます。

ただし、**使い分けの観点からは、同期しないことを推奨**します：
- VPN用Edge: 学内リソースのブックマークのみ
- 通常Edge: 一般的なブックマーク

## 高度な運用テクニック

### 1. 起動スクリプトの作成

#### start-tvpn.bat（デスクトップに配置）

```batch
@echo off
echo Starting T-VPN Proxy...
wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose up -d"
timeout /t 3
echo Checking connection...
wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose logs --tail=20"
echo.
echo T-VPN Proxy is ready!
pause
```

ダブルクリックで起動できます。

#### stop-tvpn.bat

```batch
@echo off
echo Stopping T-VPN Proxy...
wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose down"
echo T-VPN Proxy stopped.
pause
```

### 2. ステータス確認スクリプト

#### check-tvpn.bat

```batch
@echo off
echo Checking T-VPN Proxy status...
wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose ps"
echo.
echo Recent logs:
wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose logs --tail=10"
pause
```

### 3. Windows通知との連携

PowerShellスクリプト（`notify-tvpn.ps1`）:

```powershell
# VPN接続状態を確認して通知
$status = wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose ps | grep tvpn-proxy | grep Up"

if ($status) {
    New-BurntToastNotification -Text "T-VPN", "プロキシが稼働中です"
} else {
    New-BurntToastNotification -Text "T-VPN", "プロキシが停止しています" -Sound "Alarm"
}
```

### 4. キーボードショートカット

VPN用Edgeに高速アクセス：

1. ショートカットを右クリック→「プロパティ」
2. 「ショートカットキー」フィールドをクリック
3. キーの組み合わせを入力（例: `Ctrl+Alt+V`）

## ベストプラクティス

### 起動と終了

**推奨フロー**:
1. 朝: `start-tvpn.bat`を実行
2. 日中: 両方のEdgeを自由に使用
3. 夜: `stop-tvpn.bat`を実行（オプション）

**長時間運用する場合**:
自動再接続機能があるため、1日中起動したままでも問題ありません。

### セキュリティ

1. **ログイン情報の管理**:
   - `.env`ファイルを適切に保護
   - パスワードをブラウザに保存しない

2. **接続の確認**:
   - 定期的に`check-tvpn.bat`でステータス確認

3. **ログの監視**:
   - 異常な接続パターンがないか定期的に確認

## まとめ

### デュアルEdge運用の鍵

1. **明確な識別**: アイコンと配置で区別
2. **適切な使い分け**: 用途に応じて選択
3. **安定した接続**: プロキシの自動再接続
4. **簡単な操作**: バッチファイルで管理

この運用方法により、学内外のリソースに効率的にアクセスできます。

## 次のステップ

- [IP固定化とドメイン設定](./NETWORKING.md)
- [WSL環境でのセットアップ](./WSL_SETUP.md)
- [SSHでのProxy使用方法](./SSH_PROXY_SETUP.md)
