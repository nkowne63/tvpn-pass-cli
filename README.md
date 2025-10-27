# T-VPN SOCKS5 Proxy

Docker化されたT-VPN（東京大学VPN）接続ツールで、SOCKS5プロキシサーバーを提供します。WSL2環境でVPNを自動的に確立し、Windows上のブラウザやSSHクライアントからVPN経由でアクセスできます。

## 主な機能

- 🔒 **自動VPN接続**: ワンタイムパスワードを自動取得してVPN接続
- 🔄 **自動再接続**: 接続断を検知して自動的に再接続
- 🌐 **SOCKS5プロキシ**: ブラウザ、SSH、その他のアプリで使用可能
- 🐳 **Docker化**: コンテナで隔離された安定した環境
- 💻 **WSL2統合**: Windows環境からシームレスに利用

## クイックスタート

### 1. 環境設定

```bash
# リポジトリをクローン
git clone <repository-url> tvpn-pass-cli
cd tvpn-pass-cli

# 環境変数を設定
cp .env.example .env
nano .env
```

`.env`ファイルを編集：

```env
V_UID=your_utokyo_uid
V_PATTERN=0,1,2,3
V_STATIC=your_static_password
VPN_SERVER=your_vpn_server
VPN_PSK=your_ipsec_psk
VPN_AUTH_URL=your_auth_url
```

#### パターン番号の確認

T-VPNのワンタイムパスワード画面で表示される番号に対応：

```
パターン画面の番号配置:
00 01 02 03  16 17 18 19  32 33 34 35
04 05 06 07  20 21 22 23  36 37 38 39
08 09 10 11  24 25 26 27  40 41 42 43
12 13 14 15  28 29 30 31  44 45 46 47
```

例: パターンが「左上、その右、その下、その右」の場合：
```env
V_PATTERN=0,1,5,6
```

### 2. Dockerコンテナの起動

```bash
# コンテナをバックグラウンドで起動
docker-compose up -d

# ログで接続状態を確認
docker-compose logs -f
```

接続成功のログ例：
```
[INFO] VPN connected successfully
[INFO] SOCKS5 proxy server started on port 1080
```

### 3. プロキシの使用

#### Edgeブラウザ（推奨）

ショートカットを作成してVPN用Edgeを起動：

```
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --proxy-server="socks5://localhost:1080" --user-data-dir="%LOCALAPPDATA%\Microsoft\Edge-VPN"
```

詳細: [EdgeでのProxy設定ガイド](./docs/EDGE_PROXY_SETUP.md)

#### SSH接続

`~/.ssh/config`に追加：

```ssh-config
Host *.u-tokyo.ac.jp
    ProxyCommand nc -X 5 -x localhost:1080 %h %p
    User your-username
```

詳細: [SSHでのProxy使用ガイド](./docs/SSH_PROXY_SETUP.md)

## アーキテクチャ

```
┌──────────────────────────────────────────────┐
│ Windows Host                                 │
│                                              │
│  ┌────────────┐         ┌────────────┐      │
│  │ Edge (VPN) │────┐    │ SSH Client │──┐   │
│  └────────────┘    │    └────────────┘  │   │
│                    │                     │   │
│                    ↓ localhost:1080     │   │
│  ┌──────────────────────────────────────────┤
│  │ WSL2                                 │   │
│  │  ┌──────────────────────────────────┐│   │
│  │  │ Docker Container                 ││   │
│  │  │  ┌────────────┐  ┌─────────────┐││   │
│  │  │  │ VPN Client │→ │ SOCKS5 Proxy│├┼───┘
│  │  │  │(L2TP/IPsec)│  │   :1080     │││
│  │  │  └────────────┘  └─────────────┘││
│  │  └──────────────────────────────────┘│
│  └────────────────────────────────────────┘
│                    ↓
│         T-VPN (Your VPN Server)
└──────────────────────────────────────────────┘
```

## 詳細ガイド

### 第1段階: 基本要件

- [WSL環境でのセットアップ](./docs/WSL_SETUP.md)
  - WSL2のインストール
  - Dockerのセットアップ
  - 自動起動の設定

### 第2段階: WSL + Windows統合

