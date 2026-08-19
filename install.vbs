' Silently installs the newest built Setup .exe from release\ with NO windows at all -
' the console-free alternative to install.bat (double-click this file to use it).
' Shows a small auto-closing popup when done.
Option Explicit

Dim fso, sh, scriptDir, releaseDir, folder, f, newest, newestDate, rc
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
releaseDir = scriptDir & "\release"

If Not fso.FolderExists(releaseDir) Then
  MsgBox "No release\ folder found next to this script." & vbCrLf & vbCrLf & _
         "Build an installer first (build-and-install.bat), or install the app from the GitHub Releases page.", _
         vbExclamation, "Solar & Battery Advisor"
  WScript.Quit 1
End If

newest = ""
newestDate = CDate("1900-01-01")
Set folder = fso.GetFolder(releaseDir)
For Each f In folder.Files
  If LCase(fso.GetExtensionName(f.Name)) = "exe" And InStr(f.Name, "Setup") > 0 Then
    If f.DateLastModified > newestDate Then
      newest = f.Path
      newestDate = f.DateLastModified
    End If
  End If
Next

If newest = "" Then
  MsgBox "No Setup .exe found in release\." & vbCrLf & vbCrLf & _
         "Build one first (build-and-install.bat), or install the app from the GitHub Releases page.", _
         vbExclamation, "Solar & Battery Advisor"
  WScript.Quit 1
End If

' 0 = hidden window, True = wait for the installer to finish
rc = sh.Run("""" & newest & """ /S", 0, True)

If rc = 0 Then
  ' Popup auto-closes after 6 seconds
  sh.Popup "Installed: " & fso.GetFileName(newest) & vbCrLf & "Find it in the Start Menu or on the desktop.", _
           6, "Solar & Battery Advisor", vbInformation
Else
  MsgBox "The installer exited with code " & rc & ".", vbExclamation, "Solar & Battery Advisor"
  WScript.Quit rc
End If
