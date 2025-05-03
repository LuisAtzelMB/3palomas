"use client";

import { useState, useRef } from "react";
import { PDFDocument, rgb, PDFPage } from "pdf-lib";

const PdfCheckmarkAdder = () => {
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [outputFile, setOutputFile] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createCheckmarkPdf = async (): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size (8.5 x 11 inches)

    // Draw checkmarks (✓) at three different positions
    const drawCheckmark = (x: number, y: number, size: number) => {
      // Main diagonal line (larger)
      page.drawLine({
        start: { x: x, y: y },
        end: { x: x - size * 0.8, y: y - size * 0.8 }, // Más larga
        thickness: 1.8, // Un poco más gruesa
        color: rgb(1, 0, 0),
      });

      // Horizontal part of the check (much smaller)
      page.drawLine({
        start: { x: x - size * 0.8, y: y - size * 0.8 },
        end: { x: x - size * 1.0, y: y - size * 0.6 }, // Más corta
        thickness: 1.8, // Un poco más delgada
        color: rgb(1, 0, 0),
      });
    };

    // Three checkmarks at different positions
    drawCheckmark(520, 720, 30); // Top checkmark
    drawCheckmark(520, 396, 30); // Middle checkmark
    drawCheckmark(520, 100, 30); // Bottom checkmark

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  };

  // Resto del código permanece igual...
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setInputFile(e.target.files[0]);
      setOutputFile(null);
      setError(null);
    }
  };

  const addCheckmarksToPdf = async () => {
    if (!inputFile) {
      setError("Please select a PDF file first");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Read the input PDF
      const inputPdfBytes = await inputFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(inputPdfBytes);

      // Create the checkmarks PDF
      const checkmarksPdfBytes = await createCheckmarkPdf();
      const checkmarksPdf = await PDFDocument.load(checkmarksPdfBytes);
      const [checkmarksPage] = checkmarksPdf.getPages();
      const embeddedPage = await pdfDoc.embedPage(checkmarksPage);

      // Add checkmarks to all pages except the first
      const pages = pdfDoc.getPages();
      for (let i = 1; i < pages.length; i++) {
        pages[i].drawPage(embeddedPage);
      }

      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();

      // Create a download link
      const blob = new Blob([modifiedPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setOutputFile(url);
    } catch (err) {
      console.error("Error processing PDF:", err);
      setError(
        "Failed to process PDF. Please make sure you selected a valid PDF file."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-center">
        PDF Checkmark Adder
      </h1>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select PDF File:
        </label>
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          ref={fileInputRef}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
      </div>

      {inputFile && (
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Selected file: <span className="font-medium">{inputFile.name}</span>
          </p>
        </div>
      )}

      <button
        onClick={addCheckmarksToPdf}
        disabled={!inputFile || isProcessing}
        className={`w-full py-2 px-4 rounded-md text-white font-medium
          ${
            !inputFile || isProcessing
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
      >
        {isProcessing ? "Processing..." : "Add Checkmarks to PDF"}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {outputFile && (
        <div className="mt-6">
          <p className="text-sm font-medium text-green-700 mb-2">
            PDF processed successfully!
          </p>
          <a
            href={outputFile}
            download="output_with_checks.pdf"
            className="inline-block py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Download Modified PDF
          </a>
        </div>
      )}
    </div>
  );
};

export default PdfCheckmarkAdder;
