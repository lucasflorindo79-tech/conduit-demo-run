#!/usr/bin/env python3
# convert_dbf_to_csv.py
import sys
import os
import zipfile
from pathlib import Path
import chardet
import pandas as pd
from dbfread import DBF

def find_latest_zip(directory: Path):
    zips = sorted(directory.glob('*.zip'), key=lambda p: p.stat().st_mtime, reverse=True)
    return zips[0] if zips else None

def extract_zip(zip_path: Path, out_dir: Path):
    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(out_dir)
    return out_dir

def find_dbf(start_dir: Path):
    dbfs = list(start_dir.rglob('*.dbf'))
    return dbfs[0] if dbfs else None

def detect_encoding(filepath: Path, nbytes=10000):
    with open(filepath, 'rb') as f:
        raw = f.read(nbytes)
    res = chardet.detect(raw)
    return res['encoding'] or 'utf-8'

def dbf_to_dataframe(dbf_path: str, encoding=None):
    # dbfread aceita encoding como parâmetro
    if encoding:
        table = DBF(dbf_path, encoding=encoding, load=True)
    else:
        table = DBF(dbf_path, load=True)
    records = list(table)
    if not records:
        return pd.DataFrame()
    df = pd.DataFrame.from_records(records)
    return df

def main():
    # argumento 1: pasta onde procurar o zip (padrão: current dir)
    arg = sys.argv[1] if len(sys.argv) > 1 else '.'
    search_dir = Path(arg)
    if not search_dir.exists():
        print(f'Erro: pasta {search_dir} não existe')
        sys.exit(1)

    zip_path = find_latest_zip(search_dir)
    if not zip_path:
        print('Nenhum ZIP encontrado em', search_dir)
        sys.exit(1)

    print('ZIP selecionado:', zip_path)
    workdir = search_dir / zip_path.stem
    workdir.mkdir(parents=True, exist_ok=True)

    print('Extraindo ZIP para', workdir)
    extract_zip(zip_path, workdir)

    dbf_path = find_dbf(workdir)
    if not dbf_path:
        print('Nenhum .dbf encontrado em', workdir)
        for p in workdir.rglob('*'):
            print('->', p)
        sys.exit(1)

    print('DBF encontrado:', dbf_path)
    enc = detect_encoding(dbf_path)
    print('Encoding detectado (estimativa):', enc)

    print('Lendo DBF e convertendo para DataFrame...')
    try:
        df = dbf_to_dataframe(str(dbf_path), encoding=enc)
    except Exception as e:
        print('Erro lendo DBF com encoding detectado, tentando sem encoding:', e)
        df = dbf_to_dataframe(str(dbf_path), encoding=None)

    if df.empty:
        print('DataFrame vazio - nada para salvar')
    else:
        csv_out = workdir / (zip_path.stem + '_converted.csv')
        print('Salvando CSV em', csv_out)
        df.to_csv(csv_out, index=False, encoding='utf-8')
        print('Concluído. Linhas:', len(df))

if __name__ == '__main__':
    main()