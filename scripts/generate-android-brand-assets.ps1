Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$resRoot = Join-Path $root "android\app\src\main\res"

function New-RoundedRectPath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $diameter = $Radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function Draw-Mark {
    param(
        [System.Drawing.Graphics]$Graphics,
        [float]$Size,
        [System.Drawing.Brush]$Brush,
        [float]$StrokeWidth
    )

    $pen = New-Object System.Drawing.Pen($Brush, $StrokeWidth)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $center = $Size / 2
    $top = $Size * 0.22
    $bottom = $Size * 0.72
    $leftStartX = $Size * 0.31
    $leftStartY = $Size * 0.43
    $leftEndX = $Size * 0.43
    $leftEndY = $Size * 0.72
    $rightStartX = $Size * 0.69
    $rightStartY = $Size * 0.43
    $rightEndX = $Size * 0.57
    $rightEndY = $Size * 0.72

    $Graphics.DrawLine($pen, $center, $top, $center, $bottom)
    $Graphics.DrawLine($pen, $leftStartX, $leftStartY, $leftEndX, $leftEndY)
    $Graphics.DrawLine($pen, $rightStartX, $rightStartY, $rightEndX, $rightEndY)

    $pen.Dispose()
}

function Save-IconPng {
    param(
        [int]$Size,
        [string]$Path
    )

    $Size = [int]$Size
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $bgRect = [System.Drawing.RectangleF]::new([float]($Size * 0.06), [float]($Size * 0.06), [float]($Size * 0.88), [float]($Size * 0.88))
    $bgPath = New-RoundedRectPath -X $bgRect.X -Y $bgRect.Y -Width $bgRect.Width -Height $bgRect.Height -Radius ($Size * 0.18)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        ([System.Drawing.PointF]::new([float]$bgRect.X, [float]$bgRect.Y)),
        ([System.Drawing.PointF]::new([float]$bgRect.Right, [float]$bgRect.Bottom)),
        [System.Drawing.ColorTranslator]::FromHtml("#B8F08C"),
        [System.Drawing.ColorTranslator]::FromHtml("#8BD4FF")
    )
    $graphics.FillPath($bgBrush, $bgPath)

    $glassRect = [System.Drawing.RectangleF]::new([float]($Size * 0.10), [float]($Size * 0.10), [float]($Size * 0.80), [float]($Size * 0.80))
    $glassPath = New-RoundedRectPath -X $glassRect.X -Y $glassRect.Y -Width $glassRect.Width -Height $glassRect.Height -Radius ($Size * 0.14)
    $glassBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        ([System.Drawing.PointF]::new([float]$glassRect.X, [float]$glassRect.Y)),
        ([System.Drawing.PointF]::new([float]$glassRect.Right, [float]$glassRect.Bottom)),
        [System.Drawing.Color]::FromArgb(120, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(36, 15, 26, 44)
    )
    $glassPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(46, 255, 255, 255), [Math]::Max(1, [int]($Size * 0.012)))
    $graphics.FillPath($glassBrush, $glassPath)
    $graphics.DrawPath($glassPen, $glassPath)

    $markBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#11233C"))
    Draw-Mark -Graphics $graphics -Size $Size -Brush $markBrush -StrokeWidth ($Size * 0.095)

    $directory = Split-Path -Parent $Path
    if (!(Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory | Out-Null
    }

    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

    $glassPen.Dispose()
    $glassBrush.Dispose()
    $bgBrush.Dispose()
    $bgPath.Dispose()
    $glassPath.Dispose()
    $markBrush.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

function Save-MarkOnlyPng {
    param(
        [int]$Size,
        [string]$Path
    )

    $Size = [int]$Size
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $markBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        ([System.Drawing.PointF]::new([float]($Size * 0.20), [float]($Size * 0.20))),
        ([System.Drawing.PointF]::new([float]($Size * 0.80), [float]($Size * 0.80))),
        [System.Drawing.ColorTranslator]::FromHtml("#B8F08C"),
        [System.Drawing.ColorTranslator]::FromHtml("#8BD4FF")
    )

    Draw-Mark -Graphics $graphics -Size $Size -Brush $markBrush -StrokeWidth ($Size * 0.11)

    $directory = Split-Path -Parent $Path
    if (!(Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory | Out-Null
    }

    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

    $markBrush.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

function Save-SplashIconPng {
    param(
        [int]$Size,
        [string]$Path
    )

    Save-IconPng -Size ([int]$Size) -Path $Path
}

$iconSizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($entry in $iconSizes.GetEnumerator()) {
    $dir = Join-Path $resRoot $entry.Key
    $iconSize = [int]$entry.Value
    Save-IconPng -Size $iconSize -Path (Join-Path $dir "ic_launcher.png")
    Save-IconPng -Size $iconSize -Path (Join-Path $dir "ic_launcher_round.png")
    Save-MarkOnlyPng -Size ($iconSize * 2) -Path (Join-Path $dir "ic_launcher_foreground.png")
}

Save-SplashIconPng -Size 432 -Path (Join-Path $resRoot "drawable\\vellin_splash_icon.png")

Write-Output "Android brand assets generated."
