DROP TABLE IF EXISTS "CardStageConnection";

CREATE TABLE "BoardStageTransition" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceColumnId" TEXT NOT NULL,
  "targetColumnId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoardStageTransition_sourceColumnId_fkey" FOREIGN KEY ("sourceColumnId") REFERENCES "BoardColumn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BoardStageTransition_targetColumnId_fkey" FOREIGN KEY ("targetColumnId") REFERENCES "BoardColumn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BoardStageTransition_sourceColumnId_targetColumnId_key" ON "BoardStageTransition"("sourceColumnId", "targetColumnId");
