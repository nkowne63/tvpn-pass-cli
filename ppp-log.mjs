// pppd の logfile（debug）から、PAP 認証がサーバに拒否されたかを判定する。
// 拒否されたら同じパスワードで繰り返さないこと（T-VPN は失敗回数でアカウントをロックする）。
export function papRejected(logText) {
    return /rcvd \[PAP AuthNak|PAP authentication failed/.test(logText)
}
