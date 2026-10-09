-- CreateIndex
CREATE INDEX "cajas_estado_idx" ON "cajas"("estado");

-- CreateIndex
CREATE INDEX "cajas_fechaApertura_idx" ON "cajas"("fechaApertura");

-- CreateIndex
CREATE INDEX "cajas_usuarioId_fechaApertura_idx" ON "cajas"("usuarioId", "fechaApertura");

-- CreateIndex
CREATE INDEX "ingresos_stock_fecha_idx" ON "ingresos_stock"("fecha");

-- CreateIndex
CREATE INDEX "ingresos_stock_proveedorId_fecha_idx" ON "ingresos_stock"("proveedorId", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_caja_cajaId_tipo_idx" ON "movimientos_caja"("cajaId", "tipo");

-- CreateIndex
CREATE INDEX "movimientos_caja_cajaId_fecha_idx" ON "movimientos_caja"("cajaId", "fecha");

-- CreateIndex
CREATE INDEX "productos_activo_stock_stockMinimo_idx" ON "productos"("activo", "stock", "stockMinimo");

-- CreateIndex
CREATE INDEX "productos_activo_categoriaId_idx" ON "productos"("activo", "categoriaId");

-- CreateIndex
CREATE INDEX "productos_activo_nombre_idx" ON "productos"("activo", "nombre");

-- CreateIndex
CREATE INDEX "productos_activo_codigoBarras_idx" ON "productos"("activo", "codigoBarras");

-- CreateIndex
CREATE INDEX "productos_activo_codigoInterno_idx" ON "productos"("activo", "codigoInterno");

-- CreateIndex
CREATE INDEX "venta_items_ventaId_idx" ON "venta_items"("ventaId");

-- CreateIndex
CREATE INDEX "venta_items_productoId_ventaId_idx" ON "venta_items"("productoId", "ventaId");

-- CreateIndex
CREATE INDEX "ventas_cajaId_estado_fecha_idx" ON "ventas"("cajaId", "estado", "fecha");

-- CreateIndex
CREATE INDEX "ventas_fecha_idx" ON "ventas"("fecha");

-- CreateIndex
CREATE INDEX "ventas_cajaId_idx" ON "ventas"("cajaId");

-- CreateIndex
CREATE INDEX "ventas_usuarioId_fecha_idx" ON "ventas"("usuarioId", "fecha");
