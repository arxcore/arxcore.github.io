---
layout: default
title: Macro Data Pipeline
permalink: /pipeline/
---

<div class="section">

## Macro Data Pipeline

### Overview

An automated ELT (Extract, Load, Transform) pipeline designed to fetch, validate, and store macroeconomic indicators from major statistical agencies. The system prioritizes **data fidelity** by preserving raw vintage data, enabling accurate point-in-time historical analysis.
</div>

<div class="section">

## Architecture & Key Features

### 1. Hybrid Ingestion Engine

The system handles two data ingestion paths in parallel:

- **REST API Path**: Fetches JSON data from BLS, FRED, and BEA using `asyncio` + `aiohttp` for concurrent fetching.
- **File-based Path**: Downloads and processes CSV/XLSX files from ONS (UK Office for National Statistics).

### 2. Strict Data Validation

Uses Pydantic strict models to ensure data quality and integrity before database insertion. The system automatically rejects data that doesn't match the schema.

### 3. File Parsing

Utilizes Polars and Calamine for fast Excel/CSV parsing, with boundary detection to handle inconsistent statistical release file structures.

### 4. Vintage Data Preservation

Raw data is stored in immutable format in PostgreSQL JSONB columns. This supports point-in-time historical analysis without losing revision data from original sources.
</div>

<div class="section">

## Current Scope

### Countries

- **2 countries**: United States (`usa`), United Kingdom (`uk`)

### Data Sources / Providers

| Provider | Type          | Agency                         | Coverage         |
| -------- | ------------- | ------------------------------ | ---------------- |
| **BLS**  | REST API      | Bureau of Labor Statistics     | US economic data |
| **FRED** | REST API      | Federal Reserve Economic Data  | US economic data |
| **BEA**  | REST API      | Bureau of Economic Analysis    | US economic data |
| **ONS**  | File Download | Office for National Statistics | UK economic data |

### Indicators

- **Approximate count**: 45+ indicators total across all categories
- **Categories**:
  - **USA**: price, labour, trade, money, consumer, business (6 categories)
  - **UK**: price, labour, consumer, business, trade (5 categories)

### Frequencies Supported

- Monthly (most common)
- Weekly (FRED only)
- Quarterly (BEA)
- Annual

</div>

<div class="section">

## Data Coverage

The pipeline currently handles 45+ economic indicators from 2 countries, including:

- **Inflation**: CPI, PPI, Core PCE
- **Labor Market**: NFP, Unemployment Rate, Participation Rate
- **Economic Growth**: GDP, Trade Balance, Retail Sales
- **Money & Banking**: M2 Money Supply, Interest Rates
- **Consumer**: Consumer Confidence, Personal Income

</div>

<div class="section">

## Technical Implementation

### Tech Stack

- **Language**: Python 3.11+ (async/await)
- **Dependency Management**: Poetry
- **Data Processing**: Polars, Calamine
- **Data Validation**: Pydantic
- **HTTP Client**: aiohttp
- **Concurrency**: asyncio, tenacity
- **Database**: PostgreSQL 15+ (via Supabase)
- **DB Driver**: psycopg (async) + psycopg_pool
- **Transformation**: dbt-core, dbt-postgres

### Architecture Diagram

<img src="/images/pipeline.png" alt="Pipeline Architecture Diagram" style="max-width: 100%; border-radius: 8px;"/>

The pipeline employs a **dual-path architecture** to handle API-based and file-based data sources differently, converging at the raw data storage layer.
</div>

<div class="section">

## Data Flow

### Stage 1: FETCH

```
Metadata → Provider Selection → HTTP Request/Download → Validation → Raw Storage
```

- **API Providers**: Construct request, HTTP POST/GET, validate response, generate SHA-256 checksum
- **File Providers (ONS)**: ETag check, download with If-None-Match, save to filesystem, track in registry
- **Convergence**: Both paths produce unified `FetchBatchResult`
- **Deduplication**: API (checksum-based), File (ETag + file_path based)

### Stage 2: PARSE

```
Query DB → Parser Dispatch → Date/Value Extraction → Standardization → Staging Data
```

- **API Parsers**: Registry-based dispatch using `@register(provider, frequency)` decorator
- **File Parsers**: Extension-based routing (CSV → Polars, Excel → Polars + Calamine)
- **Output**: Unified `ParseResult` with standardized `ParsedItems(date_key, value, footnotes)`

### Stage 3: ALL (FETCH + PARSE)

Combines fetch and parse stages, **always persists** both raw and staging data.

### Stage 4: REPLAY

```
Query DB → Export to JSON → Save to exported_data/{country}/{name}_{timestamp}.json
```

