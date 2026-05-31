$src = 'C:\Users\ahlas\OneDrive\Desktop\koyulacak resimler'
$root = Join-Path $PSScriptRoot '..\public\images' | Resolve-Path
$dirs = @('koruma','silah','luks','is','mekan','ozel','mafya','devlet','sohbet','profil')
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path (Join-Path $root $d) | Out-Null }
$files = Get-ChildItem -LiteralPath $src -File
function Find-Pat($pat) {
  $f = $files | Where-Object { $_.Name -like $pat } | Select-Object -First 1
  if ($f) { return $f.FullName }
  return $null
}
$map = @(
  @{p='*baretta*'; d='silah'; n='tabanca'},
  @{p='*pompali*'; d='silah'; n='pompali'},
  @{p='*keles*'; d='silah'; n='ak47'},
  @{p='*golge*'; d='silah'; n='agir_silah'},
  @{p='*awm*'; d='silah'; n='sniper'},
  @{p='*kol saati*'; d='luks'; n='saat'},
  @{p='*Motorsiklet*'; d='luks'; n='motorsiklet'},
  @{p='*Spor Araba*'; d='luks'; n='araba'},
  @{p='*Lüks Yat*'; d='luks'; n='yat'},
  @{p='*Helikopter*'; d='luks'; n='helikopter'},
  @{p='*Jet*'; d='luks'; n='jet'},
  @{p='*Marketi Haraca*'; d='is'; n='market'},
  @{p='*Tamirhanesi*'; d='is'; n='tamirhane'},
  @{p='*Esnafa*'; d='is'; n='koruma'},
  @{p='*Zar Salonu*'; d='is'; n='kumarhane'},
  @{p='*Gece Kul*'; d='is'; n='gece_kulubu'},
  @{p='*Kumarhane A*'; d='is'; n='kumarhane_agi'},
  @{p='*Kara Para*'; d='is'; n='kara_para'},
  @{p='*Galerisine*'; d='is'; n='galeri'},
  @{p='*Lojistik*'; d='is'; n='lojistik'},
  @{p='*Gümrük*'; d='is'; n='gumruk'},
  @{p='*Belediye*'; d='is'; n='belediye'},
  @{p='*Holding*'; d='is'; n='holding'},
  @{p='liman1*'; d='is'; n='liman_istanbul'},
  @{p='liman2*'; d='is'; n='liman_izmir'},
  @{p='liman3*'; d='is'; n='liman_hatay'},
  @{p='Bar.png'; d='mekan'; n='bar'},
  @{p='Lunapark*'; d='mekan'; n='lunapark'},
  @{p='*Sokak*'; d='mekan'; n='sokak_arasi'},
  @{p='*ehirler Aras*'; d='mekan'; n='sehirler_arasi'},
  @{p='*Kaçak*'; d='mekan'; n='kacakcilik'},
  @{p='*Uluslararas*'; d='mekan'; n='uluslararasi'},
  @{p='*Atom*'; d='mekan'; n='atom'},
  @{p='*mahalle*teslimat*'; d='mekan'; n='mahalle_teslimat'},
  @{p='*ehirleraras*teslimat*'; d='mekan'; n='sehirler_arasi_teslimat'},
  @{p='*lke*ap*'; d='mekan'; n='ulke_capinda'},
  @{p='*delikan*'; d='koruma'; n='delikanli'},
  @{p='bodyguard*'; d='koruma'; n='bodyguard'},
  @{p='*profes*'; d='koruma'; n='profesyonel'},
  @{p='*harekat*'; d='koruma'; n='harekat'},
  @{p='luks_oto*'; d='mafya'; n='oto_galeri'},
  @{p='luks_kuyumcu*'; d='mafya'; n='kuyumcu'},
  @{p='islek_banka*'; d='mafya'; n='banka'},
  @{p='darphane*'; d='mafya'; n='darphane'},
  @{p='ev1*'; d='mafya'; n='ev1'},
  @{p='ev2*'; d='mafya'; n='ev2'},
  @{p='ev3*'; d='mafya'; n='ev3'},
  @{p='ev4*'; d='mafya'; n='ev4'},
  @{p='medya*'; d='is'; n='medya'}
)
foreach ($m in $map) {
  $f = if ($m.p -like '*.png') { Join-Path $src $m.p } else { Find-Pat $m.p }
  if ($f) {
    Copy-Item -LiteralPath $f -Destination (Join-Path $root "$($m.d)\$($m.n).png") -Force
    Write-Host "OK $($m.d)/$($m.n)"
  } else {
    Write-Host "MISS $($m.p)"
  }
}
$k = Find-Pat '*Kumarhane A*'
if ($k) { Copy-Item $k (Join-Path $root 'mekan\kumarhane_mekan.png') -Force; Write-Host 'OK mekan/kumarhane_mekan' }
$disco = Find-Pat '*Zar Salonu*'
if ($disco) { Copy-Item $disco (Join-Path $root 'mekan\disco.png') -Force; Write-Host 'OK mekan/disco' }
$bar = Find-Pat 'Bar.png'
if ($bar) { Copy-Item $bar (Join-Path $root 'mekan\kahvehane.png') -Force; Write-Host 'OK mekan/kahvehane' }
