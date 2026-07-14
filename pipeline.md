---
layout: default
title: Macro Data Pipeline
permalink: /pipeline/
---

---

## Macro Data Pipeline

### Arsitektur & Fitur Utama

#### 1. Hybrid Ingestion Engine

Sistem ini menangani dua jalur pengambilan data secara paralel:

- **REST API Path**: Mengambil data JSON dari BLS, FRED, dan BEA menggunakan `asyncio` + `aiohttp` untuk concurrency fetching.
- **File-based Path**: Mengunduh dan memproses file CSV/XLSX dari ONS (Office for National Statistics UK).

#### 2. Strict Data Validation

Menggunakan Pydantic strict models untuk memastikan kualitas dan integritas data sebelum masuk ke database. Sistem ini menolak data yang tidak sesuai schema secara otomatis.

#### 3. File Parsing

Menggunakan Polars dan Calamine untuk parsing file Excel/CSV yang cepat, dilengkapi dengan boundary detection untuk menangani struktur file rilis statistik yang tidak konsisten.

#### 4. Vintage Data Preservation

Raw data disimpan dalam format immutable di kolom PostgreSQL JSONB. Ini mendukung analisis histori point-in-time tanpa kehilangan data revisi dari sumber asli.

### Cakupan Data

Pipeline ini saat ini menangani 45+ indikator ekonomi dari 2 negara, termasuk:

- Inflasi: CPI, PPI
- Pasar Tenaga Kerja: NFP, Unemployment Rate
- Pertumbuhan Ekonomi: GDP, Trade Balance

<img src="/images/postgresql.png" alt="Data Sample PostgreSQL" style="max-width: 100%; border-radius: 8px;"/>

### Diagram Alur

<img src="/images/pipeline.png" alt="Pipeline Architecture Diagram" style="max-width: 100%; border-radius: 8px;"/>

- **[Home Page](/)**
