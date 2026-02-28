import { DataMindFile } from "@/pages/DataMind";
import { FileSpreadsheet } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  file: DataMindFile;
}

const DataMindFilePreview = ({ file }: Props) => {
  const schema = file.schema_info as { columns?: string[]; rows?: number };
  const preview = file.preview_data as Record<string, string>[];
  const columns = schema?.columns || [];

  if (columns.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/30">
        <FileSpreadsheet className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">{file.file_name}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {schema.rows} linhas · {columns.length} colunas
        </span>
      </div>

      {preview.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col} className="text-xs whitespace-nowrap">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col} className="text-xs whitespace-nowrap">
                      {row[col] || ""}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/20 border-t border-border/40">
        Mostrando preview das primeiras 5 linhas
      </div>
    </div>
  );
};

export default DataMindFilePreview;
