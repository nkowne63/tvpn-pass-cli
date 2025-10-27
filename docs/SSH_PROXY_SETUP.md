# SSHでのProxy使用ガイド

このガイドでは、T-VPN SOCKS5プロキシ経由でSSH接続を行う方法を説明します。

## 概要

SOCKS5プロキシを使用することで、以下のような利点があります：

- 学内サーバーへの直接SSH接続
- ゲートウェイサーバーを経由せずにアクセス
- 複数のサーバーへの同時接続

## Windows環境での設定

### 前提条件

- OpenSSHクライアントがインストールされていること（Windows 10/11には標準搭載）
- T-VPNプロキシが起動していること

### 1. SSH設定ファイルの編集

#### 1.1 設定ファイルの場所

```
%USERPROFILE%\.ssh\config
```

存在しない場合は新規作成：

```powershell
# PowerShellで
New-Item -ItemType File -Path "$env:USERPROFILE\.ssh\config" -Force
notepad "$env:USERPROFILE\.ssh\config"
```

#### 1.2 基本設定

全ての接続でプロキシを使用する場合：

```ssh-config
# T-VPN経由の接続設定
Host *
    ProxyCommand C:\Windows\System32\OpenSSH\ssh.exe -W %h:%p -q -o "ProxyCommand=nc -X 5 -x localhost:1080 %h %p"
```

**注意**: Windowsの`nc`（netcat）がない場合は、代わりに`connect.exe`を使用：

```ssh-config
Host *
    ProxyCommand connect -S localhost:1080 %h %p
```

#### 1.3 connect.exeのインストール

