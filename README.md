# 📄 DocumentAnalyze — AI-Powered Document Intelligence Platform

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://reactjs.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

> 🚀 **Live Demo:** https://documentanalyze.onrender.com

---

## 🧠 Overview

DocumentAnalyze is a full-stack AI-powered document processing system that converts unstructured files into structured, exportable data.

Upload images, PDFs, text files, or ZIP archives → extract clean structured data → export instantly to Excel or CSV.

It removes manual data entry completely by combining OCR, rule-based intelligence, and structured parsing pipelines.

---

## ⚙️ Key Features

- 📄 **11+ Document Types Supported**
  Invoices, receipts, bank statements, payslips, contracts, tax forms, shipping documents, reports, and tables

- 🔍 **OCR Engine**
  Tesseract 5 + Jimp preprocessing (grayscale, normalization, contrast enhancement)
  PDF text extraction with fallback OCR via Poppler

- 🧠 **Smart Classification System**
  Keyword-based scoring engine with confidence rating

- 💰 **Financial Document Intelligence**
  Multi-currency support (USD, EUR, GBP, INR, JPY, CHF)

- 🌍 **Entity Extraction Engine**
  Extracts:
  emails, phone numbers, dates, amounts, IBAN, BIC, account numbers, IDs

- 🧾 **Structured Parsing Layer**
  Converts raw OCR text into normalized structured JSON

- 📊 **Export System**
  - Excel (.xlsx) multi-sheet structured workbook
  - CSV (UTF-8 BOM compatible)

- 📦 **Batch Processing**
  Supports multiple file uploads + ZIP archives

- 🐳 **Production Ready**
  Dockerized and fully deployable on Render

---

## 🏗️ Architecture

```text
📥 Upload (Image / PDF / TXT / ZIP)
        │
        ▼
🔍 OCR Engine
(Tesseract 5 + pdf-parse + Poppler fallback)
        │
        ▼
🧹 Text Cleanup Layer
(normalization, OCR correction, line merging)
        │
        ▼
🧠 Document Classification
(keyword scoring → document type + confidence)
        │
        ▼
🧾 Structured Parsing Engine
(11 rule-based document parsers)
        │
        ▼
🔎 Entity Extraction
(regex-based extraction of structured fields)
        │
        ▼
✅ Validation & Normalization
(confidence scoring + unified schema)
        │
        ▼
📤 Export Layer
Excel (.xlsx) | CSV (UTF-8 BOM)
📊 Supported Document Types
Type	Extracted Fields
Invoice	vendor, totals, tax, line items, invoice number
Bank Statement	transactions, balances, IBAN, BIC
Receipt	merchant, items, totals, payment method
Utility Bill	usage, billing cycle, charges
Payslip	earnings, deductions, net pay
Purchase Order	vendor, shipping, totals
Contract	parties, clauses, value, dates
Tax Forms	W-2, 1099, 1040 structured extraction
Shipping Docs	tracking, carrier, origin/destination
Reports	key metrics, sections
Tables	auto-detected structured rows
🧱 Tech Stack
Layer	Technology
Backend	Node.js 20, Express 5
Frontend	React 18, Vite, Tailwind CSS
OCR	Tesseract 5, Jimp
PDF Processing	pdf-parse, Poppler
Export	ExcelJS
Upload Handling	Multer, Adm-Zip
Deployment	Docker, Render
🚀 Quick Start
1. Clone Repository
git clone https://github.com/itsujwal11/DocumentAnalyze.git
cd DocumentAnalyze
npm install
2. Install System Dependencies

Install required tools:

Tesseract OCR 5+
Poppler
Windows

Download Tesseract: https://github.com/UB-Mannheim/tesseract/wiki
Download Poppler: http://blog.alivate.com.au/poppler-windows/

macOS
brew install tesseract poppler
Linux
sudo apt install tesseract-ocr tesseract-ocr-eng poppler-utils
3. Run Backend
npm start

Server runs at:

http://localhost:8080
4. Run Frontend
cd frontend
npm install
npm run dev

Frontend runs at:

http://localhost:5173
🐳 Docker Setup
docker build -t documentanalyze .
docker run -p 8080:8080 documentanalyze

Multi-stage build:

Stage 1: Build frontend
Stage 2: Slim production Node image with OCR tools
🌐 API Endpoints
Health Check
GET /api/health

Response:

{ "status": "ok", "uptime": 123.45 }
Process Documents
POST /api/process

Upload:

images, PDFs, text files, ZIP archives

Returns:

structured JSON
extracted entities
parsed fields
raw OCR text
Export Excel
POST /api/export/excel

Returns:

multi-sheet .xlsx file
Export CSV
POST /api/export/csv

Returns:

structured CSV (UTF-8 BOM)
📁 Project Structure
server/
  ocr/                → OCR + cleanup pipeline
  parsers/           → 11 document-specific parsers
  classify.js        → document classification
  entity.js          → regex entity extraction
  normalize.js       → output standardization
  validate.js        → confidence scoring
  export/            → Excel + CSV generation

frontend/
  components/        → UI dashboard
  hooks/             → OCR + extraction logic
  lib/               → API integration layer

test_ocr/
  test_pipeline.js   → end-to-end testing
  test_parsers.js    → unit tests
🧠 How It Works
User uploads document
OCR extracts raw text
Text is cleaned and normalized
Document type is classified
Specialized parser extracts structured data
Entity engine detects financial & identity fields
Validation assigns confidence scores
Data is exported to Excel or CSV
🧪 Testing
node test_ocr/test_parsers.js
node test_ocr/test_pipeline.js
🚀 Deployment

Render deployment ready:

services:
  - type: web
    name: documentanalyze
    env: docker
⚠️ Limitations
OCR accuracy depends on scan quality
Handwritten documents are not fully supported
Rule-based classification may need tuning for new formats
📜 License

ISC License

🙏 Acknowledgments
Tesseract OCR
Poppler
ExcelJS
Render
🔥 Final Note

This system is built for speed, structure, and deterministic extraction — not black-box AI guessing.
