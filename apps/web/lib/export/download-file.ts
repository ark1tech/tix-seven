import { datasetToCsv } from "./to-csv";
import { datasetToJson } from "./to-json";
import { datasetToXlsxBuffer } from "./to-xlsx";
import type { ExportDataset, ExportFormat } from "./types";

const MIME_BY_FORMAT: Record<ExportFormat, string> = {
  csv: "text/csv;charset=utf-8",
  json: "application/json;charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const EXT_BY_FORMAT: Record<ExportFormat, string> = {
  csv: "csv",
  json: "json",
  xlsx: "xlsx",
};

export function buildExportFilename(
  eventId: string,
  registry: string,
  format: ExportFormat,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const shortId = eventId.slice(0, 8);
  return `${shortId}-${registry}-${date}.${EXT_BY_FORMAT[format]}`;
}

async function datasetToBlob(
  dataset: ExportDataset,
  format: ExportFormat,
): Promise<Blob> {
  if (format === "csv") {
    return new Blob([datasetToCsv(dataset)], { type: MIME_BY_FORMAT.csv });
  }

  if (format === "json") {
    return new Blob([datasetToJson(dataset)], { type: MIME_BY_FORMAT.json });
  }

  const buffer = await datasetToXlsxBuffer(dataset);
  return new Blob([buffer], { type: MIME_BY_FORMAT.xlsx });
}

export async function downloadExportFile(
  dataset: ExportDataset,
  format: ExportFormat,
  filename: string,
): Promise<void> {
  const blob = await datasetToBlob(dataset, format);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
