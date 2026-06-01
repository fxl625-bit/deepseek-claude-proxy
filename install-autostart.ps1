# DeepSeek Claude Code Proxy - Auto-start with Windows
# Shortcut placed in Startup folder

$WshShell = New-Object -ComObject WScript.Shell
$StartupFolder = $WshShell.SpecialFolders("Startup")
$ShortcutPath = Join-Path $StartupFolder "DeepSeek Proxy for Claude Code.lnk"
$TargetPath = "F:\CODEX\deepseek-proxy\start-proxy.vbs"
$WorkingDir = "F:\CODEX\deepseek-proxy"

# Create shortcut in Startup folder
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = $WorkingDir
$Shortcut.Description = "DeepSeek Proxy - Claude Code Format Converter"
$Shortcut.Save()

Write-Host "Done. Shortcut created: $ShortcutPath"
Write-Host "Proxy will start silently on next login."
