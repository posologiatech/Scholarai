import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp, Download, Database, MapPin, Calendar, Code2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface DataSUSResultProps {
  explanation: string;
  dataSource: string;
  disease: string;
  location: string;
  period: string;
  code: string;
  stdout: string;
  images: string[];
  tables: Array<{ title: string; headers: string[]; rows: string[][] }>;
  error: string | null;
}

export default function DataSUSResults({
  explanation,
  dataSource,
  disease,
  location,
  period,
  code,
  stdout,
  images,
  tables,
  error,
}: DataSUSResultProps) {
  const [showCode, setShowCode] = useState(false);
  const { locale } = useLanguage();

  return (
    <div className="space-y-4">
      {/* Metadata badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1">
          <Database className="h-3 w-3" />
          {dataSource}
        </Badge>
        {disease && (
          <Badge variant="outline" className="gap-1">
            {disease}
          </Badge>
        )}
        {location && (
          <Badge variant="outline" className="gap-1">
            <MapPin className="h-3 w-3" />
            {location}
          </Badge>
        )}
        {period && (
          <Badge variant="outline" className="gap-1">
            <Calendar className="h-3 w-3" />
            {period}
          </Badge>
        )}
      </div>

      {/* Explanation */}
      <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {explanation}
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive font-mono">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stdout */}
      {stdout && (
        <Card>
          <CardContent className="pt-4">
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap overflow-x-auto max-h-[400px] overflow-y-auto">
              {stdout}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Tables */}
      {tables.map((table, idx) => (
        <Card key={idx}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{table.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {table.headers.map((h, i) => (
                      <TableHead key={i} className="bg-muted/50 text-xs font-semibold">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.rows.slice(0, 20).map((row, ri) => (
                    <TableRow key={ri} className={ri % 2 === 0 ? "" : "bg-muted/20"}>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className="text-xs py-1.5">
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {table.rows.length > 20 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {locale === "pt"
                    ? `Mostrando 20 de ${table.rows.length} linhas`
                    : `Showing 20 of ${table.rows.length} rows`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Charts */}
      {images.map((img, idx) => (
        <Card key={idx}>
          <CardContent className="pt-4 flex justify-center">
            <img
              src={`data:image/png;base64,${img}`}
              alt={`Chart ${idx + 1}`}
              className="max-w-full rounded-lg"
            />
          </CardContent>
        </Card>
      ))}

      {/* Source badge */}
      {(stdout || images.length > 0 || tables.length > 0) && (
        <p className="text-[10px] text-muted-foreground italic">
          Fonte: {dataSource}/DataSUS — Dados simulados com base em padrões epidemiológicos reais
        </p>
      )}

      {/* Code toggle */}
      {code && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCode(!showCode)}
            className="gap-1 text-xs text-muted-foreground"
          >
            <Code2 className="h-3 w-3" />
            {showCode
              ? (locale === "pt" ? "Ocultar código" : "Hide code")
              : (locale === "pt" ? "Ver código" : "Show code")}
            {showCode ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          {showCode && (
            <pre className="mt-2 p-3 bg-muted/50 rounded-lg text-xs font-mono overflow-x-auto max-h-[400px] overflow-y-auto border">
              {code}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