- [Windows EdgeでのProxy設定](./docs/EDGE_PROXY_SETUP.md)
  - 専用Edgeショートカットの作成
  - システム全体のプロキシ設定
  - 拡張機能を使用した設定

- [SSHでのProxy使用方法](./docs/SSH_PROXY_SETUP.md)
  - Windows/WSLでのSSH設定
  - Git over SSH
  - VS Code Remote-SSH

### 第3段階: 運用方法

- [デュアルEdge運用ガイド](./docs/DUAL_EDGE_OPERATION.md)
  - 通常Edge + VPN用Edgeの使い分け
  - プロキシが立っていない場合の挙動
  - ベストプラクティス

### 第4段階: ネットワーク設定

- [IP固定化とドメイン設定](./docs/NETWORKING.md)
  - localhostの推奨理由
  - WSL IPアドレスの固定方法
  - SOCKS5プロキシの仕組み

## コマンドリファレンス

### Dockerコンテナ操作

```bash
# 起動
docker-compose up -d

# 停止
docker-compose down

# 再起動
docker-compose restart

# ログ確認
docker-compose logs -f

# ステータス確認
docker-compose ps
```

### 接続確認

```bash
# WSL内でプロキシポートを確認
netstat -an | grep 1080

# Windows PowerShellで接続テスト
Test-NetConnection -ComputerName localhost -Port 1080

# プロキシ経由でIPアドレスを確認
curl --socks5 localhost:1080 https://ipinfo.io/ip
```

### トラブルシューティング

```bash
# コンテナのシェルに入る
docker exec -it tvpn-proxy bash

# VPN接続状態を確認
docker exec tvpn-proxy ip addr show ppp0

# ログを詳細に確認
docker-compose logs --tail=100 -f
```

## 便利なバッチファイル

### start-tvpn.bat

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

### stop-tvpn.bat

```batch
@echo off
echo Stopping T-VPN Proxy...
wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose down"
echo T-VPN Proxy stopped.
pause
```

### check-tvpn.bat

```batch
@echo off
echo Checking T-VPN Proxy status...
wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose ps"
echo.
echo Recent logs:
wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose logs --tail=10"
pause
```

## 環境変数

| 変数 | 説明 | デフォルト値 |
|------|------|------------|
| `V_UID` | 東京大学のUID | （必須） |
| `V_PATTERN` | パターン番号（カンマ区切り） | （必須） |
| `V_STATIC` | 固定パスワード | （必須） |
| `VPN_SERVER` | VPNサーバーアドレス | （必須） |
| `VPN_PSK` | IPsec事前共有キー | （必須） |
| `VPN_AUTH_URL` | 認証URL | （必須） |
| `RECONNECT_INTERVAL` | 再接続チェック間隔（秒） | `300` |

## トラブルシューティング

### VPN接続が失敗する

**確認事項**:

1. UID、パターン、固定パスワードが正しいか
2. T-VPNサービスが稼働しているか
3. ネットワーク接続が正常か

**ログ確認**:
```bash
docker-compose logs | grep ERROR
```

### プロキシに接続できない

**確認事項**:

1. Dockerコンテナが起動しているか:
   ```bash
   docker ps | grep tvpn-proxy
   ```

2. ポート1080が開いているか:
   ```bash
   netstat -an | grep 1080
   ```

3. Windowsファイアウォールの設定

### 定期的に切断される

再接続間隔を短くする:

```env
# .env
RECONNECT_INTERVAL=180  # 3分
```

### WSLのIPアドレスが変わる

**推奨**: `localhost`を使用（Docker Desktop for Windows利用時）

詳細: [ネットワーク設定ガイド](./docs/NETWORKING.md)

### SSH接続が鍵交換で止まる・タイムアウトする

**症状**: SSH接続時に "expecting SSH2_MSG_KEX_ECDH_REPLY" で止まる

**原因**: PPP MTUが大きすぎてSSH鍵交換パケットが断片化され、VPNサーバーで正しく処理されない

**解決済み**: v0.3.1でPPP MTU/MRUを1200に設定済み

