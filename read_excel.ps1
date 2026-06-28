$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open("c:\Users\joaco\OneDrive\Escritorio\ExcelAut\CRONOGRAMA DEPOSITO JULIO 2026.xls")

$ws = $wb.Worksheets.Item(1)
$rows = $ws.UsedRange.Rows.Count
$cols = $ws.UsedRange.Columns.Count

Write-Host ("Total Rows: " + $rows + "  Total Cols: " + $cols)
Write-Host "=== FULL CONTENT ==="

for ($r = 1; $r -le $rows; $r++) {
    $line = ""
    for ($c = 1; $c -le $cols; $c++) {
        $cell = $ws.Cells.Item($r, $c)
        $val = $cell.Text
        if ($val -eq $null) { $val = "" }
        if ($c -gt 1) { $line += " | " }
        $line += $val
    }
    Write-Host ("R" + $r + ": " + $line)
}

Write-Host "=== FONT AND BORDERS ==="
for ($r = 7; $r -le 11; $r++) {
    for ($c = 1; $c -le [Math]::Min(5, $cols); $c++) {
        $cell = $ws.Cells.Item($r, $c)
        $bold = $cell.Font.Bold
        $fontSize = $cell.Font.Size
        $fontName = $cell.Font.Name
        $hAlign = $cell.HorizontalAlignment
        $borderBot = $cell.Borders.Item(9).LineStyle  # xlEdgeBottom = 9
        Write-Host ("Cell(" + $r + "," + $c + ") Bold=" + $bold + " Size=" + $fontSize + " Font=" + $fontName + " HAlign=" + $hAlign + " BorderBot=" + $borderBot + " Text=" + $cell.Text)
    }
}

Write-Host "=== MERGE RANGES ==="
$checked = @{}
for ($r = 1; $r -le $rows; $r++) {
    for ($c = 1; $c -le $cols; $c++) {
        $cell = $ws.Cells.Item($r, $c)
        if ($cell.MergeCells) {
            $addr = $cell.MergeArea.Address($false, $false)
            if (-not $checked.ContainsKey($addr)) {
                $checked[$addr] = $true
                Write-Host ("Merge: " + $addr + " = [" + $cell.Text + "]")
            }
        }
    }
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
