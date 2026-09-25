$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$evidence = Join-Path $root 'dist\native-prepublish\retry-20260925'
$destination = Join-Path $root 'dist\listing-native-1.2'
if (Test-Path -LiteralPath $destination) { throw 'Native listing candidates already exist; preserve them rather than overwrite.' }
$cold = Get-Content -Raw -LiteralPath (Join-Path $evidence 'cold-reopen-without-refresh.json') | ConvertFrom-Json
$inspection = Get-Content -Raw -LiteralPath (Join-Path $root 'dist\native-pbix-inspection.json') | ConvertFrom-Json
if (-not $cold.passed -or -not $inspection.allVisualMembersEqual -or $cold.packageSha256 -ne $inspection.sha256) {
    throw 'Current genuine native capture/package evidence is required.'
}
$pbix = Join-Path $root $inspection.file
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $pbix).Hash.ToLowerInvariant() -ne $inspection.pbixSha256) { throw 'Native PBIX changed.' }
New-Item -ItemType Directory -Path $destination | Out-Null
$captions = [ordered]@{
    services = 'Force layout: investigate a directed service cycle, reciprocal links and a real self-loop.'
    accounts = 'Account relationships: preserve text IDs and inspect explicit conflict and incomplete-weight diagnostics.'
    circular = 'Circular layout: every loaded endpoint on one stable-ID ring; arrows preserve relationship direction.'
    radial = 'Radial layout: loaded undirected hop rings and separate component centers; no centrality claim.'
}
$images = @()
foreach ($name in $captions.Keys) {
    $source = Join-Path $evidence "cold-reopen-without-refresh-$name.png"
    $image = [System.Drawing.Image]::FromFile($source)
    $canvas = [System.Drawing.Bitmap]::new(1366,768)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $banner = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#EAF5F5'))
    $text = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#172D3D'))
    $font = [System.Drawing.Font]::new('Segoe UI',12,[System.Drawing.FontStyle]::Regular,[System.Drawing.GraphicsUnit]::Pixel)
    try {
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
        $graphics.FillRectangle($banner,0,0,1366,44)
        $graphics.DrawString($captions[$name],$font,$text,[System.Drawing.PointF]::new(8,4))
        $graphics.DrawString('Actual Power BI Desktop 2.157.1354.0 | Atlyn Network 1.2.0.0 | Synthetic sample | Native render evidence, not Microsoft certification',$font,$text,[System.Drawing.PointF]::new(8,23))
        $scale = [Math]::Min(1366.0/$image.Width,724.0/$image.Height)
        $width = [single]($image.Width*$scale)
        $height = [single]($image.Height*$scale)
        $rect = [System.Drawing.RectangleF]::new([single]((1366-$width)/2),44,$width,$height)
        $graphics.DrawImage($image,$rect)
        $file = Join-Path $destination "$name.png"
        $canvas.Save($file,[System.Drawing.Imaging.ImageFormat]::Png)
        $item = Get-Item -LiteralPath $file
        if ($item.Length -gt 1024000) { throw "Listing image exceeds 1024 KB: $name" }
        $images += [ordered]@{
            file = [IO.Path]::GetRelativePath($root,$file); bytes = $item.Length; width = 1366; height = 768
            sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLowerInvariant()
            source = [IO.Path]::GetRelativePath($root,$source)
            sourceSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash.ToLowerInvariant()
            sourceWidth = $image.Width; sourceHeight = $image.Height; caption = $captions[$name]
        }
    } finally {
        $font.Dispose(); $text.Dispose(); $banner.Dispose(); $graphics.Dispose(); $canvas.Dispose(); $image.Dispose()
    }
}
[ordered]@{
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    artifact = $inspection.artifact; packageSha256 = $inspection.sha256; pbixSha256 = $inspection.pbixSha256
    native = $true; approvedForListing = $false
    capture = 'Actual owner-saved PBIX cold-opened in Power BI Desktop 2.157.1354.0 without refresh. Report canvas only; no account chrome.'
    composition = 'Original native screenshots preserved. Whole canvas proportionally fitted without cropping or retouching into 1366x724 below a 44px explanatory banner; white letterboxing, no distortion.'
    scope = 'Four native listing candidates for owner review. Not a Microsoft badge, media-rights approval, external publication or full host acceptance.'
    images = $images
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $destination 'provenance.json') -Encoding utf8
Write-Output 'Prepared four 1366x768 native listing candidates; owner approval is still required.'
