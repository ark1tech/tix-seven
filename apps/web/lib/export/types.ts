export type ExportFormat = "csv" | "json" | "xlsx";

export type ExportScope = "all" | "filtered";

export type ExportRegistry = "tickets" | "gates" | "logs";

export type ExportRow = Record<string, string>;

export type ExportColumn = {
  key: string;
  header: string;
};

export type ExportDataset = {
  registry: ExportRegistry;
  columns: ExportColumn[];
  rows: ExportRow[];
};
