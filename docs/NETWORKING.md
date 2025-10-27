# ネットワーク設定ガイド

このガイドでは、WSLのIPアドレス固定化、ドメイン名の設定、SOCKS5プロキシの仕組みについて説明します。

## SOCKS5プロキシとは

### 概要

**SOCKS5** (Socket Secure version 5) は、クライアントとサーバー間の通信を中継するプロトコルです。

### HTTPプロキシとの違い

| 特徴 | SOCKS5 | HTTPプロキシ |
|------|--------|-------------|
| プロトコル | TCP/UDP対応 | HTTP/HTTPS のみ |
| 用途 | あらゆるトラフィック | Webブラウジング |
| SSH対応 | ✅ 可能 | ❌ 不可 |
| パフォーマンス | 高速 | 中程度 |

### なぜSOCKS5を使うのか

1. **汎用性**: SSH、ブラウザ、その他のアプリに対応
2. **シンプル**: 認証不要で設定が簡単
3. **パフォーマンス**: オーバーヘッドが少ない
4. **標準サポート**: 多くのアプリが対応

### 動作の仕組み

```
[クライアント] → [SOCKS5プロキシ] → [VPN] → [目的サーバー]
    ↓               ↓                  ↓
  Windows        Docker/WSL        T-VPN経由
```

## WSLネットワークの基礎

### WSL2のネットワークアーキテクチャ

WSL2は仮想化技術を使用しており、独自の仮想ネットワークを持ちます：

```
┌─────────────────────────────────────┐
│ Windows Host                        │
│ IP: 192.168.1.100 (例)              │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ WSL2 VM                       │ │
│  │ IP: 172.x.x.x (動的)          │ │
│  │                               │ │
│  │  Docker Container             │ │
│  │  Port: 1080                   │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

### localhostの推奨理由

**Docker Desktop for Windows**を使用している場合：
- Windows ⇔ WSL2間で`localhost`が自動的に転送される
- IPアドレスの変更を気にする必要がない
- 設定がシンプル

**推奨設定**:
```
プロキシアドレス: localhost:1080
```

## IPアドレス問題と解決策

### 問題: WSL2のIPアドレスが起動ごとに変わる

WSL2のIPアドレスは、デフォルトで起動ごとに動的に割り当てられます。

```bash
# 今回の起動
172.20.10.5

# 次回の起動
172.20.15.8  # 変わる！
```

### 解決策1: localhostを使用（最も簡単）

**適用条件**:
- Docker Desktop for Windowsを使用
- WSL2統合が有効

**設定**:
```
# Edgeショートカット
--proxy-server="socks5://localhost:1080"

# SSH設定 (~/.ssh/config)
ProxyCommand nc -X 5 -x localhost:1080 %h %p
```

**利点**:
- ✅ 設定不要
- ✅ IPアドレス変更の影響なし
- ✅ シンプル

**欠点**:
- ❌ Docker Desktop for Windowsが必要

### 解決策2: WSL2のIPアドレスを固定

WSL2に静的IPアドレスを割り当てます。

#### 方法A: .wslconfig での設定（推奨）

**Windows側** (`%USERPROFILE%\.wslconfig`):

```ini
[wsl2]
# WSL2のネットワーク設定
networkingMode=bridged
vmSwitch=WSLBridge
ipv6=true

# メモリとCPU設定（オプション）
memory=4GB
processors=2
```

**WSL内** (`/etc/wsl.conf`):

```ini
[network]
generateResolvConf = false
```

**手順**:

1. Windows側で`.wslconfig`を作成/編集：
   ```powershell
   notepad $env:USERPROFILE\.wslconfig
   ```

2. WSL内で静的IPを設定：
   ```bash
   sudo tee /etc/netplan/99-wsl-static.yaml <<EOF
   network:
     version: 2
     ethernets:
       eth0:
         dhcp4: no
         addresses:
           - 192.168.50.2/24
         gateway4: 192.168.50.1
         nameservers:
           addresses:
             - 8.8.8.8
             - 8.8.4.4
   EOF

   sudo netplan apply
   ```

3. WSLを再起動：
   ```powershell
   wsl --shutdown
   wsl
   ```

**利点**:
- ✅ 完全に固定されたIPアドレス
- ✅ 外部からのアクセスが可能

**欠点**:
- ❌ 設定がやや複雑
- ❌ ネットワーク環境によっては動作しない

#### 方法B: スタートアップスクリプトで固定

**PowerShell スクリプト** (`Set-WSLStaticIP.ps1`):

```powershell
# WSL2に静的IPを割り当て
$wslIP = "192.168.50.2"
$winIP = "192.168.50.1"
$subnet = "255.255.255.0"

