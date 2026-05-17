import type { ExportDataset } from "./types";

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function datasetToCsv(dataset: ExportDataset): string {
  const headerLine = dataset.columns
    .map((column) => escapeCsvCell(column.header))
    .join(",");

  const dataLines = dataset.rows.map((row) =>
    dataset.columns
      .map((column) => escapeCsvCell(row[column.key] ?? ""))
      .join(","),
  );

  return [headerLine, ...dataLines].join("\n");
}
