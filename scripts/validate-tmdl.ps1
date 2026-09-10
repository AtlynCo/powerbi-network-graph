param(
    [string]$AssemblyPath = ".\.tmp\tmdl-bin\net8.0\Microsoft.AnalysisServices.Tabular.dll"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$assembly = (Resolve-Path -LiteralPath $AssemblyPath).Path
$definition = Join-Path $root "samples\release\Network.SemanticModel\definition"
$reportRoot = Join-Path $root "samples\release\Network.Report"
$reportArtifactVersion = "4.0"
$reportDefinitionVersion = "2.0.0"
Add-Type -Path $assembly
$database = [Microsoft.AnalysisServices.Tabular.TmdlSerializer]::DeserializeDatabaseFromFolder($definition)
if ($database.Model.Tables.Count -ne 8 -or $database.Model.Relationships.Count -ne 6) {
    throw "The deserialized model does not contain the expected eight tables and six relationships."
}
$tables = @($database.Model.Tables | ForEach-Object {
    [pscustomobject][ordered]@{ name = $_.Name; columns = $_.Columns.Count; measures = $_.Measures.Count; partitions = $_.Partitions.Count }
})
$measures = ($tables | Measure-Object -Property measures -Sum).Sum
if ($measures -ne 14) { throw "The deserialized model does not contain fourteen measures." }
foreach ($file in @("definition.pbir", "definition\version.json", "definition\report.json", "definition\pages\pages.json")) {
    if (-not (Test-Path -LiteralPath (Join-Path $reportRoot $file) -PathType Leaf)) {
        throw "Required PBIR structure missing: $file"
    }
}
$artifact = Get-Content -LiteralPath (Join-Path $reportRoot "definition.pbir") -Raw | ConvertFrom-Json
$version = Get-Content -LiteralPath (Join-Path $reportRoot "definition\version.json") -Raw | ConvertFrom-Json
if ($artifact.version -ne $reportArtifactVersion) { throw "definition.pbir must retain report artifact version 4.0." }
if ($version.version -ne $reportDefinitionVersion) { throw "definition/version.json must use report definition version 2.0.0, not the artifact version." }
$reportFiles = @(
    @("definition.pbir", "definition\version.json", "definition\report.json", "definition\pages\pages.json") | ForEach-Object {
        $file = Join-Path $reportRoot $_
        [ordered]@{ file = [IO.Path]::GetRelativePath($root, $file); sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() }
    }
)
$sourceFiles = @(
    Get-ChildItem -LiteralPath $definition -File -Recurse | Sort-Object FullName | ForEach-Object {
        [ordered]@{ file = [IO.Path]::GetRelativePath($root, $_.FullName); sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
    }
)
$result = [ordered]@{
    passed = $true
    checkedAt = [DateTimeOffset]::UtcNow.ToString("o")
    parser = "Microsoft.AnalysisServices.Tabular.TmdlSerializer.DeserializeDatabaseFromFolder"
    assemblyVersion = [Microsoft.AnalysisServices.Tabular.TmdlSerializer].Assembly.GetName().Version.ToString()
    assemblySha256 = (Get-FileHash -LiteralPath $assembly -Algorithm SHA256).Hash.ToLowerInvariant()
    powershell = $PSVersionTable.PSVersion.ToString()
    dotnet = [Environment]::Version.ToString()
    tables = $tables
    relationships = $database.Model.Relationships.Count
    measures = $measures
    pbirArtifactVersion = $artifact.version
    pbirDefinitionVersion = $version.version
    reportFiles = $reportFiles
    sourceFiles = $sourceFiles
    limitations = "Official local TOM grammar/deserialization and required PBIR structure only. No Desktop UI, server, Power Query refresh, DAX evaluation, visual loading or PBIX conversion."
}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $root "dist\tmdl-validation.json") -Encoding utf8
Write-Output "Official TOM deserialized 8 tables, 14 measures and 6 relationships; required PBIR version/structure present."
