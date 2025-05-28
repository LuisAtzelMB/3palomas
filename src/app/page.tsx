"use client";
import "../app/globals.css";
import { useState, useRef, useEffect } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const PdfCheckmarkAdder = () => {
  const [inputFiles, setInputFiles] = useState<File[]>([]);
  const [outputFiles, setOutputFiles] = useState<
    { url: string; name: string; blob: Blob }[]
  >([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<
    { url: string; name: string }[]
  >([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);
  const [hasMounted, setHasMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const createCheckmarkPdf = async (): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);

    const drawCheckmark = (x: number, y: number, size: number) => {
      page.drawLine({
        start: { x: x, y: y },
        end: { x: x - size * 0.845, y: y - size * 0.8 },
        thickness: 1.8,
        color: rgb(1, 0, 0),
      });

      page.drawLine({
        start: { x: x - size * 0.8, y: y - size * 0.8 },
        end: { x: x - size * 1.0, y: y - size * 0.6 },
        thickness: 1.8,
        color: rgb(1, 0, 0),
      });
    };

    drawCheckmark(520, 620, 30);
    drawCheckmark(520, 396, 30);
    drawCheckmark(520, 100, 30);

    return await pdfDoc.save();
  };

  const handleDirectoryUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files: File[] = [];
    const fileList = e.target.files;

    // Get all PDF files from the directory
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        files.push(file);
      }
    }

    if (files.length === 0) {
      setError("No PDF files found in the selected directory");
      return;
    }

    setInputFiles(files);
    setOutputFiles([]);
    setError(null);
    await generatePreviews(files);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files).filter(
        (file) => file.type === "application/pdf" || file.name.endsWith(".pdf")
      );

      if (filesArray.length === 0) {
        setError("Please select PDF files only");
        return;
      }

      setInputFiles(filesArray);
      setOutputFiles([]);
      setError(null);
      await generatePreviews(filesArray);
    }
  };

  const generatePreviews = async (files: File[]) => {
    setIsProcessing(true);
    setError(null);

    try {
      const checkmarksPdfBytes = await createCheckmarkPdf();
      const checkmarksPdf = await PDFDocument.load(checkmarksPdfBytes);
      const [checkmarksPage] = checkmarksPdf.getPages();

      const previews = [];

      for (const file of files) {
        try {
          const inputPdfBytes = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(inputPdfBytes);
          const embeddedPage = await pdfDoc.embedPage(checkmarksPage);

          const pages = pdfDoc.getPages();
          for (let i = 1; i < pages.length; i++) {
            pages[i].drawPage(embeddedPage);
          }

          const modifiedPdfBytes = await pdfDoc.save();
          const blob = new Blob([modifiedPdfBytes], {
            type: "application/pdf",
          });
          const url = URL.createObjectURL(blob);

          previews.push({
            url,
            name: getOutputFileName(file.name),
          });
        } catch (err) {
          console.error(`Error generating preview for ${file.name}:`, err);
          continue;
        }
      }

      setPreviewUrls(previews);
      if (previews.length === 0) {
        setError(
          "Could not generate previews for any files. Please check if they are valid PDFs."
        );
      }
    } catch (err) {
      console.error("Error in preview generation:", err);
      setError("An unexpected error occurred while generating previews.");
    } finally {
      setIsProcessing(false);
    }
  };

  const processAllFiles = async () => {
    if (inputFiles.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const checkmarksPdfBytes = await createCheckmarkPdf();
      const checkmarksPdf = await PDFDocument.load(checkmarksPdfBytes);
      const [checkmarksPage] = checkmarksPdf.getPages();

      const processedFiles = [];

      for (const file of inputFiles) {
        try {
          const inputPdfBytes = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(inputPdfBytes);
          const embeddedPage = await pdfDoc.embedPage(checkmarksPage);

          const pages = pdfDoc.getPages();
          for (let i = 1; i < pages.length; i++) {
            pages[i].drawPage(embeddedPage);
          }

          const modifiedPdfBytes = await pdfDoc.save();
          const blob = new Blob([modifiedPdfBytes], {
            type: "application/pdf",
          });

          processedFiles.push({
            url: URL.createObjectURL(blob),
            name: getOutputFileName(file.name),
            blob: blob,
          });
        } catch (err) {
          console.error(`Error processing file ${file.name}:`, err);
          continue;
        }
      }

      setOutputFiles(processedFiles);
      if (processedFiles.length === 0) {
        setError(
          "Failed to process all selected files. Please check if they are valid PDFs."
        );
      }
    } catch (err) {
      console.error("Error in processing:", err);
      setError("An unexpected error occurred during processing.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAll = async () => {
    if (outputFiles.length === 0) return;

    setIsProcessing(true);
    try {
      if (outputFiles.length === 1) {
        // Single file download
        saveAs(outputFiles[0].blob, outputFiles[0].name);
      } else {
        // Multiple files - create a ZIP
        const zip = new JSZip();
        const folder = zip.folder("processed_pdfs");

        for (const file of outputFiles) {
          folder?.file(file.name, file.blob);
        }

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "processed_pdfs.zip");
      }
    } catch (err) {
      console.error("Error creating zip file:", err);
      setError("Failed to create download package.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getOutputFileName = (originalName: string) => {
    const lastDotIndex = originalName.lastIndexOf(".");
    if (lastDotIndex === -1) return `${originalName}_checkmarks`;
    return `${originalName.substring(
      0,
      lastDotIndex
    )}_rv${originalName.substring(lastDotIndex)}`;
  };

  const clearFiles = () => {
    setInputFiles([]);
    setOutputFiles([]);
    setPreviewUrls([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (directoryInputRef.current) directoryInputRef.current.value = "";
  };

  useEffect(() => {
    return () => {
      previewUrls.forEach((file) => URL.revokeObjectURL(file.url));
      outputFiles.forEach((file) => URL.revokeObjectURL(file.url));
    };
  }, [previewUrls, outputFiles]);

  if (!hasMounted) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4 text-center">
          PDF Checkmark Adder
        </h1>
        <div className="h-96 flex items-center justify-center">
          <p>Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Añade Checkmark a tus PDF
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sube tus PDF uno a uno con click y ctrl dentro del explorador de
            archivos:
          </label>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            ref={fileInputRef}
            multiple
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 mb-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sube toda una carpeta:
          </label>
          <input
            type="file"
            // @ts-ignore - directory attribute is not standard but works in Chrome
            directory=""
            webkitdirectory=""
            onChange={handleDirectoryUpload}
            ref={directoryInputRef}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>
      </div>

      {inputFiles.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium text-gray-700">
              Selected files: {inputFiles.length}
            </p>
            <button
              onClick={clearFiles}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Clear all
            </button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inputFiles.map((file, index) => (
                    <tr
                      key={index}
                      className={`hover:bg-gray-50 cursor-pointer ${
                        activePreviewIndex === index ? "bg-blue-50" : ""
                      }`}
                      onClick={() => setActivePreviewIndex(index)}
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                        {file.name}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {(file.size / 1024).toFixed(2)} KB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {previewUrls.length > 0 && (
        <div className="mb-6 border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-2">Preview with Checkmarks</h3>
          <p className="text-sm text-gray-600 mb-2">
            Showing: {inputFiles[activePreviewIndex]?.name}
          </p>
          <div
            className="border rounded overflow-hidden"
            style={{ height: "500px" }}
          >
            <iframe
              src={previewUrls[activePreviewIndex]?.url}
              className="w-full h-full"
              title="PDF Preview"
            />
          </div>
          <div className="flex justify-between mt-2">
            <button
              onClick={() =>
                setActivePreviewIndex((prev) => Math.max(0, prev - 1))
              }
              disabled={activePreviewIndex === 0}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 self-center">
              {activePreviewIndex + 1} of {previewUrls.length}
            </span>
            <button
              onClick={() =>
                setActivePreviewIndex((prev) =>
                  Math.min(previewUrls.length - 1, prev + 1)
                )
              }
              disabled={activePreviewIndex === previewUrls.length - 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <button
          onClick={processAllFiles}
          disabled={
            inputFiles.length === 0 || isProcessing || outputFiles.length > 0
          }
          className={`flex-1 py-2 px-4 rounded-md text-white font-medium
            ${
              inputFiles.length === 0 || isProcessing || outputFiles.length > 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
        >
          {isProcessing
            ? "Processing..."
            : outputFiles.length > 0
            ? "Processing Complete"
            : "Process All Files"}
        </button>

        <button
          onClick={downloadAll}
          disabled={outputFiles.length === 0 || isProcessing}
          className={`flex-1 py-2 px-4 rounded-md text-white font-medium
            ${
              outputFiles.length === 0 || isProcessing
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            }`}
        >
          {isProcessing ? "Preparing Download..." : "Download All"}
          {outputFiles.length > 0 && ` (${outputFiles.length} files)`}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default PdfCheckmarkAdder;
