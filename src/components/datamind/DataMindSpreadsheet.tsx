import { useMemo, useState, useCallback } from "react";
import DataGrid, { SelectColumn, type Column, type SortColumn } from "react-data-grid";
import { FileSpreadsheet, Grid3X3, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";


interface Props {
  fileName: string;
  data: Record<string, string>[];
  columns: string[];
  onSelectionChange?: (context: { data: Record<string, string>[]; summary: string } | null) => void;
}

type Row = { [key: string]: string | number; __rowIndex: number };

const DataMindSpreadsheet = ({ fileName, data, columns: colNames, onSelectionChange }: Props) => {
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<number>>(new Set());
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([]);

  const columns: readonly Column<Row>[] = useMemo(() => {
    const cols: Column<Row>[] = [
      {
        ...SelectColumn,
        frozen: true,
        width: 50,
      },
    ];

    colNames.forEach((name) => {
      cols.push({
        key: name,
        name: name,
        resizable: true,
        sortable: true,
        width: Math.max(120, Math.min(name.length * 10 + 40, 300)),
      });
    });

    return cols;
  }, [colNames]);

  const rows: readonly Row[] = useMemo(() => {
    return data.map((row, i) => ({ ...row, __rowIndex: i }));
  }, [data]);

  const sortedRows = useMemo(() => {
    if (sortColumns.length === 0) return rows;
    return [...rows].sort((a, b) => {
      for (const sort of sortColumns) {
        const aVal = String(a[sort.columnKey] ?? "");
        const bVal = String(b[sort.columnKey] ?? "");
        const numA = Number(aVal);
        const numB = Number(bVal);
        let cmp: number;
        if (!isNaN(numA) && !isNaN(numB)) {
          cmp = numA - numB;
        } else {
          cmp = aVal.localeCompare(bVal);
        }
        if (cmp !== 0) return sort.direction === "ASC" ? cmp : -cmp;
      }
      return 0;
    });
  }, [rows, sortColumns]);

  const handleSelectedRowsChange = useCallback(
    (newSelected: Set<number>) => {
      setSelectedRows(newSelected);

      if (newSelected.size === 0) {
        onSelectionChange?.(null);
        return;
      }

      const selectedData = data.filter((_, i) => newSelected.has(i));
      onSelectionChange?.({
        data: selectedData,
        summary: `${newSelected.size} linha${newSelected.size > 1 ? "s" : ""} selecionada${newSelected.size > 1 ? "s" : ""}`,
      });
    },
    [data, onSelectionChange]
  );

  const clearSelection = () => {
    setSelectedRows(new Set());
    onSelectionChange?.(null);
  };

  const rowKeyGetter = (row: Row) => row.__rowIndex;

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/30">
        <FileSpreadsheet className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">{fileName}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {data.length.toLocaleString()} linhas · {colNames.length} colunas
        </span>
      </div>

      {/* Instructional text */}
      <div className="px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/10 border-b border-border/30">
        <Grid3X3 className="h-3.5 w-3.5" />
        <span>(Opcional) Selecione linhas para focar a análise da IA em dados específicos</span>
      </div>

      {/* Grid */}
      <div
        className="rdg-wrapper"
        style={{ height: Math.min(400, (data.length + 1) * 35 + 2) }}
      >
        <DataGrid
          columns={columns}
          rows={sortedRows}
          rowKeyGetter={rowKeyGetter}
          selectedRows={selectedRows}
          onSelectedRowsChange={handleSelectedRowsChange}
          sortColumns={sortColumns}
          onSortColumnsChange={setSortColumns}
          className="rdg-light fill-grid"
          style={{ height: "100%" }}
          rowHeight={35}
          headerRowHeight={38}
        />
      </div>

      {/* Status bar */}
      <div className="px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 border-t border-border/40">
        {selectedRows.size > 0 ? (
          <>
            <Badge variant="secondary" className="text-xs gap-1 bg-primary/10 text-primary border-primary/20">
              {selectedRows.size} linha{selectedRows.size > 1 ? "s" : ""} selecionada{selectedRows.size > 1 ? "s" : ""}
            </Badge>
            <button
              onClick={clearSelection}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Limpar
            </button>
          </>
        ) : (
          <span>Planilha interativa · clique no checkbox para selecionar linhas</span>
        )}
      </div>
    </div>
  );
};

export default DataMindSpreadsheet;