**デバッグ方法**:
```bash
# パケットキャプチャで確認
docker exec tvpn-proxy tcpdump -i ppp0 -n host <target-ip> and port 22

# MTU設定を確認
docker exec tvpn-proxy ip addr show ppp0 | grep mtu
```

**技術詳細**:
- SSH鍵交換パケットは約1228バイト
- MTU 1280では断片化された最初のフラグメントがドロップされる
- MTU 1200に減らすことで断片化を回避
- MSS clampingも併用してTCP最大セグメントサイズを自動調整

## セキュリティ

### 認証情報の保護

```bash
# .envファイルのパーミッション設定
chmod 600 .env

# Gitで追跡しない
echo ".env" >> .gitignore
```

### ログの監視

```bash
# 異常な接続を検知
docker-compose logs | grep -i "fail\|error"
```

### ファイアウォール設定

不要な外部アクセスをブロック：

```bash
# Dockerコンテナのファイアウォール設定例
# docker-compose.ymlに追加
networks:
  tvpn-network:
    internal: true
```

## パフォーマンス最適化

### メモリとCPU制限

`docker-compose.yml`に追加：

```yaml
services:
  tvpn-proxy:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### ログのローテーション

```yaml
services:
  tvpn-proxy:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## よくある質問（FAQ）

### Q1: 複数のVPN接続を同時に使用できますか？

A: 可能です。異なるポートを使用してください：

```yaml
# docker-compose.yml
ports:
  - "1080:1080"  # 1つ目
  - "1081:1080"  # 2つ目
```

### Q2: Windows以外のホストから使用できますか？

A: はい。`0.0.0.0:1080`にバインドして、適切なファイアウォール設定を行ってください。

### Q3: 自動起動は可能ですか？

A: はい。[WSLセットアップガイド](./docs/WSL_SETUP.md)の自動起動セクションを参照してください。

### Q4: プロキシが立っていない場合はどうなりますか？

A: VPN用Edgeは起動しますが、ページ読み込みが「ERR_SOCKS_CONNECTION_FAILED」でタイムアウトします。通常のEdgeは影響を受けません。

詳細: [デュアルEdge運用ガイド](./docs/DUAL_EDGE_OPERATION.md)

## ライセンス

MIT License

## 貢献

Issue、Pull Requestは大歓迎です。

## サポート

- [Issues](https://github.com/your-repo/issues)
- [Discussions](https://github.com/your-repo/discussions)

## 関連リンク

- [東京大学VPN (T-VPN)](https://www.u-tokyo.ac.jp/adm/dics/ja/vpn.html)
- [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
- [WSL2ドキュメント](https://docs.microsoft.com/ja-jp/windows/wsl/)

## 変更履歴

### v0.3.1 (2025-10-27)
- **重要**: PPP MTU/MRUを1280から1200に変更してSSH接続の安定性を向上
  - SSH鍵交換パケットの断片化問題を解決
  - tcpdumpによる詳細な調査で特定された問題への対処
- TCP MSS clampingを追加（clamp-mss-to-pmtu）
  - Path MTUに基づく動的なMSS調整で断片化を防止
- Dante SOCKS5プロキシのデバッグログを強化
  - debug level 2を追加
  - 接続・切断・エラーの詳細ログを有効化
- SSH config例を更新（MTU対応の暗号設定を追加）

### v0.3.0 (2025-10-27)
- PPTPからL2TP/IPsecに変更（工学系VPNユーザーガイドに準拠）
- VPN設定を環境変数化（VPN_SERVER, VPN_PSK, VPN_AUTH_URL）
- strongSwanとxl2tpdによる実装
- PPP認証をPAPに変更（MS-CHAP v2から変更）
- 強力な暗号化アルゴリズムを優先（AES256-SHA256）
- NAT Traversal (NAT-T)サポート追加
- Dead Peer Detection (DPD)による自動再接続
- IPsec接続確認プロセスの改善
- 接続タイムアウトの延長と詳細なログ出力

### v0.2.0 (2025-10-24)
- Docker化、SOCKS5プロキシ対応
- WSL2統合
- 自動再接続機能
- 包括的なドキュメント追加

### v0.0.1
- 初期リリース
- 基本的なワンタイムパスワード生成機能
