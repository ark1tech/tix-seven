import type { ExportDataset } from "./types";

export async function datasetToXlsxBuffer(
  dataset: ExportDataset,
): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");

  const headerRow = dataset.columns.map((column) => column.header);
  const dataRows = dataset.rows.map((row) =>
    dataset.columns.map((column) => row[column.key] ?? ""),
  );

  const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Export");

  const output = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  return output as ArrayBuffer;
}
