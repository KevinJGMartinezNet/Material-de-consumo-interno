/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * 
 * User Event para Inventory Adjustment
 * Detecta cuando se guarda un ajuste creado desde Material Consumo
 */
define(['N/record', 'N/search', 'N/runtime', 'N/email'],
    function(record, search, runtime, emailModule) {
    
    const STATUS = {
        GENERANDO: 6,      // Cuando se crea el ajuste pero no se guarda
        COMPLETADO: 7,     // Cuando se guarda el ajuste
        PROCESADO: 4       // Estado antiguo (por si acaso)
    };
    
    /**
     * Después de guardar el Inventory Adjustment
     */
    function afterSubmit(context) {
        try {
            const newRecord = context.newRecord;
            const type = context.type;
            
            if (type !== context.UserEventType.CREATE && type !== context.UserEventType.EDIT) {
                return;
            }
            
            log.debug('afterSubmit Inventory Adjustment', `Type: ${type}, ID: ${newRecord.id}`);
            
            const consumoRef = newRecord.getValue({
                fieldId: 'custbody_creado_consumo'
            });
            
            if (!consumoRef) {
                log.debug('Sin referencia', 'Este ajuste no está vinculado a un Material Consumo');
                return;
            }
            
            log.audit('Ajuste vinculado detectado', `Consumo ID: ${consumoRef}`);
            
            const consumoRecord = record.load({
                type: 'customrecord_material_consumo_interno',
                id: consumoRef
            });
            
            const estatusActual = consumoRecord.getValue({
                fieldId: 'custrecord_estatus_consumo_interno'
            });
            
            log.debug('Estado actual del consumo', `Estado: ${estatusActual}`);
            
            if (estatusActual == STATUS.COMPLETADO) {
                log.debug('Ya completado', 'El consumo ya está en estado Completado');
                return;
            }
            
            if (estatusActual == STATUS.GENERANDO) {
                record.submitFields({
                    type: 'customrecord_material_consumo_interno',
                    id: consumoRef,
                    values: {
                        custrecord_estatus_consumo_interno: STATUS.COMPLETADO,
                        custrecord_gerente: runtime.getCurrentUser().id 
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
                
                log.audit('Consumo actualizado', `ID: ${consumoRef} marcado como Completado (7)`);
                
                enviarCorreoSolicitante(consumoRef, newRecord.id);
            }
            
        } catch (e) {
            log.error('Error en afterSubmit Inventory Adjustment', {
                message: e.message,
                stack: e.stack
            });
        }
    }
    
    /**
     * Envía correo al solicitante notificando que su solicitud fue procesada
     */
    function enviarCorreoSolicitante(consumoId, adjustmentId) {
        try {
            const consumoRecord = record.load({
                type: 'customrecord_material_consumo_interno',
                id: consumoId
            });
            
            const solicitante = consumoRecord.getValue({
                fieldId: 'custrecord_solicitante'
            });
            
            if (!solicitante) {
                log.error('Sin solicitante', 'No se encontró solicitante para enviar correo');
                return;
            }
            
            const nombreConsumo = consumoRecord.getValue({
                fieldId: 'name'
            });
            
            const emailSolicitante = obtenerEmailEmpleado(solicitante);
            
            if (!emailSolicitante) {
                log.error('Sin email', `El solicitante ${solicitante} no tiene email configurado`);
                return;
            }
            
            const cuerpo = generarCorreoProcesado(nombreConsumo, consumoId, adjustmentId);
            
            emailModule.send({
                author: runtime.getCurrentUser().id,
                recipients: emailSolicitante,
                subject: 'Material de Consumo Interno - Procesado Exitosamente',
                body: cuerpo
            });
            
            log.audit('Correo enviado', `Solicitante: ${solicitante} (${emailSolicitante})`);
            
        } catch (e) {
            log.error('Error al enviar correo', e);
        }
    }
    
    /**
     * Genera el cuerpo del correo de procesado
     */
    function generarCorreoProcesado(nombreConsumo, consumoId, adjustmentId) {
        let cuerpo = '<html><body style="font-family: Arial, sans-serif;">';
        cuerpo += '<div style="max-width: 800px; margin: 0 auto;">';
        
        cuerpo += '<h2 style="color: #5cb85c; border-bottom: 2px solid #5cb85c; padding-bottom: 10px;">✅ Material de Consumo Interno Procesado</h2>';
        
        cuerpo += '<div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">';
        cuerpo += '<p style="font-size: 16px; color: #155724; margin: 0;">Su solicitud de material de consumo interno ha sido <strong>procesada exitosamente</strong>.</p>';
        cuerpo += '</div>';
        
        cuerpo += '<div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">';
        cuerpo += '<h3 style="margin-top: 0; color: #2c5f8d;">Información</h3>';
        cuerpo += `<p><strong>Solicitud:</strong> ${nombreConsumo}</p>`;
        cuerpo += `<p><strong>Ajuste de Inventario ID:</strong> ${adjustmentId}</p>`;
        cuerpo += '</div>';
        
        const consumoUrl = `https://5017898-sb2.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=1115&id=${consumoId}`;
        const adjustmentUrl = `https://5017898-sb2.app.netsuite.com/app/accounting/transactions/invadjst.nl?id=${adjustmentId}`;
        
        cuerpo += '<div style="margin: 30px 0; text-align: center;">';
        cuerpo += `<a href="${consumoUrl}" style="background-color: #2c5f8d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin: 5px;">Ver Solicitud</a>`;
        cuerpo += `<a href="${adjustmentUrl}" style="background-color: #5cb85c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin: 5px;">Ver Ajuste</a>`;
        cuerpo += '</div>';
        
        cuerpo += '<hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">';
        cuerpo += '<p style="font-size: 12px; color: #666;">El ajuste de inventario ha sido aplicado y los artículos han sido descontados del inventario.</p>';
        cuerpo += '<p style="font-size: 12px; color: #666;">Este es un correo automático generado por NetSuite.</p>';
        
        cuerpo += '</div></body></html>';
        
        return cuerpo;
    }
    
    /**
     * Obtiene el email de un empleado
     */
    function obtenerEmailEmpleado(empleadoId) {
        try {
            const employeeLookup = search.lookupFields({
                type: search.Type.EMPLOYEE,
                id: empleadoId,
                columns: ['email']
            });
            
            if (employeeLookup.email) {
                return employeeLookup.email;
            }
            
            return null;
            
        } catch (e) {
            log.error('Error al obtener email', e);
            return null;
        }
    }
    
    return {
        afterSubmit: afterSubmit
    };
});