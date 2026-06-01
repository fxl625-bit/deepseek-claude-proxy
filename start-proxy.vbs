Set WshShell = CreateObject("WScript.Shell")

' Kill any existing proxy process
On Error Resume Next
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where CommandLine Like '%deepseek-proxy%' And Name = 'node.exe'")
For Each objProcess In colProcesses
  objProcess.Terminate()
Next
On Error GoTo 0

WScript.Sleep 1000

' Launch proxy hidden (PowerShell Start-Process -WindowStyle Hidden)
WshShell.Run "powershell.exe -Command ""Start-Process -FilePath 'C:\Users\yckj0094\.workbuddy\binaries\node\versions\22.22.2\node.exe' -ArgumentList 'F:\CODEX\deepseek-proxy\deepseek-proxy.mjs' -WindowStyle Hidden""", 0, False
