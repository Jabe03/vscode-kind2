[CmdletBinding()]
param(
  [ValidateSet('x64', 'arm64')]
  [string]$Architecture = $(if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -eq 'Arm64') { 'arm64' } else { 'x64' })
)

$ErrorActionPreference = 'Stop'

$Z3Version = '4.13.0'
$Kind2Version = '3.0.0'
$ServerVersion = '0.5.0'

switch ($Architecture) {
  'x64' {
    $Z3OsVersion = 'x64-win'
    $Kind2OsVersion = 'windows-x86_64'
  }
  'arm64' {
    $Z3OsVersion = 'arm64-win'
    $Kind2OsVersion = 'windows-arm64'
  }
}

$Z3ZipName = "z3-$Z3Version-$Z3OsVersion"
$Kind2TarName = "kind2-v$Kind2Version-$Kind2OsVersion"

function Get-Archive {
  param(
    [Parameter(Mandatory)]
    [string]$Uri,
    [Parameter(Mandatory)]
    [string]$OutFile
  )

  Invoke-WebRequest -Uri $Uri -OutFile $OutFile
}

# Remove old configurations.
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue z3, kind2, kind2-language-server
Remove-Item -Force -ErrorAction SilentlyContinue z3.exe, libz3.dll, "$Z3ZipName.zip", "$Kind2TarName.tar.gz", kind2-language-server.zip

# Install Z3 and retain the DLL required by z3.exe.
$Z3Zip = "$Z3ZipName.zip"
Get-Archive "https://github.com/Z3Prover/z3/releases/download/z3-$Z3Version/$Z3Zip" $Z3Zip
Expand-Archive -Path $Z3Zip -DestinationPath . -Force
Remove-Item -Force $Z3Zip
Copy-Item "$Z3ZipName\bin\z3.exe" .
Copy-Item "$Z3ZipName\bin\libz3.dll" .
Remove-Item -Recurse -Force $Z3ZipName

# Install Kind 2.
$Kind2Tar = "$Kind2TarName.tar.gz"
Get-Archive "https://github.com/kind2-mc/kind2/releases/download/v$Kind2Version/$Kind2Tar" $Kind2Tar
tar -xf $Kind2Tar
Remove-Item -Force $Kind2Tar

# Install the Kind 2 language server.
$ServerZip = 'kind2-language-server.zip'
Get-Archive "https://github.com/kind2-mc/kind2-language-server/releases/download/$ServerVersion/$ServerZip" $ServerZip
Expand-Archive -Path $ServerZip -DestinationPath . -Force
Remove-Item -Force $ServerZip

# Build and copy the interpreter webview.
Push-Location interpreter
try {
  npm install
  npm run build
}
finally {
  Pop-Location
}

New-Item -ItemType Directory -Force out | Out-Null
Copy-Item -Recurse -Force interpreter\dist\interpreter\browser out\interpreter

# Install extension dependencies.
npm install