[connect.c](https://bitbucket.org/gotoh/connect/src/master/)からダウンロードして、PATHの通った場所に配置します。

または、WSLの`nc`を使用：

```ssh-config
Host *
    ProxyCommand wsl nc -X 5 -x localhost:1080 %h %p
```

### 2. 特定のホストのみプロキシを使用

学内サーバーのみVPN経由でアクセス：

```ssh-config
# 東大サーバー用の設定
Host *.u-tokyo.ac.jp
    ProxyCommand wsl nc -X 5 -x localhost:1080 %h %p
    User your-username
    IdentityFile ~/.ssh/id_rsa

# 特定サーバーの設定例
Host utokyo-server
    HostName server.u-tokyo.ac.jp
    ProxyCommand wsl nc -X 5 -x localhost:1080 %h %p
    User your-username
    Port 22
```

### 3. SSH接続のテスト

```powershell
# 通常の接続
ssh your-username@server.u-tokyo.ac.jp

# エイリアスを使った接続
ssh utokyo-server
```

## WSL/Linux環境での設定

### 1. SSH設定ファイルの編集

```bash
nano ~/.ssh/config
```

### 2. プロキシ設定の追加

#### 2.1 ncコマンドを使用（推奨）

```ssh-config
# T-VPN経由の接続
Host *.u-tokyo.ac.jp
    ProxyCommand nc -X 5 -x localhost:1080 %h %p
    User your-username
```

#### 2.2 SSH自体のSOCKSサポートを使用

OpenSSH 7.6以降：

```ssh-config
Host *.u-tokyo.ac.jp
    ProxyJump socks5://localhost:1080
    User your-username
```

### 3. ncコマンドのインストール

Ubuntu/Debian:
```bash
sudo apt install netcat-openbsd
```

CentOS/RHEL:
```bash
sudo yum install nc
```

## 高度な設定

### 1. ポートフォワーディング

ローカルポートフォワーディング：

```bash
ssh -L 8080:internal-server:80 -o "ProxyCommand=nc -X 5 -x localhost:1080 %h %p" gateway.u-tokyo.ac.jp
```

リモートポートフォワーディング：

```bash
ssh -R 9090:localhost:8080 -o "ProxyCommand=nc -X 5 -x localhost:1080 %h %p" server.u-tokyo.ac.jp
```

### 2. 多段SSH（Jump Host）

```ssh-config
Host internal-server
    HostName internal.u-tokyo.ac.jp
    ProxyJump gateway.u-tokyo.ac.jp
    User your-username

Host gateway.u-tokyo.ac.jp
    ProxyCommand nc -X 5 -x localhost:1080 %h %p
    User your-username
```

接続：
```bash
ssh internal-server
```

### 3. SSH Agent Forwarding

```ssh-config
Host *.u-tokyo.ac.jp
    ProxyCommand nc -X 5 -x localhost:1080 %h %p
    ForwardAgent yes
    User your-username
```

## Git over SSHの設定

### 1. Git設定

```bash
# 特定のリポジトリでプロキシを使用
git config --global core.sshCommand "ssh -o 'ProxyCommand=nc -X 5 -x localhost:1080 %h %p'"
```

### 2. 特定のホストのみプロキシを使用

`~/.ssh/config`に設定を追加することで、Git SSHも同じプロキシ設定を使用します。

```bash
git clone git@github.com:your-org/your-repo.git
```

## VS Code Remote-SSHでの使用

### 1. VS Code設定

1. VS Codeで拡張機能「Remote - SSH」をインストール
2. `~/.ssh/config`の設定が自動的に使用されます

### 2. 接続

1. Ctrl+Shift+P → "Remote-SSH: Connect to Host..."
2. 設定したホスト名を選択

VS Codeは自動的にプロキシ経由で接続します。

## SCP/SFTP

### SCP

```bash
# ファイルのアップロード
scp -o "ProxyCommand=nc -X 5 -x localhost:1080 %h %p" local-file.txt user@server.u-tokyo.ac.jp:~/

# ファイルのダウンロード
scp -o "ProxyCommand=nc -X 5 -x localhost:1080 %h %p" user@server.u-tokyo.ac.jp:~/remote-file.txt ./
```

### SFTP

```bash
sftp -o "ProxyCommand=nc -X 5 -x localhost:1080 %h %p" user@server.u-tokyo.ac.jp
```

## トラブルシューティング

### 接続がタイムアウトする

**確認事項**:

1. プロキシが起動しているか：
   ```bash
   docker ps | grep tvpn-proxy
   ```

2. プロキシポートが開いているか：
   ```bash
   nc -zv localhost 1080
   ```

3. SSH詳細ログを確認：
   ```bash
   ssh -vvv user@server.u-tokyo.ac.jp
   ```

### "nc: command not found"

**解決方法**:

1. netcatをインストール
2. または`connect.exe`を使用
3. またはWSL経由でアクセス

### ProxyCommandが動作しない（Windows）

**解決方法**:

フルパスを指定：

```ssh-config
Host *.u-tokyo.ac.jp
    ProxyCommand C:\Windows\System32\OpenSSH\ssh.exe -W %h:%p -o "ProxyCommand=C:\path\to\nc.exe -X 5 -x localhost:1080 %h %p"
```

### 認証エラー

プロキシは認証情報を処理しません。SSH接続自体の認証が必要です：

```bash
# 公開鍵認証の設定
ssh-copy-id -o "ProxyCommand=nc -X 5 -x localhost:1080 %h %p" user@server.u-tokyo.ac.jp
```

## パフォーマンス最適化

### 接続の再利用

```ssh-config
Host *.u-tokyo.ac.jp
    ProxyCommand nc -X 5 -x localhost:1080 %h %p
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 600
```

ソケットディレクトリを作成：

```bash
mkdir -p ~/.ssh/sockets
```

これにより、同じサーバーへの複数接続が高速化されます。

### 圧縮の有効化

```ssh-config
Host *.u-tokyo.ac.jp
    ProxyCommand nc -X 5 -x localhost:1080 %h %p
    Compression yes
```

## セキュリティ考慮事項

### ホスト鍵の検証

初回接続時にホスト鍵を確認：

```bash
ssh-keyscan -t rsa server.u-tokyo.ac.jp >> ~/.ssh/known_hosts
```

### プロキシログの確認

接続ログを確認してセキュリティを監視：

```bash
docker-compose logs -f tvpn-proxy
```

## 次のステップ

- [デュアルEdge運用のベストプラクティス](./DUAL_EDGE_OPERATION.md)
- [IP固定化とドメイン設定](./NETWORKING.md)
- [WSL環境でのセットアップ](./WSL_SETUP.md)
