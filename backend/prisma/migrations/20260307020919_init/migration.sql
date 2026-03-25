-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'CAJERO');

-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA', 'QR');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('COMPLETADA', 'ANULADA', 'PENDIENTE');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'CAJERO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "codigoBarras" TEXT,
    "codigoInterno" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "precioCompra" DECIMAL(10,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 5,
    "unidadMedida" TEXT NOT NULL DEFAULT 'unidad',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "imagen" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "categoriaId" INTEGER,
    "proveedorId" INTEGER,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cajas" (
    "id" SERIAL NOT NULL,
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "montoInicial" DECIMAL(10,2) NOT NULL,
    "montoFinalReal" DECIMAL(10,2),
    "estado" "EstadoCaja" NOT NULL DEFAULT 'ABIERTA',
    "observaciones" TEXT,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "cajas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_caja" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cajaId" INTEGER NOT NULL,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "montoRecibido" DECIMAL(10,2),
    "vuelto" DECIMAL(10,2),
    "estado" "EstadoVenta" NOT NULL DEFAULT 'COMPLETADA',
    "observaciones" TEXT,
    "cajaId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta_items" (
    "id" SERIAL NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,

    CONSTRAINT "venta_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingresos_stock" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "numeroRemito" TEXT,
    "observaciones" TEXT,
    "total" DECIMAL(10,2),
    "proveedorId" INTEGER,

    CONSTRAINT "ingresos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingreso_stock_items" (
    "id" SERIAL NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2),
    "ingresoId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,

    CONSTRAINT "ingreso_stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigoBarras_key" ON "productos"("codigoBarras");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigoInterno_key" ON "productos"("codigoInterno");

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_stock" ADD CONSTRAINT "ingresos_stock_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_stock_items" ADD CONSTRAINT "ingreso_stock_items_ingresoId_fkey" FOREIGN KEY ("ingresoId") REFERENCES "ingresos_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_stock_items" ADD CONSTRAINT "ingreso_stock_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
