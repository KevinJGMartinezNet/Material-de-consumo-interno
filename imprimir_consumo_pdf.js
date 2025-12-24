/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/render', 'N/file', 'N/runtime'],
    function(record, search, render, file, runtime) {
    
    /**
     * Recopilación de Datos Suitelet
     */
    function onRequest(context) {
        try {
            const request = context.request;
            const response = context.response;
            
            if (request.method !== 'GET') {
                response.write('Método no permitido');
                return;
            }
            
            const recordId = request.parameters.recordid;
            
            if (!recordId) {
                response.write('Error: No se proporcionó ID de registro');
                return;
            }
            
            log.debug('Generando PDF', `Record ID: ${recordId}`);
            
            const consumoRecord = record.load({
                type: 'customrecord_material_consumo_interno',
                id: recordId
            });
            
            const datos = {
                id: recordId,
                name: consumoRecord.getValue({ fieldId: 'name' }) || '',
                estatus: consumoRecord.getText({ fieldId: 'custrecord_estatus_consumo_interno' }) || '',
                fecha: consumoRecord.getValue({ fieldId: 'created' }) || '',
                subsidiaria: consumoRecord.getText({ fieldId: 'custrecord_subsidiaria_mci' }) || '',
                ubicacion: consumoRecord.getText({ fieldId: 'custrecord_ubicacion' }) || '',
                solicitante: consumoRecord.getText({ fieldId: 'custrecord_solicitante' }) || '',
                jefeTienda: consumoRecord.getText({ fieldId: 'custrecord_jefe_tienda' }) || '',
                gerente: consumoRecord.getText({ fieldId: 'custrecord_gerente' }) || '',
                adjustmentCreado: consumoRecord.getText({ fieldId: 'custrecord_ajuste_inventario' }) || '',
                motivoCancelacion: consumoRecord.getValue({ fieldId: 'custrecord_motivo_cancelacion' }) || ''
            };
            
            const lineas = obtenerLineasArticulos(recordId);
            
            log.debug('Datos obtenidos', {
                header: datos,
                lineas: lineas.length
            });
            
            const htmlContent = generarHTML(datos, lineas);
            
            const pdfFile = render.create();
            pdfFile.templateContent = htmlContent;
            
            const pdfOutput = pdfFile.renderAsPdf();

            pdfOutput.name = 'Solicitud de consumo interno - ' + datos.name + '.pdf';

            response.writeFile({
                file: pdfOutput,
                isInline: true 
            });
            
            log.audit('PDF generado', `Record ID: ${recordId}`);
            
        } catch (e) {
            log.error('Error al generar PDF', {
                message: e.message,
                stack: e.stack
            });
            
            context.response.write('<html><body><h1>Error al generar PDF</h1><p>' + e.message + '</p></body></html>');
        }
    }
    
    /**
     * Función de obtener las líneas de los artículos mediante un search
     */
    function obtenerLineasArticulos(parentId) {
        const lineas = [];
        
        try {
            const lineaSearch = search.create({
                type: 'customrecord_consumo_linea',
                filters: [
                    ['custrecord_linea_parent', 'anyof', parentId]
                ],
                columns: [
                    'custrecord_linea_codigo',
                    'custrecord_linea_articulo',
                    'custrecord_linea_cantidad',
                    'custrecord_linea_uso',
                    'custrecord_linea_obs1',
                    'custrecord_linea_obs2',
                    'custrecord_linea_obs3'
                ]
            });
            
            lineaSearch.run().each(function(result) {
                lineas.push({
                    codigo: result.getValue('custrecord_linea_codigo') || '',
                    articulo: result.getText('custrecord_linea_articulo') || 'N/A',
                    cantidad: result.getValue('custrecord_linea_cantidad') || '0',
                    uso: result.getValue('custrecord_linea_uso') || '',
                    obs1: result.getValue('custrecord_linea_obs1') || '',
                    obs2: result.getValue('custrecord_linea_obs2') || '',
                    obs3: result.getValue('custrecord_linea_obs3') || ''
                });
                return true;
            });
            
            log.debug('Líneas obtenidas', `Total: ${lineas.length}`);
            
        } catch (e) {
            log.error('Error al obtener líneas', e);
        }
        
        return lineas;
    }
    
    /**
     * Genera el HTML para el PDF 
     * DATO: NO MOVER NINGUNA VARIABLE PORQUE EL XML LE DA ANSIEDAD Y NO LO LEE, ASÍ QUE COMO ESTA EL CÓDIGO FAVOR DE NO MOVERLO, YA SI QUIEREN PONER UN DISEÑO DISTINTO ADELANTE PERO RESPETANDO LAS NORMAS DEL XML.
     */
    function generarHTML(datos, lineas) {
        const ahora = new Date();
        const fechaGeneracion = ahora.toLocaleDateString('es-MX') + ' ' + ahora.toLocaleTimeString('es-MX');
        
        let html = `<?xml version="1.0"?>
<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">
<pdf>
<head>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            font-size: 10pt;
        }
        table { 
            width: 100%; 
            border-collapse: collapse;
        }
        .header-table {
            margin-bottom: 20px;
        }
        .info-table td {
            border: 1px solid #ddd;
            padding: 8px;
        }
        .items-table {
            margin-top: 20px;
        }
        .items-table th {
            background-color: #2c5f8d;
            color: white;
            text-align: left;
            padding: 10px;
            font-weight: bold;
        }
        .items-table td {
            border: 1px solid #ddd;
            padding: 8px;
        }
        .items-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .title {
            font-size: 24pt;
            font-weight: bold;
            text-align: center;
            color: #2c5f8d;
        }
        .subtitle {
            font-size: 14pt;
            text-align: center;
            color: #666;
        }
        .label {
            font-weight: bold;
            color: #333;
        }
        .section-title {
            font-size: 14pt;
            color: #2c5f8d;
            font-weight: bold;
            margin-top: 20px;
            margin-bottom: 10px;
            border-bottom: 2px solid #2c5f8d;
            padding-bottom: 5px;
        }
        .footer {
            font-size: 8pt;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 10px;
            margin-top: 30px;
        }
        .status-badge {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 3px;
            font-weight: bold;
        }
        .status-pendiente { background-color: #fff3cd; color: #856404; }
        .status-aprobado { background-color: #d4edda; color: #155724; }
        .status-procesado { background-color: #d1ecf1; color: #0c5460; }
        .status-cancelado { background-color: #f8d7da; color: #721c24; }
        .firma-section {
            margin-top: 50px;
        }
        .firma-box {
            text-align: center;
            border-top: 1px solid #333;
            padding-top: 5px;
            margin-top: 40px;
        }
    </style>
</head>
<body padding="0.5in 0.5in 0.5in 0.5in" size="Letter-LANDSCAPE">
    <table class="header-table">
        <tr>
            <td style="width: 50%; vertical-align: top;">
                <img src="https://5017898-sb2.app.netsuite.com/core/media/media.nl?id=2476210&amp;c=5017898_SB2&amp;h=Srg9OB9O_PmgQeXOZ9XtWuou_SAND_5ci74MaZw1PT43NVyv&amp;fcts=20251224094454&amp;whence=" width="140" height="75"/>
                <p style="font-size: 9pt; margin: 0; color: #666;">Solicitud de consumo interno</p>
            </td>
            <td style="width: 50%; text-align: right; vertical-align: top;">
                <p class="title" style="margin: 0;">Solicitud de consumo interno</p>
                <p class="subtitle" style="margin: 0;">No. ${escapeXml(datos.name)}</p>
            </td>
        </tr>
    </table>
    <hr style="border: 2px solid #2c5f8d; margin: 20px 0;"/>
    <p class="section-title">Información General</p>
    <table class="info-table">
        <tr>
            <td style="width: 15%;"><span class="label">Estatus:</span></td>
            <td style="width: 35%;">${escapeXml(datos.estatus)}</td>
            <td style="width: 15%;"><span class="label">Fecha:</span></td>
            <td style="width: 35%;">${escapeXml(datos.fecha)}</td>
        </tr>
        <tr>
            <td><span class="label">Subsidiaria:</span></td>
            <td>${escapeXml(datos.subsidiaria)}</td>
            <td><span class="label">Ubicación:</span></td>
            <td>${escapeXml(datos.ubicacion)}</td>
        </tr>
        <tr>
            <td><span class="label">Solicitante:</span></td>
            <td>${escapeXml(datos.solicitante)}</td>
            <td><span class="label">Aprobado por:</span></td>
            <td>${escapeXml(datos.jefeTienda)}</td>
        </tr>
        <tr>
            <td><span class="label">Aplicado por:</span></td>
            <td>${escapeXml(datos.gerente)}</td>
            <td><span class="label">Ajuste:</span></td>
            <td>${escapeXml(datos.adjustmentCreado)}</td>
        </tr>`;
        if (datos.motivoCancelacion) {
            html += `<tr>
            <td colspan="4" style="background-color: #f8d7da; color: #721c24;">
                <span class="label">Motivo de Cancelación:</span><br/>
                ${escapeXml(datos.motivoCancelacion)}
            </td>
        </tr>`;
        }
        html += `</table>
    <p class="section-title">Artículos Solicitados</p>`;
        if (lineas.length > 0) {
            html += `<table class="items-table">
        <thead>
            <tr>
                <th style="width: 5%; text-align: center;">#</th>
                <th style="width: 12%;">Código</th>
                <th style="width: 12%;">Artículo</th>
                <th style="width: 8%; text-align: center;">Cantidad</th>
                <th style="width: 15%;">Uso</th>
                <th style="width: 15%;">Obs. 1</th>
                <th style="width: 15%;">Obs. 2</th>
                <th style="width: 15%;">Obs. 3</th>
            </tr>
        </thead>
        <tbody>`;
            lineas.forEach(function(linea, index) {
                html += `<tr>
                <td style="text-align: center; font-size: 9pt;">${index + 1}</td>
                <td style="font-size: 9pt;">${escapeXml(linea.codigo)}</td>
                <td style="font-size: 9pt;">${escapeXml(linea.articulo)}</td>
                <td style="text-align: center; font-size: 9pt;"><b>${escapeXml(linea.cantidad)}</b></td>
                <td style="font-size: 8pt;">${escapeXml(linea.uso)}</td>
                <td style="font-size: 8pt;">${escapeXml(linea.obs1)}</td>
                <td style="font-size: 8pt;">${escapeXml(linea.obs2)}</td>
                <td style="font-size: 8pt;">${escapeXml(linea.obs3)}</td>
            </tr>`;
            });
            html += `</tbody>
    </table>
    <table style="width: 100%; float: right; margin-top: 10px;">
        <tr style="background-color: #f5f5f5;">
            <td style="text-align: right; padding: 10px;">
                <span class="label">Total de Artículos:</span>
            </td>
            <td style="text-align: center; padding: 10px; font-size: 11pt;">
                <b>${lineas.length}</b>
            </td>
        </tr>
    </table>`;
        } else {
            html += `<p style="text-align: center; padding: 20px; color: #999; font-style: italic;">
        No hay artículos registrados
    </p>`;
        }
        html += `<br style="clear: both;"/>
    <table class="firma-section">
        <tr>
            <td style="width: 33%;">
                <div class="firma-box">
                    <span class="label">Solicitante</span><br/>
                    ${escapeXml(datos.solicitante)}
                </div>
            </td>
            <td style="width: 33%;">
                <div class="firma-box">
                    <span class="label">Aprobado por</span><br/>
                    ${escapeXml(datos.jefeTienda)}
                </div>
            </td>
            <td style="width: 33%;">
                <div class="firma-box">
                    <span class="label">Aplicado por</span><br/>
                    ${escapeXml(datos.gerente)}
                </div>
            </td>
        </tr>
    </table>
    <table class="footer">
        <tr>
            <td style="width: 50%;">
                Generado: ${fechaGeneracion}
            </td>
            <td style="width: 50%; text-align: right;">
                ID Interno: ${datos.id}
            </td>
        </tr>
    </table>
</body>
</pdf>`;
        
        return html;
    }
    
    /**
     * Caracteres especiales basados en XML
     */
    function escapeXml(text) {
        if (!text) return '';
        
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    
    return {
        onRequest: onRequest
    };
});