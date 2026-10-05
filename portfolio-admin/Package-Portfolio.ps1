$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$workspacePath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$siteRoot = $workspacePath
if (Test-Path -LiteralPath (Join-Path $workspacePath 'portfolio/index.html')) { $siteRoot = Join-Path $workspacePath 'portfolio' }
$outputPath = Join-Path $workspacePath 'abanoub-portfolio-with-admin.zip'
$archiveStream = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($archiveStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    $files = @((Get-Item -LiteralPath (Join-Path $workspacePath 'Open-Portfolio-Admin.cmd')))
    $publicNames = @('.nojekyll','favicon.svg','index.html','personal.css','projects.json','README.md','reviews.css','script.js','styles.css')
    foreach ($name in $publicNames) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $siteRoot $name), ('portfolio/' + $name)) | Out-Null
    }
    foreach ($asset in (Get-ChildItem -LiteralPath (Join-Path $siteRoot 'assets') -Recurse -File)) {
        $relativeAsset = $asset.FullName.Substring($siteRoot.Length + 1).Replace('\','/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $asset.FullName, ('portfolio/' + $relativeAsset)) | Out-Null
    }
    $allowedAdminFiles = @('index.html','admin.css','admin.js','server.cjs','github.cjs','model.cjs','auth.cjs','test.cjs','README.md','.gitignore','Start-Portfolio-Admin.ps1','Restart-Portfolio-Admin.ps1','Package-Portfolio.ps1')
    foreach ($name in $allowedAdminFiles) { $files += Get-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Force }
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($workspacePath.Length + 1).Replace('\','/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative) | Out-Null
    }
} finally { $archive.Dispose(); $archiveStream.Dispose() }
Write-Output 'Packaged dashboard source and portfolio. Private authentication files excluded.'
