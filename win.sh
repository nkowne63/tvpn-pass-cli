source ./.env
V_PASS=$(node --no-deprecation ./index.mjs)
V_NAME="T-VPN(UTokyo eng)"
echo "connect to $V_NAME as $V_UID by $V_PASS"
rasdial.exe "$V_NAME" $V_UID $V_PASS