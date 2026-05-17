import type { ExportDataset } from "./types";

export function datasetToJson(dataset: ExportDataset): string {
  const records = dataset.rows.map((row) => {
    const record: Record<string, string> = {};
    for (const column of dataset.columns) {
      record[column.header] = row[column.key] ?? "";
    }
    return record;
  });

  return JSON.stringify(records, null, 2);
}
