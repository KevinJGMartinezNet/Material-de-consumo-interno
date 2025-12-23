/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define([
    'N/record',
    'N/search',
    'N/runtime',
    'N/ui/serverWidget',
    'N/redirect'
], function (record, search, runtime, serverWidget, redirect) {

    const STATUS = {
        APROBADO_JEFE: 2,           // Aprobado por jefe
        PENDIENTE_AJUSTE: 3,        // Pendiente de ajuste (Ya no se va a necesitar{por ahora})
        PROCESADO: 4,               // Procesado (Ya no se va a necesitar{por ahora})
        GENERANDO: 6,               // Generando cuando esta en mood edición
        COMPLETADO: 7               // Completado cuando ya termina de editar
    };

    function onRequest(context) {
        try {
            if (context.request.method !== 'GET') {
                context.response.write('Método no permitido');
                return;
            }

            const consumoId = context.request.parameters.consumoid;
            
            if (!consumoId) {
                throw new Error('No se recibió el ID del consumo interno');
            }

            log.audit('Iniciando ajuste', `Consumo ID: ${consumoId}`);

            const consumoRec = record.load({
                type: 'customrecord_material_consumo_interno',
                id: consumoId
            });

            const estatus = consumoRec.getValue('custrecord_estatus_consumo_interno');
            if (estatus != STATUS.APROBADO_JEFE && estatus != STATUS.PENDIENTE_AJUSTE && estatus != STATUS.GENERANDO) {
                throw new Error('La solicitud debe estar aprobada para crear el ajuste');
            }

            const yaCreado = consumoRec.getValue('custrecord_adjustment_creado');
            if (yaCreado === true || yaCreado === 'T') {
                throw new Error('Ya se ha creado un ajuste para esta solicitud');
            }

            const subsidiaria = consumoRec.getValue('custrecord_subsidiaria_mci');
            const ubicacion = consumoRec.getValue('custrecord_ubicacion');
            const nombreConsumo = consumoRec.getValue('name');

            if (!subsidiaria) {
                throw new Error('El registro de consumo no tiene subsidiaria asignada');
            }

            if (!ubicacion) {
                throw new Error('El registro de consumo no tiene ubicación asignada');
            }

            log.debug('Datos del consumo', {
                subsidiaria: subsidiaria,
                ubicacion: ubicacion,
                nombre: nombreConsumo
            });

            const invAdj = record.create({
                type: record.Type.INVENTORY_ADJUSTMENT,
                isDynamic: true
            });

            invAdj.setValue({
                fieldId: 'subsidiary',
                value: subsidiaria
            });

            invAdj.setValue({
                fieldId: 'account',
                value: 1604 // Cuenta de ajuste 583-00-001 PERDIDAS Y GANANCIAS : PERDIDAS Y GANANCIAS
            });

            invAdj.setValue({
                fieldId: 'memo',
                value: `Ajuste desde Material Consumo: ${nombreConsumo} (ID: ${consumoId})`
            });

            try {
                invAdj.setText({
                    fieldId: 'custbody_creado_consumo',
                    text: nombreConsumo
                });
                
                log.debug('Campo personalizado seteado', 'Usando setText');
            } catch (textError) {
                try {
                    invAdj.setValue({
                        fieldId: 'custbody_creado_consumo',
                        value: parseInt(consumoId)
                    });
                    
                    log.debug('Campo personalizado seteado', 'Usando setValue con ID');
                } catch (valueError) {
                    log.error('No se pudo setear campo personalizado', {
                        textError: textError.message,
                        valueError: valueError.message
                    });
                }
            }

            const lineSearch = search.create({
                type: 'customrecord_consumo_linea',
                filters: [
                    ['custrecord_linea_parent', 'anyof', consumoId],
                    'AND',
                    ['custrecord_linea_cantidad', 'greaterthan', '0']
                ],
                columns: [
                    'custrecord_linea_articulo',
                    'custrecord_linea_cantidad',
                    'custrecord_linea_uso'
                ]
            });

            let lineCount = 0;

            lineSearch.run().each(function (res) {
                const item = res.getValue('custrecord_linea_articulo');
                const qty = parseFloat(res.getValue('custrecord_linea_cantidad')) || 0;
                const uso = res.getValue('custrecord_linea_uso') || '';

                if (!item || qty === 0) {
                    log.debug('Línea omitida', 'Item o cantidad inválidos');
                    return true;
                }

                try {
                    invAdj.selectNewLine({ sublistId: 'inventory' });
                    
                    invAdj.setCurrentSublistValue({
                        sublistId: 'inventory',
                        fieldId: 'item',
                        value: item
                    });

                    invAdj.setCurrentSublistValue({
                        sublistId: 'inventory',
                        fieldId: 'location',
                        value: ubicacion
                    });

                    invAdj.setCurrentSublistValue({
                        sublistId: 'inventory',
                        fieldId: 'adjustqtyby',
                        value: -Math.abs(qty) 
                    });

                    if (uso) {
                        invAdj.setCurrentSublistValue({
                            sublistId: 'inventory',
                            fieldId: 'memo',
                            value: `Uso: ${uso}`
                        });
                    }

                    invAdj.commitLine({ sublistId: 'inventory' });
                    
                    lineCount++;
                    
                    log.debug('Línea agregada', {
                        item: item,
                        cantidad: -qty,
                        ubicacion: ubicacion
                    });

                } catch (lineError) {
                    log.error('Error al agregar línea', {
                        item: item,
                        error: lineError.message
                    });
                }

                return true;
            });

            if (lineCount === 0) {
                throw new Error('No se encontraron líneas válidas para el ajuste');
            }

            const invAdjId = invAdj.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            log.audit('Ajuste creado', `Inventory Adjustment ID: ${invAdjId}, Líneas: ${lineCount}`);

            try {
                record.submitFields({
                    type: 'customrecord_material_consumo_interno',
                    id: consumoId,
                    values: {
                        custrecord_adjustment_creado: true,
                        custrecord_estatus_consumo_interno: STATUS.GENERANDO, 
                        custrecord_ajuste_inventario: invAdjId 
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });

                log.audit('Consumo actualizado', 'Estado: Generando (6)');
            } catch (updateError) {
                log.error('Error al actualizar consumo', updateError);
            }

            redirect.toRecord({
                type: record.Type.INVENTORY_ADJUSTMENT,
                id: invAdjId,
                isEditMode: true 
            });

        } catch (e) {
            log.error('Error en Suitelet Ajuste', {
                message: e.message,
                stack: e.stack,
                toString: e.toString()
            });
            
            const form = serverWidget.createForm({
                title: 'Error al Crear Ajuste'
            });

            form.addPageInitMessage({
                type: serverWidget.Message.Type.ERROR,
                title: 'Error',
                message: 'No se pudo crear el ajuste de inventario: ' + e.message
            });

            form.addButton({
                id: 'custpage_volver',
                label: 'Volver',
                functionName: 'window.history.back()'
            });

            context.response.writePage(form);
        }
    }

    return { onRequest: onRequest };
});