# Windows側のネットワークアダプターを取得
$adapter = Get-NetAdapter -Name "vEthernet (WSL)"

# WSL側のIPを設定
wsl -d Ubuntu -u root ip addr add $wslIP/24 broadcast 192.168.50.255 dev eth0

# Windows側のIPを設定
New-NetIPAddress -IPAddress $winIP -PrefixLength 24 -InterfaceIndex $adapter.ifIndex
```

**タスクスケジューラで自動実行**:

1. タスクスケジューラを起動
2. 「基本タスクの作成」
3. トリガー: ログオン時
4. 操作: プログラムの起動
   - プログラム: `powershell.exe`
   - 引数: `-ExecutionPolicy Bypass -File "C:\Path\To\Set-WSLStaticIP.ps1"`

### 解決策3: ホスト名での解決

動的IPでもホスト名でアクセス可能にします。

#### 方法A: mDNS (Avahi) を使用

**WSL内でAvahiをインストール**:

```bash
sudo apt update
sudo apt install avahi-daemon

# ホスト名を設定
sudo hostnamectl set-hostname wsl-tvpn

# Avahi設定
sudo tee /etc/avahi/avahi-daemon.conf <<EOF
[server]
host-name=wsl-tvpn
domain-name=local
use-ipv4=yes
use-ipv6=no
EOF

# サービスを起動
sudo service avahi-daemon start
```

**Windows側からアクセス**:

```
プロキシアドレス: socks5://wsl-tvpn.local:1080
```

**注意**: Windowsで Bonjour サービス（iTunesなどに含まれる）が必要な場合があります。

#### 方法B: Windowsのhostsファイルを使用

**自動更新スクリプト** (`Update-WSLHosts.ps1`):

```powershell
# WSLのIPアドレスを取得
$wslIP = wsl hostname -I | ForEach-Object { $_.Trim() }

# hostsファイルのパス
$hostsFile = "C:\Windows\System32\drivers\etc\hosts"

# 既存のWSLエントリを削除
$hosts = Get-Content $hostsFile | Where-Object { $_ -notmatch "wsl-tvpn" }

# 新しいエントリを追加
$hosts += "$wslIP wsl-tvpn"

# hostsファイルを更新
Set-Content -Path $hostsFile -Value $hosts -Force
```

**タスクスケジューラで自動実行** (ログオン時):

**Windows側からアクセス**:

```
プロキシアドレス: socks5://wsl-tvpn:1080
```

### 解決策4: PowerShellラッパースクリプト

プロキシアドレスを動的に取得するスクリプトです。

**Get-WSLProxyAddress.ps1**:

```powershell
# WSLのIPアドレスを取得
$wslIP = wsl hostname -I | ForEach-Object { $_.Trim() }

Write-Host "Current WSL IP: $wslIP"
Write-Host "SOCKS5 Proxy: socks5://${wslIP}:1080"

# クリップボードにコピー
Set-Clipboard -Value "socks5://${wslIP}:1080"
Write-Host "Proxy address copied to clipboard!"
```

**使用方法**:

1. スクリプトを実行してプロキシアドレスを取得
2. クリップボードにコピーされたアドレスを設定に貼り付け

## 推奨アプローチの比較

| 方法 | 難易度 | 安定性 | 推奨度 |
|------|--------|--------|--------|
| localhost (Docker Desktop) | ⭐ | ⭐⭐⭐⭐⭐ | ✅ 最推奨 |
| IPアドレス固定 (.wslconfig) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ 推奨 |
| IPアドレス固定 (スクリプト) | ⭐⭐⭐ | ⭐⭐⭐ | ⚠️ 条件付き |
| mDNS (Avahi) | ⭐⭐⭐ | ⭐⭐⭐ | ⚠️ 条件付き |
| hostsファイル自動更新 | ⭐⭐ | ⭐⭐⭐⭐ | ✅ 推奨 |
| PowerShellラッパー | ⭐ | ⭐⭐ | ❌ 非推奨 |

## 実践的なセットアップフロー

### 初心者向け: localhost方式

```bash
# 1. Docker Desktop for Windowsをインストール
# 2. WSL2統合を有効化
# 3. プロキシ設定
```

**Edgeショートカット**:
```
--proxy-server="socks5://localhost:1080"
```

**SSH設定**:
```ssh-config
Host *.u-tokyo.ac.jp
    ProxyCommand nc -X 5 -x localhost:1080 %h %p
