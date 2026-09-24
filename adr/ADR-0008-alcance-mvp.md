# ADR-0008 — Alcance declarado del MVP y recortes conscientes

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-23 |
| Estado | Aceptada |

## Contexto

La entrega del MVP ocurre en una jornada. Es imposible cubrir un ERP/CRM de
producción completo, y fingir lo contrario sería peor que recortar con criterio.

## Decisión

Se prioriza lo que **demuestra arquitectura funcionando de extremo a extremo** y
se documenta lo que queda fuera, con su ruta de implementación.

### Incluido y funcionando

- Cuatro microservicios + gateway + PWA, con base de datos por servicio.
- JWT RS256 con JWKS, rotación de refresh tokens con detección de reuso,
  contraseñas con BCrypt, auditoría encadenada.
- Cifrado AES-256-GCM de datos personales con índice ciego y enmascarado.
- Venta transaccional con bloqueo pesimista de inventario y kardex.
- Eventos de dominio por RabbitMQ con consumidor idempotente y DLQ.
- Tablero con agregaciones sobre MongoDB y PWA instalable con cola offline.
- Aislamiento por negocio verificado por prueba automática.

### Fuera del MVP (con ruta definida)

| Recorte | Por qué | Cuándo |
| --- | --- | --- |
| *Transactional outbox* | Requiere tabla de salida y publicador de barrido; el MVP ya no bloquea la venta por el bus | Fase 1 (P-01) |
| Activación de RLS | Necesita interceptor de transacción probado con concurrencia | Fase 1 (P-02) |
| Refresh token en cookie httpOnly | Exige BFF con cookies; hoy vive en el navegador (documentado) | Fase 1 (P-03) |
| Recuperación de contraseña por correo | Requiere proveedor de correo y plantillas | Fase 1 (P-04) |
| Facturación electrónica DIAN (UBL 2.1, CUFE, QR) | Requiere ser Proveedor Tecnológico autorizado; el puerto de facturación queda preparado | Fase 4 (P-18) |
| Multi-rubro (Vertical Packs) | El MVP demuestra un vertical (retail) completo | Fase 4 (P-17) |
| Kubernetes y Terraform | El despliegue objetivo es un local con Docker Compose | Fase 5 |

## Consecuencias

- **Positivas**: el sistema se entrega funcionando y verificado, con un mapa
  honesto de lo que falta; nada se presenta como terminado sin estarlo.
- **Negativas**: el producto no está listo para un negocio real sin antes
  completar la Fase 1 (outbox, RLS, cookie httpOnly, recuperación de contraseña).
- **Regla derivada**: ningún recorte se oculta en la documentación; cada uno
  aparece en este ADR y en la matriz de trazabilidad.
