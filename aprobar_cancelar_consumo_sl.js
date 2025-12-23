/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/runtime'],
    function(record, runtime) {
    
    const STATUS = {
        PENDIENTE: 1,           // Pendiente por aprobar
        APROBADO_JEFE: 2,       // Aprobado por jefe
        PENDIENTE_AJUSTE: 3,    // Pendiente de ajuste (Ya no se va a necesitar{por ahora})
        PROCESADO: 4,           // Procesado (Ya no se va a necesitar{por ahora})
        CANCELADO: 5,           // Cancelado
        GENERANDO: 6,           // Generando cuando esta en mood edición
        COMPLETADO: 7           // Completado cuando ya termina de editar
    };
    
    /**
     * Punto de entrada del Suitelet
     */
    function onRequest(context) {
        try {
            const request = context.request;
            const response = context.response;
            
            if (request.method === 'POST') {
                const body = JSON.parse(request.body);
                const action = body.action;
                const recordId = body.recordId;
                
                let result = {};
                
                if (action === 'aprobar') {
                    result = aprobarSolicitud(recordId);
                } else if (action === 'cancelar') {
                    result = cancelarSolicitud(recordId, body.motivo);
                }
                
                response.write(JSON.stringify(result));
            }
            
        } catch (e) {
            log.error('Error en Suitelet', e);
            context.response.write(JSON.stringify({
                success: false,
                error: e.message
            }));
        }
    }
    
    /**
     * Aprueba la solicitud
     */
    function aprobarSolicitud(recordId) {
        try {
            const currentUser = runtime.getCurrentUser();
            
            log.audit('Aprobando solicitud', `Record ID: ${recordId}, Usuario: ${currentUser.id}`);
            
            const consumoRecord = record.load({
                type: 'customrecord_material_consumo_interno',
                id: recordId
            });
            
            const estatusActual = consumoRecord.getValue({
                fieldId: 'custrecord_estatus_consumo_interno'
            });
            
            if (estatusActual != STATUS.PENDIENTE) {
                return {
                    success: false,
                    error: 'La solicitud no está en estado Pendiente'
                };
            }
            
            consumoRecord.setValue({
                fieldId: 'custrecord_estatus_consumo_interno',
                value: STATUS.APROBADO_JEFE
            });
            
            consumoRecord.setValue({
                fieldId: 'custrecord_jefe_tienda',
                value: currentUser.id
            });
            
            const savedId = consumoRecord.save();
            
            log.audit('Solicitud aprobada', `ID: ${savedId}, Aprobado por: ${currentUser.id}`);
            
            return {
                success: true,
                message: 'Solicitud aprobada correctamente'
            };
            
        } catch (e) {
            log.error('Error al aprobar', e);
            return {
                success: false,
                error: e.message
            };
        }
    }
    
    /**
     * Cancela la solicitud
     */
    function cancelarSolicitud(recordId, motivo) {
        try {
            const currentUser = runtime.getCurrentUser();
            
            log.audit('Cancelando solicitud', `Record ID: ${recordId}, Usuario: ${currentUser.id}`);
            
            if (!motivo || motivo.trim() === '') {
                return {
                    success: false,
                    error: 'Debe proporcionar un motivo de cancelación'
                };
            }
            
            const consumoRecord = record.load({
                type: 'customrecord_material_consumo_interno',
                id: recordId
            });
            
            consumoRecord.setValue({
                fieldId: 'custrecord_estatus_consumo_interno',
                value: STATUS.CANCELADO
            });
            
            consumoRecord.setValue({
                fieldId: 'custrecord_motivo_cancelacion',
                value: 'Cancelado por: ' + currentUser.name + '\n Mensaje: ' + motivo
            });
            
            const savedId = consumoRecord.save();
            
            log.audit('Solicitud cancelada', `ID: ${savedId}, Cancelado por: ${currentUser.id}`);
            
            return {
                success: true,
                message: 'Solicitud cancelada correctamente'
            };
            
        } catch (e) {
            log.error('Error al cancelar', e);
            return {
                success: false,
                error: e.message
            };
        }
    }
    
    return {
        onRequest: onRequest
    };
});