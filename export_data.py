import pandas as pd
import json
import os
import numpy as np

file_path = "Copia de Copia de FamiliZaharra_Olatz.xlsm"
output_path = "data.json"

def export_data():
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found.")
        return

    try:
        # Read the Zerrenda sheet
        df = pd.read_excel(file_path, sheet_name='Zerrenda')
        
        # Replace NaN with None
        df = df.replace({np.nan: None})
        
        def clean_val(val):
            if val is None or val == '-' or (isinstance(val, float) and np.isnan(val)):
                return None
            return val

        # Create unique IDs and a mapping from original ID to the first unique ID found
        id_map = {} # Maps original ID to our new unique ID
        records = []
        
        for index, row in df.iterrows():
            orig_id = clean_val(row['ID'])
            if orig_id is None:
                continue
            
            # Format original ID to string to avoid float/int mismatches
            try:
                orig_id_str = str(int(float(orig_id)))
            except:
                orig_id_str = str(orig_id)
                
            unique_id = f"node_{index}"
            
            # Record the first occurrence of this original ID as the "primary" target for parents
            if orig_id_str not in id_map:
                id_map[orig_id_str] = unique_id
            
            record = {
                "id": unique_id,
                "origId": orig_id_str,
                "parentId": clean_val(row['Ant']),
                "name": row['Izena'],
                "surname": row['Abizenak'],
                "fullName": row['IzenaAbizena'],
                "year": str(row['Jaio']) if row['Jaio'] is not None else None,
                "father": row['Aita'],
                "mother": row['Ama'],
                "parish": row['Parrokia'],
                "town": row['Herria'],
                "code": str(row['Cod']) if row['Cod'] is not None else None
            }
            records.append(record)

        # Now map the parentId (which is an original ID) to our new unique_id
        for r in records:
            if r['parentId'] is not None:
                try:
                    p_id_str = str(int(float(r['parentId'])))
                except:
                    p_id_str = str(r['parentId'])
                
                if p_id_str in id_map:
                    r['parentId'] = id_map[p_id_str]
                else:
                    # Parent ID not found in our list of IDs
                    r['parentId'] = None

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=4, ensure_ascii=False)
        
        print(f"Exported {len(records)} records to {output_path}")

    except Exception as e:
        print(f"Error during export: {e}")

if __name__ == "__main__":
    export_data()
