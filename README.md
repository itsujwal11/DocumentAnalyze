# DocumentAnalyze — AI-Powered OCR Document Intelligence

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://reactjs.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

> **Live Demo:** [https://documentanalyze.onrender.com](https://documentanalyze.onrender.com)

DocumentAnalyze is a production-ready, full-stack web application that extracts **structured information** from scanned documents using OCR (Optical Character Recognition) and rule-based parsing. Upload images, PDFs, text files, or ZIP archives and get back clean, organized data — ready to export as Excel or CSV.

---

## Features

- **11+ Document Types Supported** — Invoices, bank statements, receipts, utility bills, payslips, purchase orders, contracts, tax forms (W-2, 1099, 1040), shipping documents, generic reports, and tabular data.
- **OCR Engine** — Powered by Tesseract 5 with Jimp-based image preprocessing (greyscale, contrast, normalize). Falls back to `pdftoppm` for image-based PDFs.
- **Auto-Classification** — Keyword-scoring system automatically detects document type with confidence ratings.
- **Multi-Currency & Language Detection** — Supports USD, EUR, GBP, INR, CHF, JPY and English, German, French, Spanish.
- **Rich Entity Extraction** — Automatically pulls emails, phone numbers, dates, amounts, account numbers, IBAN, BIC, SSNs, URLs, and document-specific IDs.
- **Interactive Frontend Dashboard** — Drag-and-drop upload, real-time OCR progress, extracted data cards, dynamic record tables, entity views, raw text viewer, and batch document switching.
- **Image Editing Canvas** — Bounding box rendering with confidence indicators, mouse interaction (drag, select, hover).
- **Multi-Document Batch Processing** — Upload multiple files or a ZIP archive; process them all in one request.
- **Excel Export** — Multi-sheet workbooks with styled sections, formatted tables, and raw text.
- **CSV Export** — UTF-8 BOM for Excel compatibility, sectioned output.
- **Docker-Ready** — Multi-stage Docker build with slim production image.
- **One-Click Deploy** — `render.yaml` configured for Render.com deployment.

---

## Architecture / Pipeline

┌──────────────────────────────────────────────────────────────┐
│                      📥 User Upload                          │
│        (Image / PDF / TXT / ZIP files)                      │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                      🔍 OCR Engine                           │
│   • Images → Tesseract 5 + Jimp preprocessing               │
│   • PDFs   → pdf-parse + pdftoppm fallback                  │
│   (server/ocr)                                              │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    🧹 Text Cleanup Layer                     │
│   • Normalize text structure                                │
│   • Fix OCR errors (numbers, symbols, spacing)              │
│   • Merge broken lines                                      │
│   • Remove control characters                               │
│   (server/ocr/cleanup.js)                                   │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                🧠 Document Classification                    │
│   • Keyword scoring system                                  │
│     - Required match   → +30                                │
│     - Strong match     → +15                                │
│     - Medium match     → +5                                 │
│   • Select best-fit document type + confidence score        │
│   (server/classify.js)                                      │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    🧾 Structured Parsing                    │
│   • 11 rule-based parsers                                  │
│   • Extract:                                                │
│     - Header fields                                         │
│     - Line items                                            │
│     - Totals & summaries                                   │
│     - Tabular data                                         │
│   (server/parsers/)                                        │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│               🔎 Entity Extraction Engine                   │
│   • Regex-based extraction                                 │
│   • Detect:                                                │
│     - Emails                                               │
│     - Phone numbers                                        │
│     - Dates                                                │
│     - Currency / amounts                                   │
│     - Account / IBAN / BIC                                 │
│     - IDs                                                  │
│   (server/entity.js)                                       │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│           ✅ Validation & Normalization Layer                │
│   • Field validation rules                                 │
│   • Confidence scoring                                     │
│   • Standardized output schema                             │
│   • Data normalization                                     │
│   (server/validate.js, normalize.js)                       │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                        📤 Export Layer                      │
│   • Excel (.xlsx) → multi-sheet structured workbook        │
│   • CSV (.csv) → UTF-8 BOM support                         │
│   (server/export/)                                         │
└──────────────────────────────────────────────────────────────┘

---

## Supported Document Types

| Type | Parser | Key Extracted Fields |
|---|---|---|
| **Invoice** | `parsers/invoice.js` | Invoice #, Date, Due Date, Vendor, Customer, Line Items, Subtotal, Tax, Total, Balance Due, PO # |
| **Bank Statement** | `parsers/bank-statement.js` | Account #, Account Holder, Bank Name, Sort Code, IBAN, BIC, Opening/Closing Balance, Transactions (date, description, debit, credit, balance) |
| **Receipt** | `parsers/receipt.js` | Merchant, Date, Receipt/Ticket #, Items, Subtotal, Tax, Total, Change Due, Payment Method, Store/Cashier/Terminal |
| **Utility Bill** | `parsers/utility-bill.js` | Customer Name, Account #, Service Address, Service Type, Billing Period, Usage, Current Charges, Total Due |
| **Payslip** | `parsers/payslip.js` | Employee Name/ID, Employer, Pay Period, Earnings, Deductions, Gross Pay, Net Pay, Tax/Social Security/Medicare, YTD Values |
| **Purchase Order** | `parsers/purchase-order.js` | PO #, Order/Delivery Date, Vendor, Ship To, Bill To, Line Items, Subtotal, Tax, Shipping, Total |
| **Contract** | `parsers/contract.js` | Contract Title, Parties, Effective/Expiration Dates, Contract Value, Governing Law, Clauses |
| **Tax Document** | `parsers/tax-document.js` | Form Type (W-2/1099/1040), Tax Year, Taxpayer, Wages, Withholdings, AGI, Total Income, Deductions, Refund |
| **Shipping Document** | `parsers/shipping-document.js` | Carrier, Tracking #, Origin, Destination, Ship/Delivery Date, Weight, Packages, Declared Value, Freight Charge |
| **Generic Report** | `parsers/generic-report.js` | Report Title, Date, Period, Sections, Key Figures, Records |
| **Table** | `parsers/table.js` | Auto-detected tables with headers, rows, and column-mapped records |
| **Unknown** | `parsers/unknown.js` | Fallback: language, currency, generic entities, basic fields |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js 20, Express 5 |
| **Frontend** | React 18, Vite 4, Tailwind CSS 3 |
| **OCR Engine** | Tesseract 5, Jimp (image preprocessing) |
| **PDF Processing** | pdf-parse, Poppler (pdftoppm) |
| **Spreadsheets** | ExcelJS |
| **File Upload** | Multer, Adm-Zip |
| **Containerization** | Docker (multi-stage) |
| **Deployment** | Render |

---

## Quick Start (Local Development)

### Prerequisites

- **Node.js** 20+ or 22+
- **Tesseract OCR** 5+ (with English language data)
  - Windows: Download from [GitHub UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki)
  - macOS: `brew install tesseract`
  - Linux: `sudo apt install tesseract-ocr tesseract-ocr-eng`
- **Poppler** (for PDF-to-image conversion)
  - Windows: Download from [poppler for Windows](http://blog.alivate.com.au/poppler-windows/)
  - macOS: `brew install poppler`
  - Linux: `sudo apt install poppler-utils`

### 1. Clone & Install Backend

```bash
git clone https://github.com/itsujwal11/DocumentAnalyze.git
cd DocumentAnalyze
npm install
2. Configure Environment (optional)
Copy .env.example to .env and adjust as needed:

PORT=8080
NODE_ENV=development
TESS_PATH=tesseract
PDFTOPPM_PATH=pdftoppm
UPLOAD_DIR=./uploads
Note: On Windows, the config.js auto-detects Tesseract at C:\Program Files\Tesseract-OCR\tesseract.exe. Set TESS_PATH explicitly if installed elsewhere.

3. Start the Backend Server
npm start
# Server runs on http://localhost:8080
4. Set Up & Start the Frontend (Development Mode)
cd frontend
npm install
npm run dev
# Vite dev server runs on http://localhost:5173
# API calls are proxied to localhost:8080
5. Build Frontend for Production
npm run build
# Builds frontend to frontend/dist/
# Express serves it automatically when NODE_ENV=production
6. Run Tests
# Parser unit tests
node test_ocr/test_parsers.js

# End-to-end pipeline test (generates test_output.xlsx and test_output.csv)
node test_ocr/test_pipeline.js
Docker
Build & Run
docker build -t documentanalyze .
docker run -p 8080:8080 documentanalyze
The Docker image uses a multi-stage build:

Stage 1: Installs all dependencies and builds the frontend.
Stage 2: Slim node:20-bookworm-slim image with Tesseract and Poppler pre-installed.
Deployment (Render)
This project includes a render.yaml for one-click deployment on Render:

services:
  - type: web
    name: documentanalyze
    env: docker
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: TESS_PATH
        value: tesseract
      - key: PDFTOPPM_PATH
        value: pdftoppm
![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)

API Endpoints
GET /api/health
Health check endpoint.

{ "status": "ok", "uptime": 123.45 }
POST /api/process
Upload one or more documents for processing.

Method: POST
Content-Type: multipart/form-data
Field: files (single or multiple)
Supported formats: .pdf, .png, .jpg, .jpeg, .bmp, .tiff, .tif, .txt, .zip
Response: JSON with document type, confidence, raw text, entities, structured fields, and records.
POST /api/export/excel
Generate an Excel workbook from processed data.

Method: POST
Content-Type: application/json
Body: The data object from /api/process
Response: .xlsx file download
POST /api/export/csv
Generate a CSV file from processed data.

Method: POST
Content-Type: application/json
Body: The data object from /api/process
Response: .csv file download (UTF-8 BOM)
Environment Variables
Variable	Default	Description
PORT	8080	Server port
NODE_ENV	development	Set to production for serving built frontend
TESS_PATH	tesseract	Path to Tesseract OCR binary
PDFTOPPM_PATH	pdftoppm	Path to Poppler pdftoppm binary
UPLOAD_DIR	./uploads	Temporary upload directory
VITE_API_URL	(build-time)	Frontend API base URL
Project Structure
├── server.js                 # Express server entry point
├── package.json
├── Dockerfile                # Multi-stage Docker build
├── render.yaml               # Render deployment config
├── .env.example              # Environment variable template
│
├── server/
│   ├── config.js             # Configuration, defaults, helpers
│   ├── classify.js           # Document type classifier
│   ├── entity.js             # Regex entity extraction
│   ├── normalize.js          # Output normalization
│   ├── validate.js           # Parser result validation
│   ├── ocr/
│   │   ├── index.js          # OCR pipeline (Tesseract, PDF, image)
│   │   └── cleanup.js        # Text preprocessing/cleaning
│   ├── parsers/
│   │   ├── base.js           # Abstract base parser
│   │   ├── invoice.js
│   │   ├── bank-statement.js
│   │   ├── receipt.js
│   │   ├── utility-bill.js
│   │   ├── payslip.js
│   │   ├── purchase-order.js
│   │   ├── contract.js
│   │   ├── tax-document.js
│   │   ├── shipping-document.js
│   │   ├── generic-report.js
│   │   ├── table.js
│   │   └── unknown.js
│   └── export/
│       ├── excel.js          # Multi-sheet Excel export
│       └── csv.js            # CSV export with BOM
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── lib/
│       │   ├── api.js
│       │   └── processDocument.js
│       ├── hooks/
│       │   ├── useOCR.js
│       │   ├── useExtraction.js
│       │   ├── useFinancialDocument.js
│       │   └── useImageEditor.js
│       └── components/
│           ├── UnifiedDashboard.jsx
│           ├── UploadArea.jsx
│           ├── Canvas.jsx
│           ├── Header.jsx
│           ├── Sidebar.jsx
│           ├── TextEditor.jsx
│           ├── EntityDashboard.jsx
│           ├── ExtractionHistory.jsx
│           ├── OCRProgress.jsx
│           └── financial/
│
├── test_ocr/
│   ├── test_pipeline.js
│   ├── test_parsers.js
│   ├── debug.js / debug2.js
│   ├── images_output/
│   └── test_output.xlsx / .csv
│
└── uploads/
How It Works
Upload — Drop images, PDFs, text files, or ZIP archives via the web UI or API.
OCR — Images are preprocessed (greyscale, contrast, normalize) then run through Tesseract 5. PDFs use native text extraction with automatic OCR fallback for scanned documents.
Cleanup — Raw OCR text is normalized: broken numbers are rejoined, common OCR character errors are fixed, and split lines are merged.
Classify — The cleaned text is scored against keyword sets for each document type to determine the best match.
Parse — A specialized parser extracts structured fields: header info, line items, financial figures, and table data.
Extract Entities — Regex patterns pull out emails, phones, dates, amounts, account numbers, and other entities.
Validate — Each extraction is confidence-scored; documents below 70% are flagged for review.
Normalize — All data is unified into a consistent output structure.
Export — Download results as a formatted Excel workbook (multi-sheet) or CSV file.
License
This project is licensed under the ISC License.

Acknowledgments :
Tesseract OCR — Open-source OCR engine
Poppler — PDF rendering library
ExcelJS — Spreadsheet generation
Render — Cloud hosting

