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
