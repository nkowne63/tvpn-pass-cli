@echo off
echo Checking T-VPN Proxy status...
wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose ps"
echo.
echo Recent logs:
wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose logs --tail=10"
pause
