param(
  [string]$Action = "list",
  [int]$DisplayIndex = 0,
  [int]$Quality = 50,
  [int]$ResizeW = 0,
  [int]$ResizeH = 0
)

Add-Type -AssemblyName System.Windows.Forms,System.Drawing

# Per-Monitor DPI Awareness — each monitor reports its own physical resolution
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class PerMonitorDpi {
    [DllImport("shcore.dll")]
    public static extern int SetProcessDpiAwareness(int value);
}
"@

# 2 = PROCESS_PER_MONITOR_DPI_AWARE
try { [PerMonitorDpi]::SetProcessDpiAwareness(2) | Out-Null } catch {}

# After per-monitor DPI awareness, Screen.Bounds returns physical pixels per monitor
$screens = [System.Windows.Forms.Screen]::AllScreens

if ($Action -eq "list") {
  $result = @()
  for ($i = 0; $i -lt $screens.Length; $i++) {
    $s = $screens[$i]
    $result += @{
      id = $i
      name = $s.DeviceName
      width = $s.Bounds.Width
      height = $s.Bounds.Height
      x = $s.Bounds.X
      y = $s.Bounds.Y
      primary = $s.Primary
    }
  }
  $result | ConvertTo-Json -Compress
}
elseif ($Action -eq "capture") {
  if ($DisplayIndex -ge $screens.Length) { $DisplayIndex = 0 }
  $s = $screens[$DisplayIndex]

  $captureW = $s.Bounds.Width
  $captureH = $s.Bounds.Height

  $bmp = New-Object System.Drawing.Bitmap($captureW, $captureH)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($s.Bounds.Location, [System.Drawing.Point]::Empty, $s.Bounds.Size)

  # Draw cursor
  $cursorPos = [System.Windows.Forms.Cursor]::Position
  $cx = $cursorPos.X - $s.Bounds.X
  $cy = $cursorPos.Y - $s.Bounds.Y
  if ($cx -ge 0 -and $cy -ge 0 -and $cx -lt $captureW -and $cy -lt $captureH) {
    try {
      [System.Windows.Forms.Cursors]::Default.Draw($g, (New-Object System.Drawing.Rectangle($cx, $cy, 16, 16)))
    } catch {}
  }
  $g.Dispose()

  # Resize if requested
  if ($ResizeW -gt 0 -and $ResizeH -gt 0 -and ($ResizeW -ne $captureW -or $ResizeH -ne $captureH)) {
    $resized = New-Object System.Drawing.Bitmap($ResizeW, $ResizeH)
    $rg = [System.Drawing.Graphics]::FromImage($resized)
    $rg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $rg.DrawImage($bmp, 0, 0, $ResizeW, $ResizeH)
    $rg.Dispose()
    $bmp.Dispose()
    $bmp = $resized
  }

  $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
  $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, $encoder, $encoderParams)
  $bmp.Dispose()

  [Convert]::ToBase64String($ms.ToArray())
  $ms.Dispose()
}
