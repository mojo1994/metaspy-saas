@echo off
setlocal EnableExtensions
set "PS=%TEMP%\jarvis_metaspy.ps1"
mode con: cols=92 lines=30 >nul 2>nul
title J.A.R.V.I.S  -  MetaSpy Startup
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$f=Get-Content -Raw -Encoding UTF8 -LiteralPath '%~f0'; $b='<JARVIS_PS1'+'_BEGIN>'; $e='<JARVIS_PS1'+'_END>'; $i=$f.IndexOf($b); $j=$f.IndexOf($e); if ($i -ge 0 -and $j -gt $i) { $c=$f.Substring($i+$b.Length,$j-$i-$b.Length); Set-Content -LiteralPath (Join-Path $env:TEMP 'jarvis_metaspy.ps1') -Value $c -Encoding UTF8 } else { exit 1 }"
if errorlevel 1 goto :fail
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS%" "%~dp0"
del "%PS%" >nul 2>nul
exit /b 0
:fail
echo.
echo  [JARVIS] Falha ao carregar a interface embutida.
echo  Verifique se o arquivo nao foi corrompido.
echo.
pause
exit /b 1
<JARVIS_PS1_BEGIN>
param([string]$Root,[switch]$SelfTest)
if($Root -and (Test-Path -LiteralPath $Root)){ try { Set-Location -LiteralPath $Root } catch {} }

$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$script:Running = $true
$script:Mouse = $false
$script:GotIn = $false
$script:GotOut = $false

$ESC  = [char]27
$RST  = "$ESC[0m"
$BOLD = "$ESC[1m"
$DIM  = "$ESC[2m"
$RED  = "$ESC[31m"
$GRN  = "$ESC[32m"
$YEL  = "$ESC[33m"
$BLU  = "$ESC[34m"
$MAG  = "$ESC[35m"
$CYN  = "$ESC[36m"
$WHT  = "$ESC[97m"
$BRC  = "$ESC[96m"
$BGR  = "$ESC[92m"
$BRED = "$ESC[91m"

