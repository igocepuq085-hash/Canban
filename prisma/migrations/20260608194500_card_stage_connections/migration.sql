CREATE TABLE "CardStageConnection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceCardId" TEXT NOT NULL,
  "targetColumnId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardStageConnection_sourceCardId_fkey" FOREIGN KEY ("sourceCardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CardStageConnection_targetColumnId_fkey" FOREIGN KEY ("targetColumnId") REFERENCES "BoardColumn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CardStageConnection_sourceCardId_targetColumnId_key" ON "CardStageConnection"("sourceCardId", "targetColumnId");
