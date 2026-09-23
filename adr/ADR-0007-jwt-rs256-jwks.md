# ADR-0007 — JWT RS256 con JWKS: la llave privada no sale del servicio de identidad

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-23 |
| Estado | Aceptada |

## Contexto

Varios servicios necesitan saber quién es el usuario y a qué negocio pertenece.
La opción cómoda es que cada servicio comparta un secreto simétrico y verifique
los tokens por su cuenta, pero eso reparte el secreto por todo el sistema: quien
comprometa un servicio puede **emitir** tokens válidos para cualquier usuario.

## Decisión

1. El servicio de identidad genera un par de llaves **RSA** y firma los access
   tokens con **RS256**. La llave privada vive únicamente ahí (o llega por
   `KUBO_JWT_PRIVATE_KEY` en producción).
2. Publica la llave pública en un documento **JWKS**.
3. El **API Gateway** es el único que valida la firma, contra el JWKS, con caché
   y refresco automático ante rotación de llave.
4. Tras validar, el gateway **elimina cualquier cabecera `X-User-*` enviada por
   el cliente** e inyecta la identidad real antes de reenviar la petición.
5. Los servicios internos confían en esas cabeceras porque **no son alcanzables
   desde fuera**: solo existen en la red privada de contenedores.

## Consecuencias

- **Positivas**: comprometer un servicio de negocio no permite emitir tokens; el
  gateway centraliza la política de acceso; los servicios no cargan librerías de
  criptografía ni conocen el formato del token.
- **Negativas**: el gateway es un punto único de fallo y un salto adicional de
  red. Se mitiga con healthchecks, límites de memoria y la posibilidad de
  escalarlo horizontalmente sin estado (los límites de tasa viven en Redis).
- **Siguiente paso**: mTLS entre gateway y servicios para la versión en clúster.
