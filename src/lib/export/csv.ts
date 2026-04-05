export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const raw = String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map((column) => escapeCsv(column.header)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsv(column.value(row))).join(","));
  return [header, ...body].join("\n");
}

