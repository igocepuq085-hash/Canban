import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputPath = new URL("../../public/templates/shablon-importa-zadach.xlsx", import.meta.url);
const previewTasksPath = new URL("./preview-tasks.png", import.meta.url);
const previewGuidePath = new URL("./preview-guide.png", import.meta.url);

const workbook = Workbook.create();
const tasks = workbook.worksheets.add("Задачи");
const guide = workbook.worksheets.add("Инструкция");

const headers = [
  "Название",
  "Описание",
  "Этап",
  "Исполнитель или почта",
  "Важность",
  "Крайний срок",
  "Плановое начало",
  "Плановое окончание",
  "Прогресс %"
];

tasks.getRange("A1:I4").values = [
  headers,
  [
    "Пример: подготовить предложение",
    "Собрать требования и подготовить итоговую версию предложения.",
    "Входящие",
    "",
    "Высокий",
    "19.06.2026",
    "10.06.2026",
    "18.06.2026",
    0
  ],
  [
    "Пример: согласовать макет",
    "Получить обратную связь и зафиксировать финальный вариант.",
    "В работе",
    "owner@potok.local",
    "Обычный",
    "24.06.2026",
    "12.06.2026",
    "23.06.2026",
    45
  ],
  [
    "Пример: выпустить обновление",
    "Проверить готовность и опубликовать результат.",
    "Проверка и согласование",
    "",
    "Срочный",
    "27.06.2026",
    "20.06.2026",
    "26.06.2026",
    80
  ]
];

tasks.showGridLines = false;
tasks.freezePanes.freezeRows(1);
tasks.getRange("A1:I1").format = {
  fill: "#102A4C",
  font: { bold: true, color: "#E8F2FF" },
  wrapText: true,
  verticalAlignment: "center",
  horizontalAlignment: "center",
  rowHeight: 34,
  borders: { preset: "all", style: "thin", color: "#315A87" }
};
tasks.getRange("A2:I100").format = {
  fill: "#F5F8FC",
  font: { color: "#17263A" },
  verticalAlignment: "top",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: "#D5E0EC" }
};
tasks.getRange("A2:I4").format.fill = "#EAF2FB";
tasks.getRange("A1:A100").format.columnWidth = 30;
tasks.getRange("B1:B100").format.columnWidth = 44;
tasks.getRange("C1:C100").format.columnWidth = 27;
tasks.getRange("D1:D100").format.columnWidth = 30;
tasks.getRange("E1:E100").format.columnWidth = 16;
tasks.getRange("F1:H100").format.columnWidth = 20;
tasks.getRange("I1:I100").format.columnWidth = 14;
tasks.getRange("F2:H100").format.numberFormat = "dd.mm.yyyy";
tasks.getRange("I2:I100").format.numberFormat = "0";
tasks.getRange("A2:I100").format.rowHeight = 42;
tasks.getRange("C2:C100").dataValidation = {
  rule: {
    type: "list",
    values: ["Входящие", "Готово к работе", "В работе", "Проверка и согласование", "Выполнено"]
  }
};
tasks.getRange("E2:E100").dataValidation = {
  rule: { type: "list", values: ["Низкий", "Обычный", "Высокий", "Срочный"] }
};
tasks.getRange("I2:I100").dataValidation = {
  rule: { type: "whole", operator: "between", formula1: 0, formula2: 100 }
};
guide.getRange("A1:B1").values = [["Шаблон импорта задач", "Готовый формат для массового создания задач на доске"]];
guide.getRange("A1:B1").format = {
  fill: "#102A4C",
  font: { bold: true, color: "#E8F2FF", size: 14 },
  horizontalAlignment: "left",
  verticalAlignment: "center",
  rowHeight: 42
};
guide.getRange("A1").format.font = { bold: true, color: "#E8F2FF", size: 17 };
guide.getRange("B1").format.font = { bold: false, color: "#BBD3EF", size: 11 };
guide.getRange("A3:B11").values = [
  ["Что делать", "Как это работает"],
  ["1. Откройте лист «Задачи»", "Первая строка уже содержит обязательные названия столбцов."],
  ["2. Удалите примеры", "Оставьте заголовки и внесите свои задачи со второй строки."],
  ["3. Заполните название", "Это единственное обязательное поле."],
  ["4. Укажите этап", "Выберите значение из списка. Неизвестный этап попадет во «Входящие»."],
  ["5. Укажите исполнителя", "Используйте имя участника рабочего пространства или его почту."],
  ["6. Заполните даты", "Допустимы настоящие даты Excel или формат ДД.ММ.ГГГГ."],
  ["7. Загрузите файл", "На доске откройте «Импортировать задачи из Excel» и выберите этот файл."],
  ["Ограничения", "До 500 строк задач, файл .xlsx размером до 5 МБ."]
];
guide.showGridLines = false;
guide.freezePanes.freezeRows(3);
guide.getRange("A3:B3").format = {
  fill: "#176B87",
  font: { bold: true, color: "#FFFFFF" },
  rowHeight: 30,
  borders: { preset: "all", style: "thin", color: "#315A87" }
};
guide.getRange("A4:B11").format = {
  fill: "#F5F8FC",
  font: { color: "#17263A" },
  wrapText: true,
  verticalAlignment: "top",
  rowHeight: 42,
  borders: { preset: "all", style: "thin", color: "#D5E0EC" }
};
guide.getRange("A1:A11").format.columnWidth = 30;
guide.getRange("B1:B11").format.columnWidth = 72;

const inspected = await workbook.inspect({
  kind: "table",
  range: "Задачи!A1:I6",
  include: "values,formulas",
  tableMaxRows: 6,
  tableMaxCols: 9
});
console.log(inspected.ndjson);

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 30 },
  summary: "final formula error scan"
});
console.log(formulaErrors.ndjson);

const tasksPreview = await workbook.render({ sheetName: "Задачи", range: "A1:I8", scale: 1 });
await fs.writeFile(previewTasksPath, new Uint8Array(await tasksPreview.arrayBuffer()));
const guidePreview = await workbook.render({ sheetName: "Инструкция", range: "A1:B11", scale: 1 });
await fs.writeFile(previewGuidePath, new Uint8Array(await guidePreview.arrayBuffer()));

await fs.mkdir(new URL("../../public/templates/", import.meta.url), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`saved ${outputPath.pathname}`);
