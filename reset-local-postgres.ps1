$ErrorActionPreference = "Stop"

$serviceName = "postgresql-x64-18"
$postgresDirectory = "C:\Program Files\PostgreSQL\18"
$configPath = Join-Path $postgresDirectory "data\pg_hba.conf"
$psqlPath = Join-Path $postgresDirectory "bin\psql.exe"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run this script from an Administrator PowerShell terminal."
}

if (-not (Test-Path -LiteralPath $configPath) -or -not (Test-Path -LiteralPath $psqlPath)) {
  throw "PostgreSQL 18 was not found at its expected installation path."
}

$passwordSecure = Read-Host "Enter the new PostgreSQL postgres-user password" -AsSecureString
if ($passwordSecure.Length -eq 0) {
  throw "The password cannot be empty."
}
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($passwordSecure)

$backupPath = Join-Path $env:TEMP ("pg_hba.conf.reset-" + [guid]::NewGuid().ToString("N") + ".bak")
$configChanged = $false
$serviceWasRunning = $false

try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $service = Get-Service -Name $serviceName
  if ($service.Status -ne "Running") {
    throw "The PostgreSQL service is not running."
  }
  $serviceWasRunning = $true

  $originalConfig = [IO.File]::ReadAllText($configPath)
  $lines = $originalConfig -split "\r?\n"
  $matchedAddresses = @{}
  $updatedLines = foreach ($line in $lines) {
    if ($line -match "^\s*host(?:ssl|nossl)?\s+\S+\s+\S+\s+(127\.0\.0\.1/32|::1/128)\s+") {
      $address = $Matches[1]
      $matchedAddresses[$address] = $true
      [regex]::Replace(
        $line,
        "^(\s*host(?:ssl|nossl)?\s+\S+\s+\S+\s+(?:127\.0\.0\.1/32|::1/128)\s+)\S+",
        '$1trust',
        1
      )
    } else {
      $line
    }
  }

  if (-not $matchedAddresses.ContainsKey("127.0.0.1/32") -or
      -not $matchedAddresses.ContainsKey("::1/128")) {
    throw "Could not find both localhost rules in pg_hba.conf. No configuration was changed."
  }

  Copy-Item -LiteralPath $configPath -Destination $backupPath
  Stop-Service -Name $serviceName
  (Get-Service -Name $serviceName).WaitForStatus("Stopped", [TimeSpan]::FromSeconds(30))
  $configChanged = $true
  [IO.File]::WriteAllText(
    $configPath,
    ($updatedLines -join [Environment]::NewLine),
    [Text.UTF8Encoding]::new($false)
  )
  Start-Service -Name $serviceName
  (Get-Service -Name $serviceName).WaitForStatus("Running", [TimeSpan]::FromSeconds(30))

  $startInfo = [Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $psqlPath
  $startInfo.Arguments = "-X -w -h 127.0.0.1 -p 5432 -U postgres -d postgres"
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  [void]$process.Start()
  $sqlPassword = $password.Replace("'", "''")
  $process.StandardInput.WriteLine("ALTER ROLE postgres WITH PASSWORD '$sqlPassword';")
  $process.StandardInput.Close()
  $output = $process.StandardOutput.ReadToEnd()
  $errorOutput = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) {
    throw "PostgreSQL password reset failed: $errorOutput"
  }
  Write-Output "PostgreSQL password reset succeeded."
}
finally {
  if (Test-Path -LiteralPath $backupPath) {
    try {
      if ($configChanged) {
        if ((Get-Service -Name $serviceName).Status -eq "Running") {
          Stop-Service -Name $serviceName
          (Get-Service -Name $serviceName).WaitForStatus("Stopped", [TimeSpan]::FromSeconds(30))
        }
        Copy-Item -LiteralPath $backupPath -Destination $configPath -Force
        if ($serviceWasRunning) {
          Start-Service -Name $serviceName
          (Get-Service -Name $serviceName).WaitForStatus("Running", [TimeSpan]::FromSeconds(30))
        }
        Write-Output "Restored the original pg_hba.conf and restarted PostgreSQL."
      }
      Remove-Item -LiteralPath $backupPath -Force
    }
    catch {
      throw "Could not restore PostgreSQL authentication settings. Restore the backup at '$backupPath' to '$configPath' and restart the service. Details: $($_.Exception.Message)"
    }
  }
}

try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $envPath = Join-Path $PSScriptRoot ".env"
  $envText = [IO.File]::ReadAllText($envPath)
  $databaseUrl = "postgresql://postgres:$([Uri]::EscapeDataString($password))@localhost:5432/azza_expenditure?schema=public"
  $databaseUrlSetting = 'DATABASE_URL="' + $databaseUrl + '"'
  $databaseUrlPattern = [regex]::new("(?m)^\s*DATABASE_URL\s*=.*$")
  if ($databaseUrlPattern.Matches($envText).Count -ne 1) {
    throw "Expected exactly one DATABASE_URL setting in the project .env file."
  }
  $envText = $databaseUrlPattern.Replace($envText, $databaseUrlSetting, 1)
  [IO.File]::WriteAllText($envPath, $envText, [Text.UTF8Encoding]::new($false))
  Write-Output "Updated DATABASE_URL in .env."

  Push-Location $PSScriptRoot
  try {
    & npm run db:migrate
    if ($LASTEXITCODE -ne 0) {
      throw "Prisma migration failed with exit code $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }
}
finally {
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
}
