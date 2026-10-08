// ============================================================
// SWAGGER CONFIGURATION
// ============================================================

const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'MyA Minimercado API',
      version: '1.0.0',
      description: `
        API para sistema POS (Punto de Venta) MyA Minimercado.
        
        ## Funcionalidades principales:
        - **Autenticación**: JWT con refresh tokens
        - **Ventas**: POS completo con manejo de stock
        - **Productos**: CRUD con búsqueda por código de barras
        - **Caja**: Apertura, cierre, movimientos y arqueo
        - **Stock**: Ingreso de mercadería, alertas de stock bajo
        - **Reportes**: Ventas, productos, cajas
        - **Usuarios**: Gestión de cajeros y admins
        - **Auditoría**: Log de todas las acciones
        
        ## Autenticación
        Todas las rutas (excepto \`/api/auth/login\` y \`/api/health\`) requieren header:
        \`\`\`
        Authorization: Bearer <JWT_TOKEN>
        \`\`\`
        
        ## Códigos de respuesta
        | Código | Significado |
        |--------|-------------|
        | 200 | Éxito |
        | 201 | Creado |
        | 400 | Error de validación |
        | 401 | No autenticado / Token inválido |
        | 403 | No autorizado / Conflicto de negocio |
        | 404 | No encontrado |
        | 409 | Conflicto (duplicado, stock, estado) |
        | 429 | Rate limit excedido |
        | 500 | Error interno |
      `,
      contact: {
        name: 'MyA Minimercado',
        email: 'admin@mya.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Servidor de desarrollo'
      },
      {
        url: 'https://api.mya.com',
        description: 'Servidor de producción'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido en /api/auth/login'
        }
      },
      schemas: {
        // ===== Auth =====
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@mya.com' },
            password: { type: 'string', format: 'password', example: 'Admin123!' }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['nombre', 'email', 'password'],
          properties: {
            nombre: { type: 'string', example: 'Juan Pérez' },
            email: { type: 'string', format: 'email', example: 'juan@mya.com' },
            password: { type: 'string', format: 'password', minLength: 8, example: 'Segura123!' },
            rol: { type: 'string', enum: ['ADMIN', 'CAJERO'], default: 'CAJERO' }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            usuario: { $ref: '#/components/schemas/Usuario' }
          }
        },
        Usuario: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Administrador' },
            email: { type: 'string', format: 'email', example: 'admin@mya.com' },
            rol: { type: 'string', enum: ['ADMIN', 'CAJERO'], example: 'ADMIN' },
            activo: { type: 'boolean', example: true },
            creadoEn: { type: 'string', format: 'date-time' }
          }
        },
        
        // ===== Productos =====
        Producto: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Coca-Cola 2.25L' },
            descripcion: { type: 'string', nullable: true, example: 'Bebida gaseosa' },
            codigoBarras: { type: 'string', nullable: true, example: '7790070000003' },
            codigoInterno: { type: 'string', nullable: true, example: 'INT-001' },
            precio: { type: 'number', format: 'decimal', example: 950.00 },
            precioCompra: { type: 'number', format: 'decimal', nullable: true, example: 700.00 },
            stock: { type: 'integer', example: 24 },
            stockMinimo: { type: 'integer', example: 6 },
            unidadMedida: { type: 'string', example: 'unidad' },
            activo: { type: 'boolean', example: true },
            imagen: { type: 'string', format: 'uri', nullable: true },
            categoriaId: { type: 'integer', nullable: true, example: 2 },
            proveedorId: { type: 'integer', nullable: true, example: 1 },
            categoria: { $ref: '#/components/schemas/Categoria' },
            proveedor: { $ref: '#/components/schemas/Proveedor' },
            creadoEn: { type: 'string', format: 'date-time' },
            actualizadoEn: { type: 'string', format: 'date-time' }
          }
        },
        ProductoCreate: {
          type: 'object',
          required: ['nombre', 'codigoBarras'],
          properties: {
            nombre: { type: 'string', minLength: 1, maxLength: 200, example: 'Arroz 1kg' },
            descripcion: { type: 'string', maxLength: 500, example: 'Arroz largo fino' },
            codigoBarras: { type: 'string', maxLength: 50, example: '7790070000001' },
            codigoInterno: { type: 'string', maxLength: 50, example: 'ARR-001' },
            precio: { type: 'number', minimum: 0, default: 0, example: 850 },
            precioCompra: { type: 'number', minimum: 0, example: 600 },
            stock: { type: 'integer', minimum: 0, default: 0, example: 50 },
            stockMinimo: { type: 'integer', minimum: 0, default: 5, example: 10 },
            unidadMedida: { type: 'string', default: 'unidad', example: 'kg' },
            imagen: { type: 'string', format: 'uri', example: 'https://...' },
            categoriaId: { type: 'integer', example: 1 },
            proveedorId: { type: 'integer', example: 2 }
          }
        },
        ProductoUpdate: {
          type: 'object',
          properties: {
            nombre: { type: 'string', minLength: 1, maxLength: 200 },
            descripcion: { type: 'string', maxLength: 500, nullable: true },
            codigoBarras: { type: 'string', maxLength: 50, nullable: true },
            codigoInterno: { type: 'string', maxLength: 50, nullable: true },
            precio: { type: 'number', minimum: 0 },
            precioCompra: { type: 'number', minimum: 0, nullable: true },
            stock: { type: 'integer', minimum: 0 },
            stockMinimo: { type: 'integer', minimum: 0 },
            unidadMedida: { type: 'string' },
            imagen: { type: 'string', format: 'uri', nullable: true },
            categoriaId: { type: 'integer', nullable: true },
            proveedorId: { type: 'integer', nullable: true },
            activo: { type: 'boolean' }
          }
        },
        Categoria: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Bebidas' },
            descripcion: { type: 'string', nullable: true },
            creadoEn: { type: 'string', format: 'date-time' }
          }
        },
        Proveedor: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Coca-Cola Argentina' },
            contacto: { type: 'string', nullable: true },
            telefono: { type: 'string', nullable: true },
            email: { type: 'string', format: 'email', nullable: true },
            activo: { type: 'boolean', example: true },
            creadoEn: { type: 'string', format: 'date-time' }
          }
        },
        
        // ===== Ventas =====
        VentaItem: {
          type: 'object',
          properties: {
            productoId: { type: 'integer', minimum: 1, example: 1 },
            cantidad: { type: 'integer', minimum: 1, example: 2 }
          }
        },
        VentaCreate: {
          type: 'object',
          required: ['cajaId', 'items'],
          properties: {
            cajaId: { type: 'integer', minimum: 1, example: 1 },
            items: { 
              type: 'array', 
              minItems: 1,
              items: { $ref: '#/components/schemas/VentaItem' }
            },
            metodoPago: { 
              type: 'string', 
              enum: ['EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA', 'QR'],
              default: 'EFECTIVO'
            },
            descuento: { type: 'number', minimum: 0, default: 0 },
            montoRecibido: { type: 'number', minimum: 0 },
            observaciones: { type: 'string', maxLength: 500 }
          }
        },
        Venta: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            fecha: { type: 'string', format: 'date-time' },
            subtotal: { type: 'number', format: 'decimal', example: 1900.00 },
            descuento: { type: 'number', format: 'decimal', example: 0 },
            total: { type: 'number', format: 'decimal', example: 1900.00 },
            metodoPago: { type: 'string', enum: ['EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA', 'QR'], example: 'EFECTIVO' },
            montoRecibido: { type: 'number', format: 'decimal', nullable: true },
            vuelto: { type: 'number', format: 'decimal', nullable: true },
            estado: { type: 'string', enum: ['COMPLETADA', 'ANULADA', 'PENDIENTE'], example: 'COMPLETADA' },
            observaciones: { type: 'string', nullable: true },
            cajaId: { type: 'integer', example: 1 },
            usuarioId: { type: 'integer', example: 1 },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  cantidad: { type: 'integer' },
                  precioUnitario: { type: 'number', format: 'decimal' },
                  subtotal: { type: 'number', format: 'decimal' },
                  producto: { $ref: '#/components/schemas/Producto' }
                }
              }
            },
            usuario: { $ref: '#/components/schemas/Usuario' },
            caja: { $ref: '#/components/schemas/Caja' }
          }
        },
        VentaListResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/Venta' } },
            pagination: { $ref: '#/components/schemas/Pagination' }
          }
        },
        
        // ===== Caja =====
        Caja: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            fechaApertura: { type: 'string', format: 'date-time' },
            fechaCierre: { type: 'string', format: 'date-time', nullable: true },
            montoInicial: { type: 'number', format: 'decimal', example: 5000.00 },
            montoFinalReal: { type: 'number', format: 'decimal', nullable: true },
            estado: { type: 'string', enum: ['ABIERTA', 'CERRADA'], example: 'ABIERTA' },
            observaciones: { type: 'string', nullable: true },
            usuarioId: { type: 'integer', example: 1 },
            usuario: { $ref: '#/components/schemas/Usuario' },
            totalVentas: { type: 'number', format: 'decimal', example: 15000.00 },
            cantidadVentas: { type: 'integer', example: 25 }
          }
        },
        CajaAbrir: {
          type: 'object',
          required: ['montoInicial'],
          properties: {
            montoInicial: { type: 'number', minimum: 0.01, example: 5000 },
            observaciones: { type: 'string', maxLength: 500 }
          }
        },
        CajaClose: {
          type: 'object',
          required: ['montoFinalReal'],
          properties: {
            montoFinalReal: { type: 'number', minimum: 0, example: 20000 },
            observaciones: { type: 'string', maxLength: 500 }
          }
        },
        CajaCloseResponse: {
          type: 'object',
          properties: {
            caja: { $ref: '#/components/schemas/Caja' },
            resumen: {
              type: 'object',
              properties: {
                montoInicial: { type: 'number', format: 'decimal' },
                totalVentas: { type: 'number', format: 'decimal' },
                ventasPorMetodo: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      metodoPago: { type: 'string' },
                      _sum: { type: 'object', properties: { total: { type: 'number' } } },
                      _count: { type: 'object', properties: { id: { type: 'integer' } } }
                    }
                  }
                },
                totalIngresos: { type: 'number', format: 'decimal' },
                totalEgresos: { type: 'number', format: 'decimal' },
                efectivoEsperado: { type: 'number', format: 'decimal' },
                montoFinalReal: { type: 'number', format: 'decimal' },
                diferencia: { type: 'number', format: 'decimal' }
              }
            }
          }
        },
        MovimientoCaja: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            tipo: { type: 'string', enum: ['INGRESO', 'EGRESO'], example: 'INGRESO' },
            monto: { type: 'number', format: 'decimal', example: 1000.00 },
            descripcion: { type: 'string', example: 'Pago proveedor' },
            fecha: { type: 'string', format: 'date-time' },
            cajaId: { type: 'integer', example: 1 }
          }
        },
        MovimientoCajaCreate: {
          type: 'object',
          required: ['tipo', 'monto', 'descripcion'],
          properties: {
            tipo: { type: 'string', enum: ['INGRESO', 'EGRESO'] },
            monto: { type: 'number', minimum: 0.01, example: 500 },
            descripcion: { type: 'string', minLength: 1, maxLength: 200, example: 'Pago de servicio' }
          }
        },
        
        // ===== Stock =====
        IngresoStockItem: {
          type: 'object',
          required: ['productoId', 'cantidad'],
          properties: {
            productoId: { type: 'integer', minimum: 1, example: 1 },
            cantidad: { type: 'integer', minimum: 1, example: 10 },
            precioUnitario: { type: 'number', minimum: 0, nullable: true, example: 800 }
          }
        },
        IngresoStockCreate: {
          type: 'object',
          required: ['items'],
          properties: {
            items: { type: 'array', minItems: 1, items: { $ref: '#/components/schemas/IngresoStockItem' } },
            proveedorId: { type: 'integer', nullable: true, example: 1 },
            numeroRemito: { type: 'string', maxLength: 50, example: '0001-00012345' },
            observaciones: { type: 'string', maxLength: 500 }
          }
        },
        IngresoStock: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            fecha: { type: 'string', format: 'date-time' },
            numeroRemito: { type: 'string', nullable: true },
            observaciones: { type: 'string', nullable: true },
            total: { type: 'number', format: 'decimal', nullable: true },
            proveedorId: { type: 'integer', nullable: true },
            proveedor: { $ref: '#/components/schemas/Proveedor' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  cantidad: { type: 'integer' },
                  precioUnitario: { type: 'number', format: 'decimal', nullable: true },
                  producto: { $ref: '#/components/schemas/Producto' }
                }
              }
            }
          }
        },
        
        // ===== Pagination =====
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 150 },
            totalPages: { type: 'integer', example: 8 }
          }
        },
        
        // ===== Error =====
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Error de validación' },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Email inválido' }
                }
              }
            }
          }
        },
        
        // ===== Health =====
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            proyecto: { type: 'string', example: 'MyA Minimercado' },
            version: { type: 'string', example: '1.0.0' }
          }
        }
      }
    },
    security: [
      { bearerAuth: [] }
    ],
    tags: [
      { name: 'Auth', description: 'Autenticación y autorización' },
      { name: 'Productos', description: 'Gestión de productos y catálogo' },
      { name: 'Ventas', description: 'Punto de venta y gestión de ventas' },
      { name: 'Caja', description: 'Apertura, cierre y arqueo de caja' },
      { name: 'Stock', description: 'Ingreso de mercadería y control de stock' },
      { name: 'Catalogos', description: 'Categorías y proveedores' },
      { name: 'Reportes', description: 'Reportes de ventas y stock' },
      { name: 'Usuarios', description: 'Gestión de usuarios (solo ADMIN)' },
      { name: 'Auditoria', description: 'Log de auditoría (solo ADMIN)' },
      { name: 'Health', description: 'Health check del sistema' }
    ]
  },
  apis: ['./src/routes/*.js']
}

const swaggerSpec = swaggerJsdoc(options)

module.exports = { swaggerSpec, swaggerUi }