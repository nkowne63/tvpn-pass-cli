@echo off
echo Stopping T-VPN Proxy...
wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose down"
echo T-VPN Proxy stopped.
pause
