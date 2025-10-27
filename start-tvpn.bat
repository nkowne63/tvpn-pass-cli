@echo off
echo Starting T-VPN Proxy...
wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose up -d"
timeout /t 3
echo Checking connection...
wsl -d Ubuntu bash -c "cd ~/tvpn-pass-cli && docker-compose logs --tail=20"
echo.
echo T-VPN Proxy is ready!
pause
