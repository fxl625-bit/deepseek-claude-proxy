Set WshShell = CreateObject("WScript.Shell")
Set Fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = Fso.GetParentFolderName(WScript.ScriptFullName)
ProxyPath = Fso.BuildPath(ScriptDir, "deepseek-proxy.mjs")

' Kill any existing proxy process
On Error Resume Next
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where CommandLine Like '%deepseek-proxy%' And Name = 'node.exe'")
For Each objProcess In colProcesses
  objProcess.Terminate()
Next
On Error GoTo 0

WScript.Sleep 1000

' Launch proxy hidden using node from PATH
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ""Set-Location -LiteralPath '" & Replace(ScriptDir, "'", "''") & "'; Start-Process -FilePath 'node' -ArgumentList '" & Replace(ProxyPath, "'", "''") & "' -WindowStyle Hidden""", 0, False
