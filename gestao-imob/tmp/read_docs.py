import docx
import pandas as pd
import os

def read_docx(file_path):
    doc = docx.Document(file_path)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    return '\n'.join(full_text)

def read_xlsx(file_path):
    xl = pd.ExcelFile(file_path)
    content = ""
    for sheet in xl.sheet_names:
        df = xl.parse(sheet)
        content += f"\nSheet: {sheet}\n"
        content += df.to_string()
    return content

recursos_dir = r"c:\Users\PICHAU\OneDrive\Área de Trabalho\gestão_imob\recursos"
output_file = r"c:\Users\PICHAU\OneDrive\Área de Trabalho\gestão_imob\recursos_extracted.txt"

files_to_read = [
    "Comissionamentos.docx",
    "Estrutura de receita.xlsx",
    "1 - Moinhos Janeiro 26.xlsx"
]

with open(output_file, 'w', encoding='utf-8') as f:
    for filename in files_to_read:
        file_path = os.path.join(recursos_dir, filename)
        if os.path.exists(file_path):
            f.write(f"\n\n{'='*20} FILE: {filename} {'='*20}\n")
            try:
                if filename.endswith('.docx'):
                    f.write(read_docx(file_path))
                elif filename.endswith('.xlsx'):
                    f.write(read_xlsx(file_path))
                f.write("\n" + "-"*50 + "\n")
            except Exception as e:
                f.write(f"ERROR reading {filename}: {str(e)}\n")

print(f"Extracted content to {output_file}")
