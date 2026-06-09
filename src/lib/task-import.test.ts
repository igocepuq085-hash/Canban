import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { Priority } from "@prisma/client";
import { parseTaskWorkbook } from "./task-import.ts";

describe("task workbook import", () => {
  it("reads the downloadable task template", async () => {
    const workbook = await readFile("public/templates/shablon-importa-zadach.xlsx");
    const result = await parseTaskWorkbook(workbook);

    assert.equal(result.errors.length, 0);
    assert.equal(result.tasks.length, 3);
    assert.equal(result.tasks[0].title, "Пример: подготовить предложение");
    assert.equal(result.tasks[0].stage, "Входящие");
    assert.equal(result.tasks[0].priority, Priority.HIGH);
    assert.equal(result.tasks[0].dueDate?.getFullYear(), 2026);
    assert.equal(result.tasks[1].progress, 45);
  });
});
