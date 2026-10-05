-- CreateIndex
CREATE UNIQUE INDEX "BusinessHours_restaurantId_dayOfWeek_key" ON "BusinessHours"("restaurantId", "dayOfWeek");
