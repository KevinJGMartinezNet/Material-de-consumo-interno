# Solicitud de consumo interno - NetSuite

Sistema completo para la gestión de solicitudes de Solicitud de consumo interno con flujo de aprobación automatizado y ajuste de inventario.

## Tabla de Contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Estructura del Sistema](#estructura-del-sistema)
- [Flujo de Trabajo](#flujo-de-trabajo)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
- [Scripts Implementados](#scripts-implementados)
- [Campos Personalizados](#campos-personalizados)
- [Roles y Permisos](#roles-y-permisos)
- [Troubleshooting](#troubleshooting)

## Descripción

Este proyecto implementa un sistema completo de gestión de Solicitud de consumo interno en NetSuite que permite:

- Solicitar artículos de consumo interno.
- Flujo de aprobación multinivel (Jefe de Tienda → Gerente de Contraloría / Administrador).
- Creación automática de ajustes de inventario.
- Notificaciones por correo electrónico en cada etapa.
- Trazabilidad completa del proceso.
- Candados para buenas prácticas.

## Características

### Funcionalidades Principales

- **Búsqueda automática de artículos por código**
- **Asignación automática de supervisor** como aprobador
- **Flujo de aprobación con botones** (Aprobar/Cancelar)
- **Notificaciones por correo** en cada cambio de estatus
- **Creación de ajuste de inventario** con edición antes de guardar
- **Vinculación automática** entre solicitud y ajuste
- **Validaciones de permisos** según roles
- **Tracking de estatus** en tiempo real

### Seguridad y Permisos

- Control de acceso basado en roles
- Validación de permisos en cada acción
- Auditoría completa de cambios

## Estructura del Sistema

```
Solicitud de consumo interno
├── Registro Principal (customrecord_material_consumo_interno)
│   ├── Campos del Header
│   └── Sublista de Artículos (customrecord_consumo_linea)
│
├── Scripts
│   ├── User Events
│   │   ├── consumo_interno_ue.js
│   │   ├── inv_adjustment_ue.js
│   │   ├── adj_consumo_interno.js
│   │   └── consecutivo_consumo_ue.js
│   ├── Client Scripts
│   │   ├── consumo_interno_client.js
│   │   └── consumo_interno_botones_client.js
│   └── Suitelets
│       ├── aprobar_cancelar_consumo_sl.js
│       ├── imprimir_adjustment_pdf.js
│       ├── imprimir_consumo_pdf.js
│       └── crear_inv_adjustment.js
│
└── Configuración
    ├── Custom Lists
    ├── Campos de transacciones
    └── Permisos por Rol
```

## Flujo de Trabajo

### 1. Creación de Solicitud

```
Usuario crea solicitud
    ↓
Sistema asigna automáticamente:
- Empleado solicitante (usuario actual)
- Jefe de tienda (supervisor del empleado)
- Fecha de solicitud (hoy)
- Estatus: "Pendiente por aprobar"
    ↓
Correo enviado al supervisor
```

### 2. Aprobación por Jefe de Tienda

```
Jefe de Tienda/Admin/Gerente Contraloría
    ↓
Click en botón "Aprobar"
    ↓
Estatus: "Aprobado por jefe"
Campo "Aprobado por": Usuario que aprobó
    ↓
Correos enviados a:
- Usuario ID: 66544
- Usuario ID: 3673
```

### 3. Ajuste de Inventario

```
Admin/Gerente Contraloría
    ↓
Click en "Ajustar Inventario"
    ↓
Sistema crea Inventory Adjustment
Estatus: "Pendiente de ajuste"
    ↓
Ajuste abierto en MODO EDICIÓN
(Usuario puede modificar cantidades, ubicaciones, etc.)
    ↓
Usuario guarda el ajuste
    ↓
Estatus: "Procesado"
Campo "Ajuste aplicado por": Usuario que guardó
    ↓
Correo enviado al solicitante original
```

### 4. Cancelación (Opcional)

```
Usuarios autorizados pueden cancelar en cualquier momento
    ↓
Sistema solicita motivo de cancelación
    ↓
Estatus: "Cancelado"
    ↓
Correos enviados a todos los involucrados
```

## Instalación

### Prerequisitos

- Cuenta de NetSuite con permisos de administrador
- Acceso a Customization > Scripting

### Paso 1: Crear Registros Personalizados

#### 1.1 Registro Principal

**Customization > Lists, Records, & Fields > Record Types > New**

```
Name: Solicitud de consumo interno
ID: customrecord_material_consumo_interno
Access Type: Use Permission List
```

**Campos del Header:**

| Etiqueta | ID | Tipo | Lista/Registro |
|----------|----|----|----------------|
| Estatus | custrecord_estatus_consumo_interno | List/Record | customlist_status_material_consumo |
| Aprobado por | custrecord_jefe_tienda | List/Record | Employee |
| Ajuste aplicado por | custrecord_gerente | List/Record | Employee |
| Fecha de solicitud | custrecord_fecha_solicitud | Date | - |
| Empleado que solicita | custrecord_solicitante | List/Record | Employee |
| Creación | custrecord_adjustment_creado | Checkbox | - |
| Ubicación | custrecord_ubicacion | List/Record | Location |
| Subsidiaria | custrecord_subsidiaria_mci | List/Record | Subsidiary |
| Motivo de Cancelación | custrecord_motivo_cancelacion | Text Area | - |
| Notas | custrecord_nota | Text Area | - |

#### 1.2 Registro de Líneas

**Customization > Lists, Records, & Fields > Record Types > New**

```
Name: Material Consumo Línea
ID: customrecord_consumo_linea
Access Type: Use Permission List
```

**Campos:**

| Etiqueta | ID | Tipo | Lista/Registro |
|----------|----|----|----------------|
| Material Consumo | custrecord_linea_parent | List/Record | customrecord_material_consumo_interno |
| Código | custrecord_linea_codigo | Text | - |
| Artículo | custrecord_linea_articulo | List/Record | Item |
| Cantidad | custrecord_linea_cantidad | Integer | - |
| Uso | custrecord_linea_uso | Text | - |
| Observación 1 | custrecord_linea_obs1 | Text | - |
| Observación 2 | custrecord_linea_obs2 | Text | - |
| Observación 3 | custrecord_linea_obs3 | Text | - |

**Configurar Sublista:**
- En `customrecord_material_consumo_interno`
- Tab: **Sublists**
- Agregar: `custrecord_linea_parent`

#### 1.3 Registro de consecutivo por ubicación poniendo prefijos personalizados

**Customization > Lists, Records, & Fields > Record Types > New**

```
Name: Control Consecutivos Consumo
ID: customrecord_control_consecutivos
Access Type: Use Permission List
```

**Campos:**

| Etiqueta | ID | Tipo | Lista/Registro |
|----------|----|----|----------------|
| Ubicación | custrecord_ctrl_ubicacion | List/Record | Location |
| Último Número | custrecord_ctrl_ultimo_num | Int | - |
| Prefijo | custrecord_ctrl_prefijo | Text | - |

### Paso 2: Crear Custom List para Estatus

**Customization > Lists, Records, & Fields > Custom Lists > New**

```
Name: Estatus Material Consumo
ID: customlist_status_material_consumo
```

**Valores:**

| ID | Valor |
|----|-------|
| 1 | Pendiente por aprobar |
| 2 | Aprobado |
| 3 | Pendiente de ajuste |
| 4 | Procesado |
| 5 | Cancelado |
| 6 | Generando |
| 7 | Completado |

### Paso 3: Crear Campo en Inventory Adjustment

**Customization > Lists, Records, & Fields > Transaction Body Fields > New**

```
Label: Creado SCI
ID: custbody_creado_consumo
Type: List/Record
List/Record: Custom Record
Custom Record Type: customrecord_material_consumo_interno
Store Value: Yes

Applies To:
 Inventory (Inventory Adjustment debe estar incluido) --> Ajuste de inventario
```

### Paso 4: Subir Scripts

**Documents > Files > SuiteScripts**

Subir los siguientes archivos:

1. `consumo_interno_ue.js`
2. `inv_adjustment_ue.js`
3. `adj_consumo_interno.js`
4. `consecutivo_consumo_ue.js`
5. `consumo_interno_client.js`
6. `consumo_interno_botones_client.js`
7. `aprobar_cancelar_consumo_sl.js`
8. `imprimir_adjustment_pdf.js`
9. `imprimir_consumo_pdf.js`
10. `crear_inv_adjustment.js`

### Paso 5: Crear y Desplegar Scripts

#### 5.1 User Event - Material Consumo

**Customization > Scripting > Scripts > New**

```
Script File: consumo_interno_ue.js
Name: Material Consumo - User Event
ID: customscript_consumo_ue

Functions:
- Before Load: beforeLoad
- Before Submit: beforeSubmit
- After Submit: afterSubmit
```

**Deploy:**
```
Title: Material Consumo - UE Deploy
Status: Released
Applies To: customrecord_material_consumo_interno
Event Types: Create, Edit, View
Log Level: Debug
```

#### 5.2 Client Script - Búsqueda de Artículos

**Customization > Scripting > Scripts > New**

```
Script File: consumo_interno_client.js
Name: Material Consumo - Client Script
ID: customscript_consumo_client

Functions:
- Page Init: pageInit
- Field Changed: fieldChanged
- Validate Line: validateLine
```

**Deploy:**
```
Title: Material Consumo - Client Deploy
Status: Released
Applies To: customrecord_material_consumo_interno
Forms: [Seleccionar tu formulario personalizado]
```

#### 5.3 Client Script - Botones

**Customization > Scripting > Scripts > New**

```
Script File: consumo_interno_botones_client.js
Name: Material Consumo - Botones
ID: customscript_consumo_botones_client
```

**Deploy:**
```
Title: Botones Deployment
Status: Released
Applies To: customrecord_material_consumo_interno
Forms: [Seleccionar tu formulario personalizado]
```

#### 5.4 Suitelet - Aprobar/Cancelar

**Customization > Scripting > Scripts > New**

```
Script File: aprobar_cancelar_consumo_sl.js
Name: Aprobar/Cancelar Material Consumo
ID: customscript_aprobar_consumo_sl

Functions:
- On Request: onRequest
```

**Deploy:**
```
Title: Aprobar/Cancelar Deployment
ID: customdeploy_aprobar_consumo_sl
Status: Released
```

#### 5.5 Suitelet - Crear Ajuste

**Customization > Scripting > Scripts > New**

```
Script File: crear_inv_adjustment.js
Name: Crear Inventory Adjustment
ID: customscript_crear_inv_adjustment

Functions:
- On Request: onRequest
```

**Deploy:**
```
Title: Crear Ajuste Deployment
ID: customdeploy_crear_inv_adjustment
Status: Released
```

#### 5.6 User Event - Inventory Adjustment

**Customization > Scripting > Scripts > New**

```
Script File: inv_adjustment_ue.js
Name: Inventory Adjustment - Material Consumo
ID: customscript_inv_adj_consumo_ue

Functions:
- After Submit: afterSubmit
```

**Deploy:**
```
Title: Inventory Adjustment Deploy
Status: Released
Applies To: Transaction → Inventory Adjustment
Event Types: Create, Edit
```


## Configuración

### Roles y Permisos

#### Roles con Permisos Especiales

| Rol | ID | Permisos |
|-----|----|----|
| Administrador | 3 | Aprobar, Cancelar, Ajustar Inventario |
| Jefe de Tienda | 1020 | Aprobar, Cancelar |
| Gerente Contraloría | 1223 | Aprobar, Cancelar, Ajustar Inventario |

#### Configurar Permisos del Registro

**Customization > Lists, Records, & Fields > Record Types**

Editar: `customrecord_material_consumo_interno`

**Tab: Permissions**

| Rol | Permiso |
|-----|---------|
| Administrator (3) | Full |
| Jefe de Tienda (1020) | View, Create |
| Gerente Contraloría (1223) | Full |

### Usuarios para Notificaciones

Los correos de aprobación se envían a:

```javascript
// En consumo_interno_ue.js
const USUARIOS_GERENCIA = [66544, 3673];
```

Para cambiar estos usuarios:
1. Edita el archivo `consumo_interno_ue.js`
2. Modifica el array `USUARIOS_GERENCIA`
3. Reemplaza el archivo en NetSuite

### Cuenta de Ajuste

El ajuste de inventario usa la cuenta ID: **1604**

Para cambiar:
1. Edita `crear_inv_adjustment.js`
2. Busca: `invAdj.setValue({ fieldId: 'account', value: 1604 });`
3. Cambia por el ID de tu cuenta

## Uso

### Para Usuarios Solicitantes

1. **Crear nueva solicitud**
   - Ir a: Solicitud de consumo interno > New
   - El sistema asigna automáticamente: Solicitante, Jefe, Fecha

2. **Agregar artículos**
   - En la sublista, ingresar el código del artículo
   - El sistema busca y selecciona el artículo automáticamente
   - Ingresar cantidad y uso
   - Agregar más líneas según necesidad

3. **Guardar**
   - Click en "Save"
   - El supervisor recibe correo de notificación

### Para Aprobadores (Jefe de Tienda)

1. **Revisar solicitud**
   - Abrir solicitud pendiente
   - Revisar artículos y cantidades

2. **Aprobar**
   - Click en botón "Aprobar"
   - Confirmar aprobación
   - Sistema notifica a Gerencia

3. **Cancelar (si aplica)**
   - Click en botón "Cancelar"
   - Ingresar motivo
   - Sistema notifica a involucrados

### Para Gerencia (Admin / Gerente Contraloría)

1. **Crear ajuste**
   - Abrir solicitud aprobada
   - Click en "Ajustar Inventario"
   - Sistema crea y abre ajuste en modo edición

2. **Revisar y modificar**
   - Verificar cantidades
   - Ajustar ubicaciones si necesario
   - Modificar cuenta o fecha si aplica

3. **Guardar ajuste**
   - Click en "Save"
   - Sistema marca como procesado
   - Solicitante recibe notificación

## Scripts Implementados

### 1. consumo_interno_ue.js

**Tipo:** User Event Script  
**Aplica a:** customrecord_material_consumo_interno

**Funciones:**
- `beforeLoad()`: Agrega botones según estatus y rol
- `beforeSubmit()`: Setea valores por defecto (solicitante, fecha, estatus)
- `afterSubmit()`: Envía notificaciones por correo según cambios de estatus

**Características:**
- Asignación automática de supervisor
- Control de permisos por rol
- Gestión de botones dinámicos
- Envío de correos automatizado

### 2. consumo_interno_client.js

**Tipo:** Client Script  
**Aplica a:** customrecord_material_consumo_interno

**Funciones:**
- `pageInit()`: Inicialización
- `fieldChanged()`: Búsqueda automática de artículos por código
- `validateLine()`: Valida que artículo y cantidad sean válidos

**Características:**
- Búsqueda en tiempo real
- Validación de datos
- Alertas al usuario

### 3. consumo_interno_botones_client.js

**Tipo:** Client Script  
**Aplica a:** customrecord_material_consumo_interno

**Funciones globales:**
- `aprobarSolicitud()`: Maneja la aprobación
- `cancelarSolicitud()`: Maneja la cancelación con motivo

**Características:**
- Confirmaciones de usuario
- Comunicación con Suitelet
- Refresco automático de página

### 4. aprobar_cancelar_consumo_sl.js

**Tipo:** Suitelet

**Función:**
- `onRequest()`: Procesa peticiones POST de aprobar/cancelar

**Características:**
- Validación de estatus
- Actualización de campos
- Respuestas JSON

### 5. crear_inv_adjustment.js

**Tipo:** Suitelet

**Función:**
- `onRequest()`: Crea Inventory Adjustment desde solicitud

**Características:**
- Validaciones múltiples
- Creación de líneas automática
- Redirección a modo edición
- Manejo robusto de errores

### 6. inv_adjustment_ue.js

**Tipo:** User Event Script  
**Aplica a:** Inventory Adjustment (Transaction)

**Función:**
- `afterSubmit()`: Detecta guardado y actualiza consumo a "Procesado"

**Características:**
- Detección de vinculación con consumo
- Actualización automática de estatus
- Notificación al solicitante

## Scripts Implementados - Descripción Detallada

### 7. consecutivo_consumo_ue.js

**Tipo:** User Event Script  
**Aplica a:** customrecord_material_consumo_interno  
**API Version:** 2.1

**Funciones:**
- `beforeSubmit()`: Genera consecutivos personalizados por ubicación antes de guardar

**Descripción:**
Este script genera automáticamente el nombre/folio del registro de consumo interno basándose en la ubicación seleccionada. Cada ubicación tiene un prefijo único configurado en el mapa `PREFIJOS_UBICACION`.

**Características:**
- **Mapa de prefijos por ubicación:** Contiene 13 ubicaciones diferentes con prefijos únicos
  - Ferrepacífico: SCI-F, SCI-C, SCI-M, SCI-MA, SCI-V, SCI-T, SCI-H
  - Pacific Standard: SCI-PT, SCI-PM
  - Tu Concreto: SCI-TCM, SCI-TCMA, SCI-TCB
- **Sistema de control de consecutivos:** Usa un registro personalizado (`customrecord_control_consecutivos`) para mantener el último número usado por ubicación
- **Creación automática de controles:** Si no existe un control para la ubicación, lo crea automáticamente iniciando en 1
- **Actualización atómica:** Incrementa el número consecutivo y lo guarda antes de asignar el nombre
- **Sistema de fallback:** Si hay error, genera un número basado en timestamp
- **Validaciones:** Verifica que exista ubicación antes de generar consecutivo

**Ejemplo de nombres generados:**
- Fondeport (ID: 5): `SCI-F1`, `SCI-F2`, `SCI-F3`...
- Mayoreo (ID: 23): `SCI-MA1`, `SCI-MA2`, `SCI-MA3`...
- Pacific Monterrey (ID: 24): `SCI-PM1`, `SCI-PM2`...

**Logging:**
- Debug: Búsqueda de control, creación de nuevo control
- Audit: Consecutivo generado, control actualizado
- Error: Ubicación sin prefijo, errores al obtener consecutivo

---

### 8. adj_consumo_interno.js

**Tipo:** User Event Script  
**Aplica a:** customrecord_material_consumo_interno  
**API Version:** 2.1

**Funciones:**
- `beforeSubmit()`: Valida el estado "Generando" y verifica que haya líneas
- `afterSubmit()`: Crea automáticamente el Inventory Adjustment cuando el estado es "Generando"

**Descripción:**
Este script maneja el flujo alternativo de creación de ajustes de inventario. Cuando el usuario cambia el estatus a "Generando" y guarda el registro, el script crea automáticamente un Inventory Adjustment con todas las líneas.

**Características:**
- **Detección de cambio de estado:** Compara estado actual vs anterior para detectar cambios a "Generando"
- **Validación de líneas:** Verifica que existan líneas antes de permitir guardar en modo "Generando"
- **Creación automática de ajuste:** 
  - Crea Inventory Adjustment en modo dinámico
  - Copia subsidiaria y ubicación del registro padre
  - Usa cuenta ID 123 por defecto
  - Itera todas las líneas y las agrega al ajuste
- **Actualización de estatus:** Cambia automáticamente a "Completado" después de crear el ajuste
- **Vinculación:** Guarda el ID del ajuste creado en el campo `custrecord_ajuste_inventario`
- **Manejo de errores:** Try-catch en cada función para logging detallado

**Flujo:**
1. Usuario cambia estado a "Generando"
2. `beforeSubmit()` valida que haya líneas
3. Usuario guarda
4. `afterSubmit()` crea el Inventory Adjustment
5. Script actualiza estado a "Completado"
6. Script vincula el ajuste al consumo

**Logging:**
- Audit: Estado cambiado, creando ajuste, ajuste creado
- Error: Errores en beforeSubmit, afterSubmit, al crear ajuste

**Nota:** Este script es una alternativa al flujo manual con botones. Permite crear ajustes automáticamente sin pasar por el modo edición.

---

### 9. imprimir_adjustment_pdf.js

**Tipo:** Suitelet  
**API Version:** 2.1

**Función:**
- `onRequest()`: Genera PDF del Inventory Adjustment

**Descripción:**
Suitelet que recibe el ID de un Inventory Adjustment y genera un PDF profesional con toda la información del ajuste, incluyendo encabezado, líneas de artículos y totales.

**Características:**
- **Carga de datos completos:**
  - Información del header: tranid, account, fecha, período, subsidiaria, ubicación
  - Campo personalizado: `custbody_creado_consumo` (Creado desde)
  - Líneas del ajuste: item, código, cantidades, ubicación, memo
- **Búsqueda de códigos de artículos:** Usa `search.lookupFields()` para obtener el itemid de cada artículo
- **Generación de HTML con estilos:** 
  - Logo de la empresa
  - Tablas con formato profesional
  - Colores para ajustes positivos (verde) y negativos (rojo)
  - Sección de firmas (Preparado, Revisado, Aprobado)
  - Footer con fecha de generación e ID interno
- **Formato landscape:** Usa tamaño Letter-LANDSCAPE para mejor visualización
- **Escape de caracteres XML:** Función `escapeXml()` para prevenir errores con caracteres especiales
- **Cálculos automáticos:**
  - Total de partidas
  - Ajuste total (suma de todos los ajustes)
  - Costo total formateado como moneda MXN
- **Nota informativa:** Incluye explicación sobre el impacto del ajuste

**Secciones del PDF:**
1. **Header:** Logo y título
2. **Información General:** Documento, fecha, subsidiaria, ubicación, cuenta, período, creado desde
3. **Artículos del Ajuste:** Tabla con código, artículo, cant. disponible, ajustar por, nueva cantidad
4. **Totales:** Total partidas, ajuste total, costo total
5. **Nota:** Explicación del ajuste
6. **Firmas:** Espacios para preparado, revisado y aprobado
7. **Footer:** Fecha de generación e ID interno

**Uso:**
```
URL: /app/site/hosting/scriptlet.nl?script=SCRIPT_ID&deploy=DEPLOY_ID&recordid=ADJUSTMENT_ID
```

**Logging:**
- Debug: Generando PDF, datos obtenidos, líneas obtenidas
- Audit: PDF generado
- Error: Error al generar PDF, error al obtener líneas, error al buscar código

---

### 10. imprimir_consumo_pdf.js

**Tipo:** Suitelet  
**API Version:** 2.1

**Función:**
- `onRequest()`: Genera PDF de la Solicitud de Consumo Interno

**Descripción:**
Suitelet que recibe el ID de una Solicitud de Consumo Interno y genera un PDF profesional con toda la información de la solicitud, incluyendo artículos solicitados, observaciones y firmas.

**Características:**
- **Carga de datos del header:**
  - Name (folio), estatus, fecha de creación
  - Subsidiaria, ubicación
  - Solicitante, jefe de tienda (aprobado por), gerente (aplicado por)
  - Ajuste creado, motivo de cancelación
- **Búsqueda de líneas:** Usa `search.create()` para obtener todas las líneas relacionadas
- **Información de líneas:**
  - Código y artículo
  - Cantidad
  - Uso y tres campos de observaciones
- **Generación de HTML con estilos:**
  - Logo de la empresa
  - Título y número de solicitud
  - Tablas con formato profesional
  - Badges de estatus con colores según estado
  - Sección de firmas para solicitante, aprobador y aplicador
  - Footer con fecha de generación e ID interno
- **Formato landscape:** Usa tamaño Letter-LANDSCAPE
- **Escape de caracteres XML:** Previene errores con caracteres especiales
- **Campos condicionales:**
  - Motivo de cancelación (solo si está cancelado)
  - Ajuste creado (solo si existe)
- **Formato de fecha:** Convierte fecha de creación a formato español

**Secciones del PDF:**
1. **Header:** Logo y título
2. **Información General:** Estatus, fecha, subsidiaria, ubicación, solicitante, aprobado por, aplicado por, ajuste
3. **Artículos Solicitados:** Tabla con código, artículo, cantidad, uso, 3 observaciones
4. **Total:** Conteo de artículos
5. **Firmas:** Espacios para solicitante, aprobado por, aplicado por
6. **Footer:** Fecha de generación e ID interno

**Uso:**
```
URL: /app/site/hosting/scriptlet.nl?script=SCRIPT_ID&deploy=DEPLOY_ID&recordid=CONSUMO_ID
```

**Logging:**
- Debug: Generando PDF, datos obtenidos, líneas obtenidas
- Audit: PDF generado
- Error: Error al generar PDF, error al obtener líneas

**Diferencias con imprimir_adjustment_pdf.js:**
- Este imprime la solicitud original (consumo interno)
- El otro imprime el ajuste de inventario generado
- Ambos se complementan para trazabilidad completa

---

## Tabla Resumen de Scripts

| Script | Tipo | Aplica a | Propósito Principal |
|--------|------|----------|-------------------|
| consecutivo_consumo_ue.js | User Event | Consumo Interno | Genera folios consecutivos por ubicación |
| adj_consumo_interno.js | User Event | Consumo Interno | Crea ajustes automáticamente en modo "Generando" |
| imprimir_adjustment_pdf.js | Suitelet | N/A | Genera PDF del Inventory Adjustment |
| imprimir_consumo_pdf.js | Suitelet | N/A | Genera PDF de la Solicitud de Consumo |
| consumo_interno_ue.js | User Event | Consumo Interno | Gestiona flujo, botones y notificaciones |
| consumo_interno_client.js | Client | Consumo Interno | Búsqueda automática de artículos |
| consumo_interno_botones_client.js | Client | Consumo Interno | Funciones de botones Aprobar/Cancelar |
| aprobar_cancelar_consumo_sl.js | Suitelet | N/A | Procesa aprobar/cancelar |
| crear_inv_adjustment.js | Suitelet | N/A | Crea ajuste en modo edición |
| inv_adjustment_ue.js | User Event | Inv. Adjustment | Actualiza consumo a "Procesado" |

---

## Flujo de Interacción entre Scripts

### Flujo Normal con Botones:
```
1. Usuario crea consumo
   └─> consecutivo_consumo_ue.js (genera folio)
   └─> consumo_interno_ue.js (asigna valores, envía correo)

2. Usuario agrega artículos
   └─> consumo_interno_client.js (búsqueda automática)

3. Jefe aprueba
   └─> consumo_interno_botones_client.js (click botón)
   └─> aprobar_cancelar_consumo_sl.js (actualiza registro)
   └─> consumo_interno_ue.js (envía correos)

4. Gerencia crea ajuste
   └─> consumo_interno_botones_client.js (click botón)
   └─> crear_inv_adjustment.js (crea ajuste)

5. Usuario guarda ajuste
   └─> inv_adjustment_ue.js (actualiza consumo a Procesado)
   └─> consumo_interno_ue.js (envía correo final)

6. Usuario imprime documentos
   └─> imprimir_consumo_pdf.js (PDF solicitud)
   └─> imprimir_adjustment_pdf.js (PDF ajuste)
```

### Flujo Alternativo con "Generando":
```
1-3. (igual que flujo normal)

4. Usuario cambia estado a "Generando" y guarda
   └─> adj_consumo_interno.js (crea ajuste automáticamente)
   └─> Consumo pasa a "Completado"

5. Usuario imprime documentos
   └─> imprimir_consumo_pdf.js (PDF solicitud)
   └─> imprimir_adjustment_pdf.js (PDF ajuste)
```

## Campos Personalizados

### En Solicitud de consumo interno

| Campo | ID | Tipo | Propósito |
|-------|----|----|-----------|
| Estatus | custrecord_estatus_consumo_interno | List | Control de flujo |
| Aprobado por | custrecord_jefe_tienda | Employee | Quién aprobó |
| Ajuste aplicado por | custrecord_gerente | Employee | Quién hizo ajuste |
| Fecha de solicitud | custrecord_fecha_solicitud | Date | Trazabilidad |
| Empleado que solicita | custrecord_solicitante | Employee | Solicitante |
| Creación | custrecord_adjustment_creado | Checkbox | Control duplicados |
| Ubicación | custrecord_ubicacion | Location | Para ajuste |
| Subsidiaria | custrecord_subsidiaria_mci | Subsidiary | Para ajuste |
| Motivo de Cancelación | custrecord_motivo_cancelacion | Text Area | Auditoría |

### En Líneas de Consumo

| Campo | ID | Tipo | Propósito |
|-------|----|----|-----------|
| Material Consumo | custrecord_linea_parent | Custom Record | Relación padre |
| Código | custrecord_linea_codigo | Text | Búsqueda rápida |
| Artículo | custrecord_linea_articulo | Item | Item de NetSuite |
| Cantidad | custrecord_linea_cantidad | Integer | Cantidad a consumir |
| Uso | custrecord_linea_uso | Text | Descripción uso |
| Observación 1-3 | custrecord_linea_obs1-3 | Text | Notas adicionales |

### En Inventory Adjustment

| Campo | ID | Tipo | Propósito |
|-------|----|----|-----------|
| Creado desde | custbody_creado_consumo | Custom Record | Vinculación |

## Roles y Permisos

### Matriz de Permisos

|        Acción       |     Usuario     | Jefe Tienda | Gerente | Admin |
|---------------------|-----------------|-------------|---------|-------|
| Crear Solicitud     |        Si       |      Si     |   Si    |  Si   |
| Ver Solicitud       | Si (propias)    |      Si     |   Si    |  Si   |
| Aprobar             |        No       |      Si     |   Si    |  Si   |
| Cancelar            |        No       |      Si     |   Si    |  Si   |
| Ajustar Inventario  |        No       |      No     |   Si    |  Si   |

### IDs de Roles

```javascript
const ROLES = {
    ADMINISTRADOR: 3,
    JEFE_TIENDA: 1020,
    GERENTE_CONTRALORIA: 1223
};
```

## Troubleshooting

### Problema: Botones no aparecen

**Síntomas:** Los botones "Aprobar", "Cancelar" o "Ajustar Inventario" no se muestran

**Soluciones:**
1. Verificar que el User Event esté en estatus "Released"
2. Verificar que tenga el Event Type "View" activado
3. Verificar que tu rol esté en la lista de permisos
4. Revisar Script Execution Log

### Problema: No se envían correos

**Síntomas:** Los correos no llegan a los destinatarios

**Soluciones:**
1. Verificar que los empleados tengan email configurado
2. Verificar que el campo "supervisor" esté lleno en Employee
3. Revisar Script Execution Log para errores
4. Verificar que `USUARIOS_GERENCIA` tenga IDs válidos

### Problema: Error al crear ajuste

**Síntomas:** Error "INVALID_FLD_VALUE" al crear ajuste

**Soluciones:**
1. Verificar que el campo `custbody_creado_consumo` existe
2. Verificar que aplica a Inventory Adjustment
3. Verificar que subsidiaria y ubicación estén llenas
4. Revisar que los artículos existan y estén activos

### Problema: Búsqueda de artículos no funciona

**Síntomas:** Al poner código, no se selecciona el artículo

**Soluciones:**
1. Verificar que el Client Script esté desplegado
2. Verificar que esté en tu formulario personalizado
3. Abrir consola del navegador (F12) para ver errores
4. Verificar que el campo de artículo no esté deshabilitado

### Problema: Ajuste no actualiza consumo a "Procesado"

**Síntomas:** El ajuste se guarda pero el consumo no cambia de estatus

**Soluciones:**
1. Verificar que `inv_adjustment_ue.js` esté desplegado
2. Verificar que aplica a "Inventory Adjustment" (Transaction)
3. Verificar que el campo `custbody_creado_consumo` esté lleno
4. Revisar Script Execution Log

### Logs para Debugging

**Ubicación:** Customization > Scripting > Script Execution Log

**Filtros útiles:**
- Script: Seleccionar el script específico
- Type: Error, Debug, Audit
- Date: Últimas 24 horas

**Logs clave:**

```
 Logs normales:
- "Solicitante asignado: Empleado ID: X"
- "Supervisor asignado: Empleado: X, Supervisor: Y"
- "Correo enviado exitosamente"
- "Ajuste creado: Inventory Adjustment ID: X"
- "Consumo actualizado: ID: X marcado como Procesado"

 Logs de error a revisar:
- "Empleado no encontrado"
- "Sin supervisor"
- "Sin email"
- "Error al enviar correo"
- "No se pudo setear campo personalizado"
```

## Soporte

Para reportar problemas o solicitar mejoras:

1. Revisar la sección [Troubleshooting](#troubleshooting)
2. Consultar Script Execution Log
3. Documentar el error con screenshots
4. Contactar al administrador del sistema

## Notas de Versión

### Versión 1.0.0 (Inicial)

**Características:**
- Sistema completo de Solicitud de consumo interno
- Flujo de aprobación automatizado
- Integración con Inventory Adjustment
- Notificaciones por correo
- Búsqueda automática de artículos
- Control de permisos por rol

**Scripts implementados:**
- 10 scripts (4 User Events, 2 Client Scripts, 4 Suitelets)
- 2 registros personalizados
- 1 custom list
- 1 transaction body field

---

**Desarrollado para NetSuite**  
**Fecha:** Diciembre 2025
**Hecho por:** Kevin Jesús González Martínez
