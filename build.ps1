# Generates index.html, cities/*.html, sitemap.xml and robots.txt
# from templates/page.html and site.json.
# Usage (PowerShell):  .\build.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

$cfg = Get-Content (Join-Path $root "site.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$tpl = Get-Content (Join-Path $root "templates\page.html") -Raw -Encoding UTF8
$site = $cfg.site.TrimEnd("/")

function Esc([string]$s) { return [System.Net.WebUtility]::HtmlEncode($s) }

# Write only when the content changed (avoids needless OneDrive syncs)
function Save([string]$relPath, [string]$text) {
  $path = Join-Path $root $relPath
  if ((Test-Path $path) -and ([System.IO.File]::ReadAllText($path, $utf8) -ceq $text)) {
    Write-Host "unchanged $relPath"
    return
  }
  [System.IO.File]::WriteAllText($path, $text, $utf8)
  Write-Host "wrote $relPath"
}
function Fill([string]$pattern, $city) {
  if ($city) { return $pattern.Replace("{name}", $city.name) }
  return $pattern
}

function CityLinks([string]$base, [string]$current) {
  $sb = New-Object System.Text.StringBuilder
  $groups = [ordered]@{}
  foreach ($c in $cfg.cities) {
    if (-not $groups.Contains($c.group)) { $groups[$c.group] = New-Object System.Collections.ArrayList }
    [void]$groups[$c.group].Add($c)
  }
  foreach ($g in $groups.Keys) {
    [void]$sb.Append('<div class="cl-group"><h3>' + (Esc $g) + '</h3><ul>')
    foreach ($c in $groups[$g]) {
      $cur = ""
      if ($c.id -eq $current) { $cur = ' aria-current="page"' }
      [void]$sb.Append('<li><a href="' + $base + 'cities/' + $c.id + '.html"' + $cur + '>' + (Esc $c.name) + '</a></li>')
    }
    [void]$sb.Append('</ul></div>')
  }
  return $sb.ToString()
}

function WritePage($meta, $city, [string]$base, [string]$relPath, [string]$canonical) {
  $map = [ordered]@{
    "TITLE"      = Esc (Fill $meta.title $city)
    "DESC"       = Esc (Fill $meta.desc $city)
    "H1"         = Esc (Fill $meta.h1 $city)
    "LEAD"       = Esc (Fill $meta.lead $city)
    "CANONICAL"  = $canonical
    "BASE"       = $base
    "CITY"       = $(if ($city) { $city.id } else { "" })
    "CITY_LINKS" = CityLinks $base $(if ($city) { $city.id } else { "" })
    "UPDATED"    = Esc $cfg.updatedJa
  }
  $html = $tpl
  foreach ($k in $map.Keys) { $html = $html.Replace("{{" + $k + "}}", [string]$map[$k]) }
  Save $relPath $html
}

New-Item -ItemType Directory -Force (Join-Path $root "cities") | Out-Null

$urls = New-Object System.Collections.ArrayList
WritePage $cfg.home $null "" "index.html" ($site + "/")
[void]$urls.Add($site + "/")
foreach ($c in $cfg.cities) {
  $u = $site + "/cities/" + $c.id + ".html"
  WritePage $cfg.city $c "../" ("cities\" + $c.id + ".html") $u
  [void]$urls.Add($u)
}
[void]$urls.Add($site + "/privacy.html")
[void]$urls.Add($site + "/disclaimer.html")
[void]$urls.Add($site + "/contact.html")

$sm = New-Object System.Text.StringBuilder
[void]$sm.Append('<?xml version="1.0" encoding="UTF-8"?>' + "`n")
[void]$sm.Append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "`n")
foreach ($u in $urls) { [void]$sm.Append("  <url><loc>$u</loc><lastmod>$($cfg.updated)</lastmod></url>`n") }
[void]$sm.Append("</urlset>`n")
Save "sitemap.xml" $sm.ToString()

$robots = "User-agent: *`nAllow: /`n`nSitemap: $site/sitemap.xml`n"
Save "robots.txt" $robots
