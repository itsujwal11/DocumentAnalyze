# 📄 DocumentAnalyze — AI-Powered Document Intelligence Platform

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://reactjs.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

> 🚀 **Live Demo:** [https://documentanalyze.onrender.com](https://documentanalyze.onrender.com)

---

## 🧠 Overview

DocumentAnalyze is a full-stack AI-powered document processing system that converts unstructured files into clean, structured, exportable data.

Upload **images, PDFs, text files, or ZIP archives** → get structured data → export instantly to **Excel** or **CSV**.

It eliminates manual data entry by combining powerful OCR, rule-based intelligence, and specialized parsing pipelines.

---

## ⚙️ Key Features

- 📄 **11+ Document Types Supported** — Invoices, receipts, bank statements, payslips, contracts, tax forms, shipping documents, reports, and tables
- 🔍 **Advanced OCR Engine** — Tesseract 5 + Jimp preprocessing (grayscale, contrast, normalization) with Poppler fallback for PDFs
- 🧠 **Smart Classification** — Keyword scoring engine with confidence ratings
- 💰 **Financial Intelligence** — Multi-currency support (USD, EUR, GBP, INR, JPY, CHF)
- 🌍 **Rich Entity Extraction** — Emails, phone numbers, dates, amounts, IBAN, BIC, account numbers, IDs, etc.
- 🧾 **Structured Parsing** — 11 specialized rule-based parsers
- 📊 **Export Options** — Multi-sheet Excel (`.xlsx`) + UTF-8 BOM CSV for Excel compatibility
- 📦 **Batch Processing** — Multiple files + full ZIP archive support
- 🐳 **Production Ready** — Dockerized with multi-stage builds and one-click Render deployment

---

## 🏗️ Architecture

```mermaid
flowchart TD
    A[📥 User Upload\nImage / PDF / TXT / ZIP] --> B[🔍 OCR Engine\nTesseract 5 + Jimp + pdf-parse\nPoppler fallback]
    B --> C[🧹 Text Cleanup\nNormalization, line merging, OCR fixes]
    C --> D[🧠 Classification\nKeyword scoring + confidence]
    D --> E[🧾 Structured Parsing\n11 specialized rule-based parsers]
    E --> F[🔎 Entity Extraction\nRegex for emails, amounts, IBAN, etc.]
    F --> G[✅ Validation & Normalization\nConfidence scoring + unified schema]
    G --> H[📤 Export\nExcel multi-sheet + CSV UTF-8 BOM]


📋 Supported Document Types





















































TypeKey Extracted FieldsInvoiceVendor, invoice number, date, line items, tax, totalsBank StatementTransactions, balances, IBAN, BIC, account infoReceiptMerchant, items, totals, payment method, dateUtility BillUsage, billing cycle, charges, due datePayslipEarnings, deductions, net pay, employee infoPurchase OrderVendor, items, shipping, totalsContractParties, clauses, value, datesTax FormsW-2, 1099, 1040 structured fieldsShipping DocTracking number, carrier, origin/destinationReportsKey metrics, sections, tablesTablesAuto-detected structured tabular data

🧱 Tech Stack





































LayerTechnologyBackendNode.js 20, Express 5FrontendReact 18, Vite, Tailwind CSSOCRTesseract 5, JimpPDF Processingpdf-parse, PopplerExportExcelJSUploadMulter, Adm-ZipDeploymentDocker, Render.com

🚀 Quick Start
1. Clone & Install
Bashgit clone https://github.com/itsujwal11/DocumentAnalyze.git
cd DocumentAnalyze
npm install
2. Install System Dependencies
macOS
Bashbrew install tesseract poppler
Linux
Bashsudo apt install tesseract-ocr tesseract-ocr-eng poppler-utils
Windows — Download Tesseract & Poppler from official links.
3. Run Development
Bash# Backend
npm start

# Frontend (new terminal)
cd frontend
npm install
npm run dev
Docker (Recommended)
Bashdocker build -t documentanalyze .
docker run -p 8080:8080 documentanalyze

📁 Project Structure
Bashserver/
  ├── ocr/                # OCR + preprocessing
  ├── parsers/            # 11 document-specific parsers
  ├── export/             # Excel & CSV generation
  ├── classify.js
  ├── entity.js
  ├── cleanup.js
  ├── validate.js
  └── normalize.js

frontend/                 # React + Vite dashboard

test_ocr/
  ├── test_pipeline.js
  └── test_parsers.js

🧠 How It Works

User uploads document(s)
OCR extracts raw text
Text is cleaned and normalized
Document type is classified
Specialized parser extracts structured data
Entity engine pulls key information
Validation adds confidence scores
Data is exported to Excel or CSV


🧪 Testing
Bashnode test_ocr/test_parsers.js
node test_ocr/test_pipeline.js

🚀 Deployment
Ready for Render.com (see render.yaml).

⚠️ Limitations

OCR accuracy depends heavily on document scan quality
Handwritten text is not fully supported
Rule-based system may need tuning for new document formats


📜 License
ISC License


