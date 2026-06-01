# Uninstall auto-start shortcut
$WshShell = New-Object -ComObject WScript.Shell
$StartupFolder = $WshShell.SpecialFolders("Startup")
$ShortcutPath = Join-Path $StartupFolder "DeepSeek Proxy for Claude Code.lnk"

if (Test-Path $ShortcutPath) {
    Remove-Item $ShortcutPath -Force
    Write-Host "Removed: $ShortcutPath"
} else {
    Write-Host "Auto-start shortcut not found."
}
