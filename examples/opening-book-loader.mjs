import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import {
  createOpeningBookFromCsv,
  createOpeningBookFromOracleArtifact,
  createOpeningBookFromText
} from "../src/index.js";

export async function loadOpeningBook(options) {
  if (!options.bookPath) return null;

  const format = resolveBookFormat(options.bookPath, options.bookFormat);
  let text;
  try {
    text = await readFile(options.bookPath, "utf8");
  } catch (error) {
    throw new Error(`Could not read opening book ${options.bookPath}: ${error.message}`);
  }

  try {
    if (format === "json") return createOpeningBookFromOracleArtifact(text);
    if (format === "csv") return createOpeningBookFromCsv(text);
    if (format === "tsv") return createOpeningBookFromCsv(text, { delimiter: "\t" });
    return createOpeningBookFromText(text);
  } catch (error) {
    throw new Error(`Could not load opening book ${options.bookPath}: ${error.message}`);
  }
}

export function resolveBookFormat(path, requested = "auto") {
  const format = parseBookFormat(requested);
  if (format !== "auto") return format;

  const extension = extname(path).toLowerCase();
  if (extension === ".json") return "json";
  if (extension === ".csv") return "csv";
  if (extension === ".tsv") return "tsv";
  return "text";
}

export function parseBookFormat(value = "auto") {
  const normalized = String(value || "auto").toLowerCase();
  if (normalized === "oracle" || normalized === "records") return "json";
  if (["auto", "json", "csv", "tsv", "text"].includes(normalized)) return normalized;
  throw new Error("--book-format must be auto, json, csv, tsv, text, oracle, or records.");
}
