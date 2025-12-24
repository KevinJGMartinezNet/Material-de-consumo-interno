# Material de Consumo Interno - NetSuite

Sistema completo para la gestión de solicitudes de material de consumo interno con flujo de aprobación automatizado y ajuste de inventario.

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

Este proyecto implementa un sistema completo de gestión de material de consumo interno en NetSuite que permite:

- Solicitar artículos de consumo interno.
- Flujo de aprobación multinivel (Jefe de Tienda → Gerente de Contraloría).
- Creación automática de ajustes de inventario.
- Notificaciones por correo electrónico en cada etapa.
- Trazabilidad completa del proceso.

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
Material de Consumo Interno
├── Registro Principal (customrecord_material_consumo_interno)
│   ├── Campos del Header
│   └── Sublista de Artículos (customrecord_consumo_linea)
│
├── Scripts
│   ├── User Events
│   │   ├── consumo_interno_ue.js
│   │   └── inv_adjustment_ue.js
│   ├── Client Scripts
│   │   ├── consumo_interno_client.js
│   │   └── consumo_interno_botones_client.js
│   └── Suitelets
│       ├── aprobar_cancelar_consumo_sl.js
│       └── crear_inv_adjustment.js
│
└── Configuración
    ├── Custom Lists
    ├── Transaction Body Fields
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

- NetSuite account con permisos de administrador
- Acceso a Customization > Scripting

### Paso 1: Crear Registros Personalizados

#### 1.1 Registro Principal

**Customization > Lists, Records, & Fields > Record Types > New**

```
Name: Material de Consumo Interno
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
| 2 | Aprobado por jefe |
| 3 | Pendiente de ajuste |
| 4 | Procesado |
| 5 | Cancelado |

### Paso 3: Crear Campo en Inventory Adjustment

**Customization > Lists, Records, & Fields > Transaction Body Fields > New**

```
Label: Creado desde
ID: custbody_creado_consumo
Type: List/Record
List/Record: Custom Record
Custom Record Type: customrecord_material_consumo_interno
Store Value: Yes

Applies To:
 Inventory (Inventory Adjustment debe estar incluido)
```

### Paso 4: Subir Scripts

**Documents > Files > SuiteScripts**

Subir los siguientes archivos:

1. `consumo_interno_ue.js`
2. `consumo_interno_client.js`
3. `consumo_interno_botones_client.js`
4. `aprobar_cancelar_consumo_sl.js`
5. `crear_inv_adjustment.js`
6. `inv_adjustment_ue.js`

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
| Jefe de Tienda (1020) | View, Edit, Create |
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
   - Ir a: Material de Consumo Interno > New
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

### 7. imprimir_consumo_pdf.js

**Tipo:** Suitelet  
**Aplica a:** Material de consumo interno

**Función:**
- `obtenerLineasArticulos()`: Detalla el PDF del número de documento seleccionado

**Características:**
- Escribe en PDF el número de documento
- Actualiza los datos dependiendo del estatus que tenga el documento
- Imprimir / Visualizar / Descargar

## Campos Personalizados

### En Material de Consumo Interno

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
- Sistema completo de Material de Consumo Interno
- Flujo de aprobación automatizado
- Integración con Inventory Adjustment
- Notificaciones por correo
- Búsqueda automática de artículos
- Control de permisos por rol

**Scripts implementados:**
- 7 scripts (2 User Events, 2 Client Scripts, 3 Suitelets)
- 2 registros personalizados
- 1 custom list
- 1 transaction body field

---

**Desarrollado para NetSuite**  
**Fecha:** Diciembre 2025

**Hecho por:** Kevin Jesús González Martínez