</div>

<div class="section">

## Performance & Scalability

### Current Performance

- **Execution Time**: ~1-2 minutes per full run
- **Success Rate**: 95%+ (improved from initial 42%)
- **Concurrency Limits**:
  - BLS: 5 concurrent requests (daily quota: 500)
  - FRED: 5 concurrent requests
  - BEA: 5 concurrent requests (with random delay 1-5s)
  - ONS: 1 concurrent request (with random delay 10-15s)

### Scaling Considerations

The system is designed with scalability in mind:

- **Database Connection Pooling**: 7 connections (min=1, max=7)
- **Async-First Architecture**: Entire pipeline uses asyncio
- **Modular Design**: Easy to add new providers
- **Idempotent Operations**: Safe to re-run multiple times

**Planned Scaling Improvements:**

- Increase DB connection pool (7 → 20-50)
- Add circuit breaker for provider failures
- Implement quota tracking for all providers
- Increase ONS concurrency
- Add progress tracking and resume capability

</div>

<div class="section">

## Data Architecture

### Raw Data Storage (Immutable)

**API Providers**: Full JSON response stored in `raw_respons_api.payload` (JSONB) with SHA-256 checksum deduplication.

**File Providers**: Files stored on disk at `downloads/{source}/{country}/{category}/` with tracking in `file_registry` table.

### Staging Data Storage

Standardized time series data in `staging_indicators` table with composite unique key.

**Key Features:**

- Composite unique key: `(date, source, code, country, frequency)`
- UPSERT behavior: ON CONFLICT DO UPDATE SET value, footnotes_note, processed
- Full audit trail with timestamps

</div>

<div class="section">

## Error Handling & Reliability

### Exception Hierarchy

```
PipelineCrash
    ├── ProcessingFailed (RoutingError, ResultsNotFound, FormatError)
    │   └── FetchDataError (RateLimit, AuthError, BLS/FRED/BEARequestsError)
    │   └── ParseDataError (BLS/FRED/BEAParserError)
    └── UploadFailed
    └── ResourceNotFound
```

### Behavior

- **Individual indicator failure**: Logged, counted, skipped - pipeline continues
- **Provider session failure**: Logged, raises exception
- **Database error**: **SystemExit(1)** - pipeline stops
- **Non-PipelineCrash exception**: **NOT CAUGHT** - propagates

</div>

<div class="section">

## Idempotency

The pipeline is **idempotent** - safe to re-run multiple times:

| Stage        | Mechanism         | Result on Re-run                           |
| ------------ | ----------------- | ------------------------------------------ |
| Fetch (API)  | Checksum dedup    | Same: skipped; Changed: new row            |
| Fetch (File) | ETag + path dedup | Same: skipped; Changed: re-download        |
| Parse        | UPSERT            | Same key: update value; Different: new row |

</div>

<div class="section">

## Project Status

### Implemented Features

- [x] Async fetch layer with aiohttp
- [x] Multi-provider support (BLS, FRED, BEA, ONS)
- [x] Raw JSONB persistence with checksum dedup
- [x] File download with ETag dedup
- [x] Parser registry for API providers
- [x] File parser routing (CSV, Excel with Calamine)
- [x] Polars-based parsing
- [x] Pydantic-based data validation
- [x] Tenacity-based retry with exponential backoff
- [x] Connection pooling
- [x] CLI with multiple stages and filters
- [x] Custom exception hierarchy

### Planned Features

- [ ] Database-backed metadata (replace YAML)
- [ ] Circuit breaker for provider failures
- [ ] Progress tracking and resume capability
- [ ] Graceful DB error handling
- [ ] Increased ONS concurrency
- [ ] API batching for BLS
- [ ] Metrics collection (Prometheus)
- [ ] Scheduling (Airflow/Prefect)
- [ ] Data retention policy
- [ ] Table partitioning

</div>

<div class="section">

## Documentation

- **[Codebase Tracing](https://github.com/arxcore/pipeline/blob/main/docs/codebase_tracing.md)**: Complete runtime tracing and execution analysis
- **[Pipeline Documentation](https://github.com/arxcore/pipeline/blob/main/docs/documentasi_pipeline.md)**: Higher-level technical documentation
- **[Scaling Analysis](https://github.com/arxcore/pipeline/blob/main/docs/scale_optimisasi.md)**: Scaling analysis and optimization roadmap

</div>

<div class="section">

## Source Code

- **[GitHub Repository](https://github.com/arxcore/pipeline)**
- **[README](https://github.com/arxcore/pipeline/blob/main/README.md)**

---

- **[Home Page](/)**

</div>
