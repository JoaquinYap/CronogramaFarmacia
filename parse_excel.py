import pandas as pd
import sys
import json
import xlrd

def get_format(file_path):
    print(f"Reading {file_path}")
    book = xlrd.open_workbook(file_path, formatting_info=True)
    sheet = book.sheet_by_index(0)
    
    data = []
    for r in range(10): # read first 10 rows
        row_data = []
        for c in range(35): # read first 35 columns
            try:
                cell = sheet.cell(r, c)
                xf = book.xf_list[cell.xf_index]
                font = book.font_list[xf.font_index]
                border = xf.border
                align = xf.alignment
                
                row_data.append({
                    'row': r,
                    'col': c,
                    'value': str(cell.value),
                    'bold': font.weight > 400,
                    'underline': font.underline_type > 0,
                    'size': font.height / 20,
                    'border': border.bottom_line_style > 0,
                    'align': align.hor_align
                })
            except Exception as e:
                pass
        data.append(row_data)
        
    print(json.dumps(data, indent=2))
    
    print("\nMERGES:")
    for crange in sheet.merged_cells:
        rlo, rhi, clo, chi = crange
        print(f"Merge: R{rlo}-R{rhi-1}, C{clo}-C{chi-1}")

get_format("CRONOGRAMA DEPOSITO JULIO 2026.xls")
