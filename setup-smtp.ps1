$hostName = Read-Host 'SMTP host (for Gmail: smtp.gmail.com)'
$port = Read-Host 'SMTP port (usually 587)'
$secure = Read-Host 'Use SSL immediately? (true for port 465, otherwise false)'
$user = Read-Host 'SMTP username/email address'
$passwordInput = Read-Host 'SMTP password or app password (input is hidden)' -AsSecureString
$password = [System.Net.NetworkCredential]::new('', $passwordInput).Password
$from = Read-Host "From address (press Enter to use $user)"
if ([string]::IsNullOrWhiteSpace($from)) { $from = $user }

@"
PORT=4000
SMTP_HOST=$hostName
SMTP_PORT=$port
SMTP_SECURE=$secure
SMTP_USER=$user
SMTP_PASS=$password
SMTP_FROM=$from
"@ | Set-Content -Path .env -Encoding ascii

Write-Host 'SMTP settings saved to .env. Restart the API with: npm run dev:server'