import pandas as pd
import json
import os

file_path = "Copia de Copia de FamiliZaharra_Olatz.xlsm"

def analyze_excel(path):
    if not os.path.exists(path):
        print(f"Error: File {path} not found.")
        return

    try:
        # Load the excel file
        xl = pd.ExcelFile(path)
        
        analysis = {
            "sheets": [],
            "file_info": {
                "name": os.path.basename(path),
                "size_mb": os.path.getsize(path) / (1024 * 1024)
            }
        }

        for sheet_name in xl.sheet_names:
            df = xl.parse(sheet_name)
            sheet_info = {
                "name": sheet_name,
                "columns": list(df.columns),
                "row_count": len(df),
                "sample_data": df.head(5).to_dict(orient='records')
            }
            analysis["sheets"].append(sheet_info)

        with open("excel_analysis.json", "w", encoding="utf-8") as f:
            json.dump(analysis, f, indent=4, ensure_ascii=False)
        
        print("Analysis completed and saved to excel_analysis.json")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    analyze_excel(file_path)
