import ExcelJS from "exceljs";
import JSZip from "jszip";
import { Priority } from "@prisma/client";

export type ImportedTask = {
  title: string;
  description: string | null;
  stage: string | null;
  assignee: string | null;
  priority: Priority;
  dueDate: Date | null;
  plannedStartDate: Date | null;
  plannedEndDate: Date | null;
  progress: number;
};

const aliases: Record<string, keyof ImportedTask> = {
  "название": "title",
  "название задачи": "title",
  "описание": "description",
  "этап": "stage",
  "исполнитель": "assignee",
  "исполнитель или почта": "assignee",
  "важность": "priority",
  "крайний срок": "dueDate",
  "плановое начало": "plannedStartDate",
  "плановое окончание": "plannedEndDate",
  "прогресс": "progress",
  "прогресс %": "progress"
};

const priorities: Record<string, Priority> = {
  "низкий": Priority.LOW,
  "обычный": Priority.MEDIUM,
  "средний": Priority.MEDIUM,
  "высокий": Priority.HIGH,
  "срочный": Priority.CRITICAL,
  "критический": Priority.CRITICAL
};

const cellText = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text.trim();
  if (typeof value === "object" && "result" in value) return cellText(value.result);
  return String(value).trim();
};

function parseDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const date = new Date(Math.round((value - 25569) * 86_400_000));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = cellText(value);
  const ru = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const date = ru ? new Date(Number(ru[3]), Number(ru[2]) - 1, Number(ru[1]), 12) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function loadWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    return workbook;
  } catch (error) {
    const zip = await JSZip.loadAsync(buffer);
    const workbookEntry = zip.file("xl/workbook.xml");
    if (!workbookEntry) throw error;
    const workbookXml = await workbookEntry.async("string");
    if (!workbookXml.includes("<x:workbook")) throw error;
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || !entry.name.endsWith(".xml")) continue;
      const xml = await entry.async("string");
      if (!xml.includes("xmlns:x=")) continue;
      zip.file(entry.name, xml.replace(/<(\/?)x:/g, "<$1").replace('xmlns:x="', 'xmlns="'));
    }
    const normalized = await zip.generateAsync({ type: "nodebuffer" });
    const normalizedWorkbook = new ExcelJS.Workbook();
    await normalizedWorkbook.xlsx.load(normalized as unknown as ArrayBuffer);
    return normalizedWorkbook;
  }
}

export async function parseTaskWorkbook(buffer: Buffer) {
  const workbook = await loadWorkbook(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("В книге нет листов");

  const headerMap = new Map<number, keyof ImportedTask>();
  sheet.getRow(1).eachCell((cell, column) => {
    const key = cellText(cell.value).toLowerCase().replace(/\s+/g, " ");
    const alias = aliases[key];
    if (alias) headerMap.set(column, alias);
  });
  if (![...headerMap.values()].includes("title")) throw new Error("В первой строке не найден столбец «Название»");

  const tasks: ImportedTask[] = [];
  const errors: string[] = [];
  const maxRow = Math.min(sheet.rowCount, 501);

  for (let rowNumber = 2; rowNumber <= maxRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const raw: Partial<Record<keyof ImportedTask, unknown>> = {};
    headerMap.forEach((field, column) => {
      raw[field] = row.getCell(column).value;
    });
    const title = cellText(raw.title);
    if (!title) {
      if (row.hasValues) errors.push(`Строка ${rowNumber}: нет названия`);
      continue;
    }
    const priorityText = cellText(raw.priority).toLowerCase();
    tasks.push({
      title: title.slice(0, 240),
      description: cellText(raw.description).slice(0, 5000) || null,
      stage: cellText(raw.stage) || null,
      assignee: cellText(raw.assignee) || null,
      priority: priorities[priorityText] ?? Priority.MEDIUM,
      dueDate: parseDate(raw.dueDate),
      plannedStartDate: parseDate(raw.plannedStartDate),
      plannedEndDate: parseDate(raw.plannedEndDate),
      progress: Math.max(0, Math.min(100, Number(cellText(raw.progress)) || 0))
    });
  }

  return { tasks, errors };
}