```

### 中級者向け: hostsファイル自動更新

```powershell
# 1. Update-WSLHosts.ps1 を作成
# 2. タスクスケジューラで自動実行設定
# 3. プロキシ設定
```

**Edgeショートカット**:
```
--proxy-server="socks5://wsl-tvpn:1080"
```

**SSH設定**:
```ssh-config
Host *.u-tokyo.ac.jp
    ProxyCommand nc -X 5 -x wsl-tvpn:1080 %h %p
```

### 上級者向け: 完全な静的IP

```ini
# .wslconfig設定
# netplan設定
# ファイアウォール設定
```

**Edgeショートカット**:
```
--proxy-server="socks5://192.168.50.2:1080"
```

## トラブルシューティング

### IPアドレスが取得できない

```bash
# WSL内で
ip addr show eth0
```

IPアドレスがない場合:
```bash
sudo dhclient eth0
```

### localhostで接続できない

**確認事項**:

1. Docker Desktop for Windowsが起動しているか
2. WSL2統合が有効か（設定→Resources→WSL Integration）
3. ファイアウォールがブロックしていないか

**テスト**:
```powershell
Test-NetConnection -ComputerName localhost -Port 1080
```

### mDNSが動作しない

**Windows側で**:

1. Bonjour サービスがインストールされているか確認
2. または、[Bonjour Print Services](https://support.apple.com/kb/DL999)をインストール

### 静的IP設定後にインターネットに接続できない

**DNS設定を確認**:

```bash
# /etc/resolv.conf を確認
cat /etc/resolv.conf

# 手動で設定
sudo tee /etc/resolv.conf <<EOF
nameserver 8.8.8.8
nameserver 8.8.4.4
EOF
```

## パフォーマンス最適化

### MTUサイズの調整

```bash
# WSL内で
sudo ip link set dev eth0 mtu 1400
```

### TCP最適化

```bash
# /etc/sysctl.conf に追加
net.ipv4.tcp_window_scaling = 1
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
```

適用:
```bash
sudo sysctl -p
```

## セキュリティ考慮事項

### ファイアウォール設定

**Windowsファイアウォール**:

WSL2へのアクセスを許可（必要に応じて）:

```powershell
New-NetFirewallRule -DisplayName "WSL SOCKS5 Proxy" -Direction Inbound -LocalPort 1080 -Protocol TCP -Action Allow
```

### プロキシの認証（オプション）

より安全に運用したい場合は、Dante設定で認証を有効化：

```conf
# /etc/danted.conf
socksmethod: username
user.privileged: root
user.notprivileged: proxy-user
```

ユーザー作成:
```bash
sudo adduser proxy-user
```

## まとめ

### 推奨設定パターン

**最もシンプル（初心者向け）**:
```
✅ Docker Desktop for Windows
✅ localhost:1080
```

**バランス型（推奨）**:
```
✅ hostsファイル自動更新
✅ wsl-tvpn:1080
```

**完全制御（上級者向け）**:
```
✅ 静的IPアドレス (.wslconfig)
✅ 192.168.50.2:1080
```

どの方法を選んでも、T-VPNプロキシは正常に動作します。環境と用途に応じて選択してください。

## 次のステップ

- [WSL環境でのセットアップ](./WSL_SETUP.md)
- [Windows EdgeでのProxy設定](./EDGE_PROXY_SETUP.md)
- [SSHでのProxy使用方法](./SSH_PROXY_SETUP.md)
