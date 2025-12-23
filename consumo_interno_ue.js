/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/email', 'N/runtime', 'N/search', 'N/ui/serverWidget', 'N/url'],
    function(record, emailModule, runtime, search, serverWidget, url) {
    
    // CONSTANTES DE ESTATUS
    const STATUS = {
        PENDIENTE: 1,           // Pendiente por aprobar
        APROBADO_JEFE: 2,       // Aprobado por jefe
        PENDIENTE_AJUSTE: 3,    // Pendiente de ajuste (Ya no se va a necesitar{por ahora})
        PROCESADO: 4,           // Procesado (Ya no se va a necesitar{por ahora})
        CANCELADO: 5,           // Cancelado 
        GENERANDO: 6,           // Generando cuando esta en mood edición
        COMPLETADO: 7           // Completado cuando ya termina de editar
    };
    
    // ROLES CON PERMISOS
    const ROLES = {
        ADMINISTRADOR: 3,
        JEFE_TIENDA: 1020,
        GERENTE_CONTRALORIA: 1223
    };
    
    // USUARIOS PARA NOTIFICACIONES
    const USUARIOS_GERENCIA = [66544, 3673];
    
    /**
     * Antes de cargar el registro
     */
    function beforeLoad(context) {
        try {
            const newRecord = context.newRecord;
            const type = context.type;
            const form = context.form;
            const currentUser = runtime.getCurrentUser();

            form.clientScriptModulePath = './consumo_interno_botones_client.js';
            
            if (type === context.UserEventType.CREATE) {
                newRecord.setValue({
                    fieldId: 'custrecord_estatus_consumo_interno',
                    value: STATUS.PENDIENTE
                });
                
                log.debug('beforeLoad', 'Estatus inicial seteado a: Pendiente por aprobar');
            }
            
            if (type === context.UserEventType.VIEW || type === context.UserEventType.EDIT) {
                const estatus = newRecord.getValue({
                    fieldId: 'custrecord_estatus_consumo_interno'
                });
                
                const rolUsuario = currentUser.role;
                
                const puedeAprobar = (
                    rolUsuario == ROLES.JEFE_TIENDA ||
                    rolUsuario == ROLES.ADMINISTRADOR ||
                    rolUsuario == ROLES.GERENTE_CONTRALORIA
                );
                
                const puedeAjustar = (
                    rolUsuario == ROLES.ADMINISTRADOR ||
                    rolUsuario == ROLES.GERENTE_CONTRALORIA
                );
                
                if (estatus == STATUS.PENDIENTE && puedeAprobar) {
                    form.addButton({
                        id: 'custpage_btn_aprobar',
                        label: 'Aprobar',
                        functionName: 'aprobarSolicitud()'
                    });
                }
                
                if ((estatus == STATUS.PENDIENTE || estatus == STATUS.APROBADO_JEFE) && puedeAprobar) {
                    form.addButton({
                        id: 'custpage_btn_cancelar',
                        label: 'Cancelar',
                        functionName: 'cancelarSolicitud()'
                    });
                }
                
                if ((estatus == STATUS.APROBADO_JEFE || estatus == STATUS.PENDIENTE_AJUSTE) && puedeAjustar) {
                     form.addButton({
                        id: 'custpage_btn_ajustar',
                        label: 'Ajustar Inventario',
                        functionName: 'ajustarInventario()'
                    });
                }
                
            }
            
        } catch (e) {
            log.error('Error en beforeLoad', e);
        }
    }
    
    /**
     * Antes de guardar el registro
     */
    function beforeSubmit(context) {
        try {
            const newRecord = context.newRecord;
            const type = context.type;
            
            if (type === context.UserEventType.CREATE) {
                const currentUser = runtime.getCurrentUser();
                
                const fechaSolicitud = newRecord.getValue({
                    fieldId: 'custrecord_fecha_solicitud'
                });
                
                if (!fechaSolicitud) {
                    newRecord.setValue({
                        fieldId: 'custrecord_fecha_solicitud',
                        value: new Date()
                    });
                }
                
                const solicitante = newRecord.getValue({
                    fieldId: 'custrecord_solicitante'
                });
                
                if (!solicitante) {
                    let empleadoId = currentUser.id;
                    
                    try {
                        const empCheck = search.lookupFields({
                            type: search.Type.EMPLOYEE,
                            id: currentUser.id,
                            columns: ['isinactive']
                        });
                        
                        if (empCheck.isinactive === true) {
                            empleadoId = null;
                        }
                    } catch (checkError) {
                        empleadoId = obtenerEmpleadoDeUsuario(currentUser.id);
                    }
                    
                    if (empleadoId) {
                        newRecord.setValue({
                            fieldId: 'custrecord_solicitante',
                            value: empleadoId
                        });
                        
                        log.audit('Solicitante asignado', `Empleado ID: ${empleadoId}`);
                    }
                }
                
                const estatus = newRecord.getValue({
                    fieldId: 'custrecord_estatus_consumo_interno'
                });
                
                if (!estatus) {
                    newRecord.setValue({
                        fieldId: 'custrecord_estatus_consumo_interno',
                        value: STATUS.PENDIENTE
                    });
                }
                
                log.audit('beforeSubmit - CREATE', 'Valores por defecto seteados');
            }
            
        } catch (e) {
            log.error('Error en beforeSubmit', e);
        }
    }
    
    /**
     * Obtiene el empleado asociado a un usuario
     */
    function obtenerEmpleadoDeUsuario(usuarioId) {
        try {
            log.debug('Buscando empleado', `Usuario ID: ${usuarioId}`);
            
            try {
                const employeeLookup = search.lookupFields({
                    type: search.Type.EMPLOYEE,
                    id: usuarioId,
                    columns: ['internalid', 'entityid', 'isinactive']
                });
                
                if (employeeLookup && employeeLookup.isinactive === false) {
                    log.debug('Empleado encontrado directamente', `ID: ${usuarioId}`);
                    return usuarioId;
                }
            } catch (lookupError) {
                log.debug('No es empleado directo', 'Buscando por otros métodos');
            }
            
            const employeeSearch = search.create({
                type: search.Type.EMPLOYEE,
                filters: [
                    ['isinactive', 'is', 'F'],
                    'AND',
                    ['giveaccess', 'is', 'T']
                ],
                columns: ['internalid', 'entityid', 'email']
            });
            
            let empleadoId = null;
            
            employeeSearch.run().each(function(result) {
                if (result.id == usuarioId) {
                    empleadoId = result.id;
                    log.debug('Empleado encontrado por búsqueda', `ID: ${empleadoId}`);
                    return false;
                }
                return true;
            });
            
            if (!empleadoId) {
                log.error('Empleado no encontrado', `No se encontró empleado para usuario: ${usuarioId}`);
            }
            
            return empleadoId;
            
        } catch (e) {
            log.error('Error al obtener empleado', {
                usuarioId: usuarioId,
                error: e.message,
                stack: e.stack
            });
            return null;
        }
    }
    
    /**
     * Obtiene el supervisor de un empleado
     */
    function obtenerSupervisorDeEmpleado(empleadoId) {
        try {
            const employeeLookup = search.lookupFields({
                type: search.Type.EMPLOYEE,
                id: empleadoId,
                columns: ['supervisor']
            });
            
            if (employeeLookup.supervisor && employeeLookup.supervisor.length > 0) {
                return employeeLookup.supervisor[0].value;
            }
            
            return null;
            
        } catch (e) {
            log.error('Error al obtener supervisor', e);
            return null;
        }
    }
    
    /**
     * Después de guardar el registro
     */
    function afterSubmit(context) {
        try {
            const newRecord = context.newRecord;
            const oldRecord = context.oldRecord;
            const type = context.type;
            const recordId = newRecord.id;
            
            const nuevoEstatus = newRecord.getValue({
                fieldId: 'custrecord_estatus_consumo_interno'
            });
            
            const estatusAnterior = oldRecord ? oldRecord.getValue({
                fieldId: 'custrecord_estatus_consumo_interno'
            }) : null;
            
            log.debug('afterSubmit', `Tipo: ${type}, Estatus Anterior: ${estatusAnterior}, Nuevo Estatus: ${nuevoEstatus}`);
            
            try {
                const statusText = newRecord.getText({
                    fieldId: 'custrecord_estatus_consumo_interno'
                });

                if (statusText) {
                    const baseName = newRecord.getValue({ fieldId: 'name' }).split(' - ')[0]; 
                    const nuevoName = baseName + ' - ' + statusText;

                    record.submitFields({
                        type: newRecord.type,
                        id: recordId,
                        values: { name: nuevoName },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });
                }
            } catch (nameError) {
                log.error('Error al actualizar nombre', nameError);
            }
            
            if (type === context.UserEventType.CREATE && nuevoEstatus == STATUS.PENDIENTE) {
                enviarCorreoSegunEstatus(recordId, nuevoEstatus);
            }
            
            if (type === context.UserEventType.EDIT && nuevoEstatus != estatusAnterior) {
                enviarCorreoSegunEstatus(recordId, nuevoEstatus);
            }
            
        } catch (e) {
            log.error('Error en afterSubmit', e);
        }
    }
    
    /**
     * Envía correo según el estatus
     */
    function enviarCorreoSegunEstatus(recordId, estatus) {
        try {
            log.debug('enviarCorreoSegunEstatus', `Record ID: ${recordId}, Estatus: ${estatus}`);
            
            const consumoRecord = record.load({
                type: 'customrecord_material_consumo_interno',
                id: recordId
            });
            
            const solicitante = consumoRecord.getValue({
                fieldId: 'custrecord_solicitante'
            });
            
            const ubicacion = consumoRecord.getText({
                fieldId: 'custrecord_ubicacion'
            });
            
            const subsidiaria = consumoRecord.getText({
                fieldId: 'custrecord_subsidiaria_mci'
            });
            
            const lineas = obtenerLineasArticulos(recordId);
            
            if (estatus == STATUS.PENDIENTE) {
                if (solicitante) {
                    const supervisorId = obtenerSupervisorDeEmpleado(solicitante);
                    
                    if (supervisorId) {
                        const cuerpo = generarCuerpoCorreo('jefe', recordId, solicitante, ubicacion, subsidiaria, lineas);
                        enviarCorreo(supervisorId, 'Solicitud de Material de Consumo Interno - Requiere Aprobación', cuerpo);
                        log.audit('Correo enviado', `Supervisor: ${supervisorId}`);
                    } else {
                        log.error('Sin supervisor', 'El solicitante no tiene supervisor asignado');
                    }
                }
                
            } else if (estatus == STATUS.APROBADO_JEFE) {
                const cuerpo = generarCuerpoCorreo('gerente', recordId, solicitante, ubicacion, subsidiaria, lineas);
                
                USUARIOS_GERENCIA.forEach(function(userId) {
                    enviarCorreo(userId, 'Material de Consumo Interno - Aprobación Final Requerida', cuerpo);
                });
                
                log.audit('Correos enviados', `Gerencia: ${USUARIOS_GERENCIA.join(', ')}`);
                
            } else if (estatus == STATUS.PROCESADO) {
                if (solicitante) {
                    const cuerpo = generarCuerpoCorreo('procesado', recordId, solicitante, ubicacion, subsidiaria, lineas);
                    enviarCorreo(solicitante, 'Material de Consumo Interno - Procesado', cuerpo);
                    log.audit('Correo enviado', `Solicitante: ${solicitante}`);
                }
                
            } else if (estatus == STATUS.CANCELADO) {
                const destinatarios = [solicitante];
                const supervisorId = obtenerSupervisorDeEmpleado(solicitante);
                if (supervisorId) destinatarios.push(supervisorId);
                USUARIOS_GERENCIA.forEach(u => destinatarios.push(u));
                
                const motivoCancelacion = consumoRecord.getValue({
                    fieldId: 'custrecord_motivo_cancelacion'
                }) || 'No se proporcionó motivo';
                
                const usuarioCancelo = runtime.getCurrentUser();
                const cuerpo = generarCuerpoCorreo('cancelado', recordId, solicitante, ubicacion, subsidiaria, lineas, motivoCancelacion, usuarioCancelo.name);
                
                enviarCorreo(destinatarios, 'Material de Consumo Interno - CANCELADO', cuerpo);
                log.audit('Correo enviado', `Cancelación notificada`);
            }
            
        } catch (e) {
            log.error('Error al enviar correo', e);
        }
    }
    
    /**
     * Obtiene las líneas de artículos
     */
    function obtenerLineasArticulos(parentId) {
        const lineas = [];
        
        try {
            const lineaSearch = search.create({
                type: 'customrecord_consumo_linea',
                filters: [['custrecord_linea_parent', 'anyof', parentId]],
                columns: [
                    'custrecord_linea_codigo',
                    'custrecord_linea_articulo',
                    'custrecord_linea_cantidad',
                    'custrecord_linea_uso'
                ]
            });
            
            lineaSearch.run().each(function(result) {
                lineas.push({
                    codigo: result.getValue('custrecord_linea_codigo') || '',
                    articulo: result.getText('custrecord_linea_articulo') || 'N/A',
                    articuloId: result.getValue('custrecord_linea_articulo'),
                    cantidad: result.getValue('custrecord_linea_cantidad') || '0',
                    uso: result.getValue('custrecord_linea_uso') || ''
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
     * Genera el cuerpo del correo
     * Cambiar el dominio a productivo 
     */
    //Cambiar dorminio a productivo
    function generarCuerpoCorreo(tipo, recordId, solicitante, ubicacion, subsidiaria, lineas, motivoCancelacion, usuarioCancelo) {
        let cuerpo = '<html><body style="font-family: Arial, sans-serif;">';
        cuerpo += '<div style="max-width: 800px; margin: 0 auto;">';
        
        let headerColor = '#2c5f8d';
        if (tipo === 'cancelado') headerColor = '#d9534f';
        else if (tipo === 'procesado') headerColor = '#5cb85c';
        
        cuerpo += `<h2 style="color: ${headerColor}; border-bottom: 2px solid ${headerColor}; padding-bottom: 10px;">Material de Consumo Interno</h2>`;
        
        //const domain = runtime.envType === runtime.EnvType.PRODUCTION ? 'system.netsuite.com' : 'system.sandbox.netsuite.com';
        //No me salio el tipo de dominio asi que lo deje estatico =(
        const recordUrl = `https://5017898-sb2.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=1115&id=${recordId}`;
        
        if (tipo === 'jefe') {
            cuerpo += '<p style="font-size: 16px;">Se ha recibido una nueva <strong>solicitud de material de consumo interno</strong> que requiere su aprobación.</p>';
        } else if (tipo === 'gerente') {
            cuerpo += '<p style="font-size: 16px;">Se ha aprobado una solicitud de material de consumo interno. Se requiere <strong>ajustar el inventario</strong>.</p>';
        } else if (tipo === 'procesado') {
            cuerpo += '<p style="font-size: 16px; color: #5cb85c;">Su solicitud de material de consumo interno ha sido <strong>procesada</strong> exitosamente.</p>';
        } else if (tipo === 'cancelado') {
            cuerpo += '<div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin-bottom: 20px;">';
            cuerpo += '<p style="font-size: 16px; color: #721c24; margin: 0;"><strong>SOLICITUD CANCELADA</strong></p>';
            cuerpo += '</div>';
            
            if (motivoCancelacion || usuarioCancelo) {
                cuerpo += '<div style="background-color: #fff3cd; border: 1px solid #ffeeba; padding: 15px; border-radius: 5px; margin: 20px 0;">';
                cuerpo += '<h3 style="margin-top: 0; color: #856404;">Información de Cancelación</h3>';
                if (usuarioCancelo) cuerpo += `<p><strong>Cancelado por:</strong> ${usuarioCancelo}</p>`;
                if (motivoCancelacion) cuerpo += `<p><strong>Motivo:</strong> ${motivoCancelacion}</p>`;
                cuerpo += '</div>';
            }
        }
        
        cuerpo += '<div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">';
        cuerpo += '<h3 style="margin-top: 0; color: #2c5f8d;">Información de la Solicitud</h3>';
        cuerpo += `<p><strong>Solicitud #:</strong> ${recordId}</p>`;
        if (ubicacion) cuerpo += `<p><strong>Ubicación:</strong> ${ubicacion}</p>`;
        if (subsidiaria) cuerpo += `<p><strong>Subsidiaria:</strong> ${subsidiaria}</p>`;
        cuerpo += '</div>';
        
        if (lineas && lineas.length > 0) {
            cuerpo += '<h3 style="color: #2c5f8d;">Artículos Solicitados:</h3>';
            cuerpo += '<table border="1" cellpadding="2" cellspacing="0" style="border-collapse: collapse; width: 100%; margin: 20px 0;">';
            cuerpo += '<thead><tr style="background-color: #2c5f8d; color: white;">';
            cuerpo += '<th style="text-align: left;">Código</th><th style="text-align: left;">Artículo</th><th style="text-align: center;">Cantidad</th><th style="text-align: left;">Uso</th>';
            cuerpo += '</tr></thead><tbody>';
            
            lineas.forEach(function(linea, index) {
                const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
                cuerpo += `<tr style="background-color: ${bgColor};">`;
                cuerpo += `<td>${linea.codigo}</td><td>${linea.articulo}</td><td style="text-align: center;">${linea.cantidad}</td><td>${linea.uso}</td>`;
                cuerpo += '</tr>';
            });
            
            cuerpo += '</tbody></table>';
        }
        
        cuerpo += '<div style="margin: 30px 0; text-align: center;">';
        cuerpo += `<a href="${recordUrl}" style="background-color: #2c5f8d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Ver Solicitud Completa</a>`;
        cuerpo += '</div>';
        
        cuerpo += '<hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">';
        cuerpo += '<p style="font-size: 12px; color: #666;">Este es un correo automático generado por NetSuite.</p>';
        cuerpo += '</div></body></html>';
        
        return cuerpo;
    }
    
    /**
     * Envía correo
     */
    function enviarCorreo(destinatario, asunto, cuerpo) {
        try {
            const destinatarios = Array.isArray(destinatario) ? destinatario : [destinatario];
            const emails = [];
            
            destinatarios.forEach(function(empId) {
                const emailEmp = obtenerEmailEmpleado(empId);
                if (emailEmp) emails.push(emailEmp);
            });
            
            if (emails.length === 0) {
                log.error('Sin destinatarios', 'No se encontraron emails válidos');
                return;
            }
            
            emailModule.send({
                author: runtime.getCurrentUser().id,
                recipients: emails,
                subject: asunto,
                body: cuerpo
            });
            
            log.audit('Correo enviado', { destinatarios: emails.join(', '), asunto: asunto });
            
        } catch (e) {
            log.error('Error al enviar correo', e);
        }
    }
    
    /**
     * Obtiene email de empleado
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
            log.error('Error al obtener email', { empleadoId: empleadoId, error: e.message });
            return null;
        }
    }
    
    return {
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
});