try {
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CJ {
    [DllImport("kernel32.dll", SetLastError=true)] public static extern bool SetConsoleMode(IntPtr h, uint mode);
    [DllImport("kernel32.dll", SetLastError=true)] public static extern bool GetConsoleMode(IntPtr h, out uint mode);
    [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr GetStdHandle(int n);
    [DllImport("kernel32.dll", SetLastError=true)] public static extern bool ReadConsoleInput(IntPtr h, out INPUT_RECORD rec, uint len, out uint num);
    [StructLayout(LayoutKind.Sequential)] public struct INPUT_RECORD { public ushort EventType; public MOUSE_EVENT_RECORD MouseEvent; }
    [StructLayout(LayoutKind.Sequential)] public struct MOUSE_EVENT_RECORD { public COORD dwMousePosition; public uint dwButtonState; public uint dwControlKeyState; public uint dwEventFlags; }
    [StructLayout(LayoutKind.Sequential)] public struct COORD { public short X; public short Y; }
}
'@
  $script:Mouse = $true
} catch { $script:Mouse = $false }

if($script:Mouse){
  try {
    $script:STD_IN  = [CJ]::GetStdHandle(-10)
    $script:STD_OUT = [CJ]::GetStdHandle(-11)
    [CJ]::GetConsoleMode($script:STD_IN,  [ref]$script:OrigIn)  | Out-Null; $script:GotIn  = $true
    [CJ]::GetConsoleMode($script:STD_OUT, [ref]$script:OrigOut) | Out-Null; $script:GotOut = $true
    [CJ]::SetConsoleMode($script:STD_IN, 0x9F) | Out-Null
    [CJ]::SetConsoleMode($script:STD_OUT, 0x7) | Out-Null
  } catch {}
}

try { [Console]::Title = 'J.A.R.V.I.S - MetaSpy Startup' } catch {}
try { [Console]::CursorVisible = $false } catch {}
try { [Console]::WindowWidth = 92; [Console]::WindowHeight = 30 } catch {}
try { [Console]::BufferWidth = 92; [Console]::BufferHeight = 30 } catch {}
try { [Console]::Clear() } catch {}

$script:ConfigPath = Join-Path $env:USERPROFILE '.metaspy-jarvis.json'
function Get-JarvisConfig {
  if(Test-Path -LiteralPath $script:ConfigPath){
    try { return (Get-Content -LiteralPath $script:ConfigPath -Raw | ConvertFrom-Json) } catch { return [pscustomobject]@{} }
  }
  return [pscustomobject]@{}
}
function Save-JarvisConfig($cfg){
  try { $cfg | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $script:ConfigPath -Encoding UTF8 } catch {}
}
$env:RENDER_API_KEY = $null
$env:RENDER_API_KEY = (Get-JarvisConfig).RENDER_API_KEY

$script:Log = New-Object System.Collections.ArrayList
function Add-Log([string]$m){
  [void]$script:Log.Add($m)
  if($script:Log.Count -gt 150){ $script:Log.RemoveAt(0) }
}

$script:Menu = @(
  @{ Key='1'; Label='Autenticar Cloudflare + Workers';      Action='AuthCF' },
  @{ Key='2'; Label='Autenticar Netlify';                   Action='AuthNT' },
  @{ Key='3'; Label='Autenticar Render (API Key)';          Action='AuthRD' },
  @{ Key='4'; Label='Autenticar GitHub (git identidade)';   Action='AuthGH' },
  @{ Key='5'; Label='Verificar Conexoes (live check)';      Action='Verify' },
  @{ Key='6'; Label='Commit & Push';                        Action='CommitPush' },
  @{ Key='7'; Label='Deploy Completo (Netlify + Workers)';  Action='Deploy' },
  @{ Key='8'; Label='Build (npm run build)';                Action='Build' },
  @{ Key='9'; Label='Sair';                                 Action='Quit' }
)
$script:BtnY = @{}
$script:Width = 92
$script:LogTop = 21
$script:LogLines = 5

function Draw-Line([int]$y,[string]$txt){
  try {
    [Console]::SetCursorPosition(0,$y)
    [Console]::Write(("$ESC[2K") + $txt)
  } catch {}
}
function Draw-Sep([int]$y,[string]$ch){
  try {
    $s = $ch * [Math]::Max(1, ($script:Width - 2))
    Draw-Line $y ("  " + $DIM + $s + $RST)
  } catch {}
}
function Get-QuickStatus {
  $s = @{}
  $g = (& git config --get user.email 2>$null | Out-String).Trim()
  $s.Git = if($g){"OK"}else{"--"}
  $s.CF = if(Test-Path (Join-Path $env:USERPROFILE '.wrangler\config\default.toml')){"OK"}else{"--"}
  $s.WK = if(Test-Path 'wrangler.toml'){"OK"}else{"--"}
  $s.NT = if(Test-Path (Join-Path $env:USERPROFILE '.netlify\config.json')){"OK"}else{"--"}
  $s.RD = if($env:RENDER_API_KEY){"OK"}else{"--"}
  return $s
}
function Draw-Status([int]$y){
  try {
    $s = Get-QuickStatus
    $items = @()
    foreach($pair in @(@('GIT',$s.Git),@('CLOUDFLARE',$s.CF),@('WORKERS',$s.WK),@('NETLIFY',$s.NT),@('RENDER',$s.RD))){
      $c = if($pair[1] -eq 'OK'){ "$BOLD$GRN OK $RST" } else { "$DIM -- $RST" }
      $items += ($YEL + $pair[0] + $RST + '[' + $c + ']')
    }
    Draw-Line $y ("  " + ($items -join '  '))
  } catch {}
}
function Draw-UI {
  $script:DrawError = $false
  try {
    try { $script:Width = [Math]::Min(92, [Console]::WindowWidth) } catch { $script:Width = 92 }
    $W = $script:Width
    $art = @(
      '+=================================================+',
      '|    J.A.R.V.I.S   -   META SPY STARTUP  (v1.0)   |',
      '|    agente de startup  |  commit | push | deploy  |',
      '+=================================================+'
    )
    for($i=0;$i -lt $art.Count;$i++){
      $ind = [Math]::Max(0, [int](($W - $art[$i].Length) / 2))
      Draw-Line (1 + $i) (" " * $ind + $BOLD + $BRC + $art[$i] + $RST)
    }
    $sub = 'integrado a: Cloudflare | Netlify | Render | GitHub'
    $ind = [Math]::Max(0, [int](($W - $sub.Length) / 2))
    Draw-Line 5 (" " * $ind + $CYN + $sub + $RST)
    Draw-Sep 6 '='
    Draw-Status 7
    Draw-Sep 8 '='
    Draw-Line 9 ("  " + $BOLD + $YEL + 'ACOES  (clique no item com o mouse ou use a tecla):' + $RST)
    for($i=0;$i -lt $script:Menu.Count;$i++){
      $y = 10 + $i
      $script:BtnY[$y] = $i
      $m = $script:Menu[$i]
      Draw-Line $y ("  " + $BGR + " [$($m.Key)] " + $RST + " " + $WHT + $m.Label + $RST)
    }
    Draw-Sep 19 '-'
    Draw-Line 20 ("  " + $BOLD + $YEL + 'LOG JARVIS:' + $RST)
    for($i=0;$i -lt $script:LogLines;$i++){
      $idx = $script:Log.Count - $script:LogLines + $i
      $txt = ''
      if($idx -ge 0){ $txt = [string]$script:Log[$idx] }
      if($txt.Length -gt ($W - 6)){ $txt = $txt.Substring(0, $W - 9) + '...' }
      Draw-Line (21 + $i) ("  " + $DIM + '|' + $RST + ' ' + $txt)
    }
    Draw-Sep 26 '-'
    Draw-Line 27 ("  " + $BRC + 'ESC / [9]' + $RST + ' sair     ' + $BRC + '[6]' + $RST + ' commit+push     ' + $BRC + '[7]' + $RST + ' deploy     clique nos itens com o mouse')
  } catch { $script:DrawError = $true }
}

function Prompt-Value([string]$label,[string]$def){
  try {
    $v = Read-Host $label
    if([string]::IsNullOrWhiteSpace($v)){ return $def }
    return $v.Trim()
  } catch { return $def }
}
function Set-QuickEdit([bool]$on){
  if(!$script:Mouse){ return }
  try {
    if($on){ [CJ]::SetConsoleMode($script:STD_IN, ($script:OrigIn -bor 0x40 -bor 0x10 -bor 0x80)) | Out-Null }
    else    { [CJ]::SetConsoleMode($script:STD_IN, 0x9F) | Out-Null }
  } catch {}
}

function Run-Action($a){
  switch($a){
    'AuthCF' {
      Add-Log ">> [1] Autenticando CLOUDFLARE + WORKERS (wrangler login)..."
      Add-Log ">> Se um navegador abrir, autorize e volte aqui."
      Draw-UI
      try { & npx.cmd -y wrangler login 2>&1 | ForEach-Object { Add-Log ("   " + $_) } }
      catch { Add-Log ("   ERRO: " + $_.Exception.Message) }
      Add-Log ">> Autenticacao Cloudflare finalizada."
    }
    'AuthNT' {
      Add-Log ">> [2] Autenticando NETLIFY (netlify login)..."
      Add-Log ">> Sera aberto um navegador para autorizacao."
      Draw-UI
      try { & npx.cmd -y netlify login 2>&1 | ForEach-Object { Add-Log ("   " + $_) } }
      catch { Add-Log ("   ERRO: " + $_.Exception.Message) }
      Add-Log ">> Autenticacao Netlify finalizada."
    }
    'AuthRD' {
      Set-QuickEdit $true
      try { [Console]::CursorVisible = $true } catch {}
      $k = Prompt-Value '   Digite sua Render API Key (vazio = cancela)' ''
      try { [Console]::CursorVisible = $false } catch {}
      Set-QuickEdit $false
      if($k){
        $env:RENDER_API_KEY = $k
        $cfg = Get-JarvisConfig
        $cfg | Add-Member -NotePropertyName 'RENDER_API_KEY' -NotePropertyValue $k -Force
        Save-JarvisConfig $cfg
        Add-Log ">> [3] Render API Key salva com sucesso em ~/.metaspy-jarvis.json"
      } else { Add-Log ">> [3] Nenhuma chave informada." }
    }
    'AuthGH' {
      Set-QuickEdit $true
      try { [Console]::CursorVisible = $true } catch {}
      $n = (& git config --global user.name 2>$null | Out-String).Trim()
      if(!$n){ $n = Prompt-Value '   Nome para commits (Enter = mojo1994)' 'mojo1994'; & git config --global user.name $n | Out-Null }
      $e = (& git config --global user.email 2>$null | Out-String).Trim()
      if(!$e){ $e = Prompt-Value '   Email para commits (Enter = mojo1994@users.noreply.github.com)' 'mojo1994@users.noreply.github.com'; & git config --global user.email $e | Out-Null }
      try { [Console]::CursorVisible = $false } catch {}
      Set-QuickEdit $false
      Add-Log ">> [4] Identidade git garantida: $n <$e>"
      & git ls-remote origin HEAD *> $null
      if($LASTEXITCODE -eq 0){ Add-Log ">> GitHub CONECTADO: origin acessivel." }
      else { Add-Log ">> GitHub: origin inacessivel (git pedira credenciais no push)." }
    }
    'Verify' {
      Add-Log ">> [5] VERIFICANDO CONEXOES... (1o uso do npx pode demorar)"
      Draw-UI
      Add-Log "   > GitHub (git ls-remote)..."
      & git ls-remote origin HEAD *> $null
      if($LASTEXITCODE -eq 0){ Add-Log "     GitHub: CONECTADO" } else { Add-Log "     GitHub: OFFLINE / sem credencial" }
      Draw-UI
      Add-Log "   > Cloudflare + Workers (wrangler whoami)..."
      $o = ''
      try { $o = (& npx.cmd -y wrangler whoami 2>&1 | Out-String).Trim() } catch { $o = $_.Exception.Message }
      if($o -match 'Logged in as'){ Add-Log "     Cloudflare: CONECTADO" } else { Add-Log "     Cloudflare: precisa login [1]" }
      if($o){ Add-Log ("     -> " + $o.Substring(0,[Math]::Min(76,$o.Length))) }
      Draw-UI
      Add-Log "   > Netlify (netlify status)..."
      $o = ''
      try { $o = (& npx.cmd -y netlify status 2>&1 | Out-String).Trim() } catch { $o = $_.Exception.Message }
      if($o -match 'Logged in as'){ Add-Log "     Netlify: CONECTADO" } else { Add-Log "     Netlify: precisa login [2]" }
      if($o){ Add-Log ("     -> " + $o.Substring(0,[Math]::Min(76,$o.Length))) }
      Draw-UI
      Add-Log "   > Render (API)..."
      if($env:RENDER_API_KEY){
        try { Invoke-RestMethod -Uri 'https://api.render.com/v1/services' -Headers @{ Authorization = "Bearer $env:RENDER_API_KEY" } -TimeoutSec 20 -ErrorAction Stop | Out-Null; Add-Log "     Render: CONECTADO" }
        catch { Add-Log ("     Render: FALHA - " + $_.Exception.Message) }
      } else { Add-Log "     Render: sem API key (use botao [3])" }
      Add-Log ">> Verificacao concluida."
    }
    'CommitPush' {
      Draw-UI
      Add-Log ">> [6] Commit & Push..."
      & git add -A 2>&1 | ForEach-Object { Add-Log ("   " + $_) }
      $staged = [int](& git status --short 2>$null | Measure-Object -Line).Lines
      Add-Log "   Arquivos alterados: $staged"
      if($staged -eq 0){ Add-Log "   Nada para commitar."; break }
      Set-QuickEdit $true
      try { [Console]::CursorVisible = $true } catch {}
      $msg = Prompt-Value '   Mensagem do commit (Enter = auto)' ''
      try { [Console]::CursorVisible = $false } catch {}
      Set-QuickEdit $false
      if([string]::IsNullOrWhiteSpace($msg)){ $msg = "deploy: " + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
      Add-Log "   Commit: $msg"
      & git commit -m $msg 2>&1 | ForEach-Object { Add-Log ("   " + $_) }
      if($LASTEXITCODE -eq 0){
        Add-Log "   Enviando para origin/main..."
        Draw-UI
        & git push origin main 2>&1 | ForEach-Object { Add-Log ("   " + $_) }
        if($LASTEXITCODE -eq 0){ Add-Log ">> PUSH OK - Render iniciara auto-deploy." }
        else { Add-Log ">> PUSH FALHOU - verifique credenciais (botao [4])." }
      }
    }
    'Deploy' {
      Add-Log ">> [7] DEPLOY COMPLETO..."
      Draw-UI
      Add-Log "   [1/3] Build (npm run build)..."
      & npm.cmd run build 2>&1 | ForEach-Object { Add-Log ("   " + $_) }
      if($LASTEXITCODE -ne 0){ Add-Log "   BUILD FALHOU - deploy abortado."; break }
      Add-Log "   Build OK."
      Draw-UI
      Add-Log "   [2/3] Deploy NETLIFY (dist)..."
      & npx.cmd -y netlify deploy --prod --dir dist 2>&1 | ForEach-Object { Add-Log ("   " + $_) }
      Add-Log "   Netlify concluido."
      Draw-UI
      Add-Log "   [3/3] Deploy CLOUDFLARE WORKERS..."
      & npx.cmd -y wrangler deploy 2>&1 | ForEach-Object { Add-Log ("   " + $_) }
      Add-Log ">> Deploy concluido. Render dispara via push automatico."
    }
    'Build' {
      Add-Log ">> [8] Build (npm run build)..."
      Draw-UI
      & npm.cmd run build 2>&1 | ForEach-Object { Add-Log ("   " + $_) }
      if($LASTEXITCODE -eq 0){ Add-Log ">> Build OK." } else { Add-Log ">> Build FALHOU." }
    }
    'Quit' { $script:Running = $false }
    default { Add-Log ">> Acao desconhecida." }
  }
}

Add-Log 'JARVIS iniciado. MetaSpy Startup online.'
Add-Log 'Dica: [5] verifica conexoes | [6] commit+push | [7] deploy.'

if($SelfTest){
  Draw-UI
  Write-Host ''
  if($script:DrawError){ Write-Host 'SELFTEST: desenho com erro (sem console?)' } else { Write-Host 'SELFTEST OK' }
  exit 0
}

try {
  while($script:Running){
    Draw-UI
    if($script:Mouse){
      try {
        $rec = [CJ+INPUT_RECORD]::new()
        $n = [uint32]0
        [CJ]::ReadConsoleInput($script:STD_IN, [ref]$rec, 1, [ref]$n) | Out-Null
      } catch { Start-Sleep -Milliseconds 60; continue }
      if($n -eq 0 -or $rec.EventType -eq 0){ Start-Sleep -Milliseconds 40; continue }
      if($rec.EventType -eq 2){
        $me = $rec.MouseEvent
        if($me.dwEventFlags -eq 0 -and ($me.dwButtonState -band 1) -eq 1){
          $idx = $script:BtnY[[int]$me.dwMousePosition.Y]
          if($null -ne $idx){ Run-Action $script:Menu[$idx].Action }
        }
      } elseif($rec.EventType -eq 1){
        $me = $rec.MouseEvent
        if($me.dwMousePosition.X -ne 0){
          $ch = [char]($me.dwControlKeyState -band 0xFFFF)
          $vk = ($me.dwButtonState -band 0xFFFF)
          if($vk -eq 27 -or $ch -eq 'q' -or $ch -eq 'Q'){ $script:Running = $false }
          elseif($ch -ge '1' -and $ch -le '9'){
            $i = [int]$ch - 49
            if($i -ge 0 -and $i -lt $script:Menu.Count){ Run-Action $script:Menu[$i].Action }
          }
        }
      }
    } else {
      try { $k = [Console]::ReadKey($true) } catch { Start-Sleep -Milliseconds 60; continue }
      $ch = $k.KeyChar
      if($k.Key -eq [ConsoleKey]::Escape){ $script:Running = $false }
      elseif($ch -ge '1' -and $ch -le '9'){
        $i = [int]$ch - 49
        if($i -ge 0 -and $i -lt $script:Menu.Count){ Run-Action $script:Menu[$i].Action }
      }
    }
  }
} finally {
  if($script:Mouse){
    if($script:GotIn) { try { [CJ]::SetConsoleMode($script:STD_IN, $script:OrigIn) } catch {} }
    if($script:GotOut){ try { [CJ]::SetConsoleMode($script:STD_OUT, $script:OrigOut) } catch {} }
  }
  try { [Console]::CursorVisible = $true } catch {}
  try { [Console]::Clear() } catch {}
  Write-Host ''
  Write-Host ("  " + $GRN + 'J.A.R.V.I.S encerrado. MetaSpy pronto para o deploy. Volte sempre!' + $RST)
  Write-Host ''
}
<JARVIS_PS1_END>
