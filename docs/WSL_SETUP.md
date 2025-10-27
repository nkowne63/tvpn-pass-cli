# WSL環境でのセットアップガイド

このガイドでは、WSL2内でT-VPN SOCKS5プロキシを実行し、Windows側からアクセスする方法を説明します。

## 前提条件

- Windows 10/11
- WSL2がインストールされていること
- Docker Desktop for Windows（WSL2統合が有効）

## 1. WSL2のセットアップ

### 1.1 WSL2のインストール（未インストールの場合）

PowerShellを管理者権限で開いて実行：

```powershell
wsl --install
```

### 1.2 Dockerのインストール

WSL2内で：

```bash
# Docker Desktop for Windowsを使用する場合は不要
# または、WSL2内に直接Dockerをインストール

curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

## 2. T-VPNプロキシの起動

### 2.1 リポジトリのクローン

```bash
cd ~
git clone <repository-url> tvpn-pass-cli
cd tvpn-pass-cli
```

### 2.2 環境変数の設定

```bash
cp .env.example .env
nano .env  # または vim, code など
```

以下の値を設定：
- `V_UID`: 東京大学のUID
- `V_PATTERN`: パターン番号（カンマ区切り）
- `V_STATIC`: 固定パスワード部分

### 2.3 Dockerコンテナの起動

```bash
docker-compose up -d
```

### 2.4 ログの確認

```bash
docker-compose logs -f
```

正常に接続されると、以下のようなログが表示されます：
```
[INFO] VPN connected successfully
[INFO] SOCKS5 proxy server started on port 1080
```

## 3. Windows側からのアクセス設定

### 3.1 WSLのIPアドレスを確認

WSL内で：

```bash
ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1
```

例: `172.20.10.5`

### 3.2 localhostでのアクセス（推奨）

Docker Desktop for Windowsを使用している場合、`localhost:1080`でアクセス可能です。

## 4. Windows側での動作確認

PowerShellで：

```powershell
# curlでSOCKS5プロキシ経由でアクセス
curl --socks5 localhost:1080 https://ipinfo.io/ip
```

VPN経由のIPアドレスが表示されれば成功です。

## 5. 自動起動の設定（オプション）

### 5.1 WSL起動時に自動起動

`~/.bashrc`または`~/.zshrc`に追加：

```bash
# Start T-VPN proxy on login
if [ $(docker ps -q -f name=tvpn-proxy | wc -l) -eq 0 ]; then
    cd ~/tvpn-pass-cli && docker-compose up -d
fi
```

### 5.2 Windowsログイン時にWSLを自動起動

`shell:startup`フォルダに以下のVBScriptを作成（`start-tvpn.vbs`）：

```vbscript
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "wsl -d Ubuntu -e bash -c 'cd ~/tvpn-pass-cli && docker-compose up -d'", 0, False
Set WshShell = Nothing
```

## トラブルシューティング

### プロキシに接続できない

1. Dockerコンテナが起動しているか確認：
   ```bash
   docker ps | grep tvpn-proxy
   ```

2. ポートが開いているか確認：
   ```bash
   netstat -an | grep 1080
   ```

3. ファイアウォール設定を確認

### VPN接続が失敗する

1. ログを確認：
   ```bash
   docker-compose logs
   ```

2. 認証情報が正しいか確認（`.env`ファイル）

3. パターン番号が正しいか確認（README.mdの対応表を参照）

### 定期的に切断される

`RECONNECT_INTERVAL`の値を調整：

```bash
# .envファイル
RECONNECT_INTERVAL=180  # 3分ごとにチェック
```

## 次のステップ

- [Windows EdgeでのProxy設定](./EDGE_PROXY_SETUP.md)
- [SSHでのProxy使用方法](./SSH_PROXY_SETUP.md)
- [IP固定化とドメイン設定](./NETWORKING.md)
