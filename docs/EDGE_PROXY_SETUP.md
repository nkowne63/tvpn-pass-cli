# Microsoft EdgeでのProxy設定ガイド

このガイドでは、Microsoft EdgeでT-VPN SOCKS5プロキシを使用する方法を説明します。

## 方法1: 専用のEdgeショートカット作成（推奨）

VPN用とVPN無し用の2つのEdgeを使い分ける方法です。

### 1.1 VPN用Edgeショートカットの作成

1. デスクトップ上のEdgeショートカットを右クリック
2. 「コピー」を選択
3. デスクトップの空白部分で右クリック→「貼り付け」
4. 新しいショートカットの名前を「Edge (T-VPN)」などに変更

### 1.2 ショートカットの設定変更

1. 「Edge (T-VPN)」ショートカットを右クリック
2. 「プロパティ」を選択
3. 「リンク先」フィールドの末尾に以下を追加：

```
--proxy-server="socks5://localhost:1080" --user-data-dir="%LOCALAPPDATA%\Microsoft\Edge-VPN"
```

完全な例：
```
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --proxy-server="socks5://localhost:1080" --user-data-dir="%LOCALAPPDATA%\Microsoft\Edge-VPN"
```

4. 「OK」をクリック

### 1.3 アイコンの変更（オプション）

見分けやすくするため、VPN用Edgeのアイコンを変更することをお勧めします：

1. ショートカットを右クリック→「プロパティ」
2. 「アイコンの変更」をクリック
3. 別のアイコンを選択

### 1.4 使い分け

- **通常のEdge**: 通常のインターネット接続
- **Edge (T-VPN)**: VPN経由の接続（学内リソースへのアクセス等）

## 方法2: システム全体のProxy設定

Windows全体でプロキシを使用する方法です。

### 2.1 Windowsのプロキシ設定

1. 設定を開く（Win + I）
2. 「ネットワークとインターネット」→「プロキシ」
3. 「手動プロキシセットアップ」セクション
4. 「プロキシサーバーを使う」をオンにする
5. アドレス: `socks5://localhost`
6. ポート: `1080`
7. 「保存」をクリック

**注意**: この方法は全てのアプリケーションに影響します。

### 2.2 除外設定

学内リソース以外をプロキシ経由にしたくない場合：

1. 「次で始まるアドレス以外にプロキシサーバーを使用する」にチェック
2. 除外するアドレスを入力（例: `localhost;127.0.0.1`）

## 方法3: 拡張機能を使用

より柔軟なプロキシ切り替えには、拡張機能が便利です。

### 3.1 推奨拡張機能

- **Proxy SwitchyOmega**: 高機能なプロキシ管理拡張機能

### 3.2 Proxy SwitchyOmegaの設定

1. [Edge Add-ons](https://microsoftedge.microsoft.com/addons/)から「Proxy SwitchyOmega」をインストール
2. 拡張機能アイコンをクリック→「オプション」
3. 新しいプロファイルを作成（例: "T-VPN"）
4. プロトコル: `SOCKS5`
5. サーバー: `localhost`
6. ポート: `1080`
7. 「適用」をクリック

### 3.3 使用方法

拡張機能アイコンをクリックして、プロファイルを切り替えます：
- **Direct**: プロキシを使用しない
- **T-VPN**: VPN経由でアクセス

### 3.4 Auto Switchの設定（上級者向け）

特定のURLパターンに対して自動的にプロキシを使用：

1. Proxy SwitchyOmegaの「Auto Switch」プロファイルを作成
2. ルールを追加：
   - 条件: `*.u-tokyo.ac.jp`
   - プロファイル: `T-VPN`
3. デフォルトプロファイル: `Direct`

## 動作確認

### プロキシが有効か確認

1. VPN用Edgeを起動
2. [https://ipinfo.io](https://ipinfo.io)にアクセス
3. 表示されるIPアドレスを確認

学内ネットワークのIPアドレス範囲が表示されれば成功です。

### 東大のリソースにアクセス

1. [https://www.u-tokyo.ac.jp](https://www.u-tokyo.ac.jp)
2. 学内限定リソース（例: 図書館の電子ジャーナル）

## トラブルシューティング

### プロキシに接続できない

**確認事項**:

1. T-VPNプロキシが起動しているか：
   ```bash
   # WSL内で
   docker ps | grep tvpn-proxy
   ```

2. ポート1080が開いているか：
   ```powershell
   # PowerShellで
   Test-NetConnection -ComputerName localhost -Port 1080
   ```

3. ショートカットのパスが正しいか確認

### ページが表示されない

**考えられる原因**:

1. **VPN接続が確立されていない**
   - WSL内でログを確認: `docker-compose logs`

2. **DNSの問題**
   - Edgeの起動オプションに追加:
   ```
   --host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE localhost"
   ```

3. **プロキシサーバーの設定ミス**
   - `socks5://localhost:1080`のフォーマットを確認

### 2つのEdgeを同時に起動できない

`--user-data-dir`オプションが正しく設定されているか確認してください。異なるユーザーデータディレクトリを使用することで、複数のEdgeインスタンスを同時に起動できます。

## プロキシが立っていない場合の挙動

### 現象

- **ショートカット起動時**: Edgeは起動するが、ページ読み込みがタイムアウト
- **エラーメッセージ**: "ERR_SOCKS_CONNECTION_FAILED"
- **影響範囲**: VPN用Edgeのみ（通常のEdgeは影響なし）

### 対処法

1. WSL内でDockerコンテナを起動：
   ```bash
   cd ~/tvpn-pass-cli
   docker-compose up -d
   ```

2. 1-2分待ってからページを再読み込み

## ベストプラクティス

### デスクトップ配置

- **左側**: 通常のEdgeアイコン
- **右側**: Edge (T-VPN)アイコン（異なる色のアイコン推奨）

### タスクバーへのピン留め

両方のショートカットをタスクバーにピン留めすると便利です：

1. ショートカットを右クリック
2. 「タスクバーにピン留めする」

**注意**: タスクバーから起動する場合も、プロキシ設定が維持されます。

### 起動順序

1. Windows起動
2. WSL + Dockerが自動起動（自動起動設定済みの場合）
3. VPN接続確立（約30秒）
4. Edge (T-VPN)を使用可能

## 次のステップ

- [SSHでのProxy使用方法](./SSH_PROXY_SETUP.md)
- [デュアルEdge運用のベストプラクティス](./DUAL_EDGE_OPERATION.md)
- [IP固定化とドメイン設定](./NETWORKING.md)
