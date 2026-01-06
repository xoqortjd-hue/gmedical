
$b64Path = "c:\Users\user\.gemini\antigravity\scratch\medical-inventory-system\temp_image_b64.txt"
$outPath = "c:\Users\user\.gemini\antigravity\scratch\medical-inventory-system\banners\kumyang_banner_print_ready.svg"

# Read Base64 Image
$b64 = Get-Content -Path $b64Path -Raw
$b64 = $b64.Trim()

# SVG Content Parts
$header = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="2400mm" height="2300mm" viewBox="0 0 2400 2300" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
        <style>
            @import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&amp;family=Roboto:wght@700&amp;display=swap");
            .title-en { font-family: "Roboto", "Arial", sans-serif; font-weight: bold; font-size: 190px; fill: #FFFFFF; text-anchor: middle; }
            .title-kr { font-family: "Noto Sans KR", "Malgun Gothic", "Dotum", sans-serif; font-weight: bold; font-size: 170px; fill: #FFFFFF; text-anchor: middle; }
            .slogan { font-family: "Roboto", "Arial", sans-serif; font-weight: bold; font-size: 110px; fill: #E0E0E0; text-anchor: middle; letter-spacing: 5px; }
        </style>
    </defs>
    
    <!-- Background Image (Raster, Base64 Embedded) -->
    <image x="0" y="0" width="2400" height="2300" preserveAspectRatio="none" xlink:href="data:image/png;base64,'

$footer = '" />

    <!-- Vector Text Layer -->
    <!-- Positioned in the upper 35% of the banner for maximum visibility -->
    
    <text x="1200" y="700" class="title-en">KUMYANG MEDICAL</text>
    <text x="1200" y="930" class="title-kr">(주)금양메디칼</text>
    <text x="1200" y="1130" class="slogan">UNIQUE &amp; BEST</text>
    
</svg>'

# Combine and Write
$finalSvg = $header + $b64 + $footer
Set-Content -Path $outPath -Value $finalSvg -Encoding UTF8

Write-Host "SVG Generated at $outPath"
