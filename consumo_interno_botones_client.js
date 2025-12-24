/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * 
 */
define(['N/currentRecord', 'N/ui/dialog', 'N/url', 'N/https'],
    function(currentRecord, dialog, url, https) {

    function pageInit(context) {
        console.log('Client Script cargado correctamente.');
    }
    
    /**
     * Función para aprobar la solicitud
     */
    function aprobarSolicitud() {
        try {
            const record = currentRecord.get();
            const recordId = record.id;
            
            dialog.confirm({
                title: 'Confirmar Aprobación',
                message: '¿Está seguro que desea APROBAR esta solicitud de material de consumo interno?'
            }).then(function(confirmed) {
                if (confirmed) {
                    dialog.alert({
                        title: 'Procesando',
                        message: 'Aprobando solicitud, por favor espere...'
                    });
                    
                    const suiteletUrl = url.resolveScript({
                        scriptId: 'customscript_aprobar_consumo_sl',
                        deploymentId: 'customdeploy_aprobar_consumo_sl',
                        returnExternalUrl: false
                    });
                    
                    const response = https.post({
                        url: suiteletUrl,
                        body: JSON.stringify({
                            action: 'aprobar',
                            recordId: recordId
                        })
                    });
                    
                    const result = JSON.parse(response.body);
                    
                    if (result.success) {
                        dialog.alert({
                            title: 'Éxito',
                            message: 'La solicitud ha sido aprobada correctamente.'
                        }).then(function() {
                            window.location.reload();
                        });
                    } else {
                        dialog.alert({
                            title: 'Error',
                            message: 'Error al aprobar: ' + result.error
                        });
                    }
                }
            }).catch(function(error) {
                console.error('Error en confirmación:', error);
            });
            
        } catch (e) {
            console.error('Error en aprobarSolicitud:', e);
            dialog.alert({
                title: 'Error',
                message: 'Error al procesar la aprobación: ' + e.message
            });
        }
    };
    
    /**
     * Función para cancelar la solicitud
     */
    function cancelarSolicitud() {
        try {
            const record = currentRecord.get();
            const recordId = record.id;
            
            dialog.create({
                title: 'Cancelar Solicitud',
                message: 'Ingrese el motivo de la cancelación:',
                buttons: [
                    {label: 'Cancelar Solicitud', value: true},
                    {label: 'Cerrar', value: false}
                ]
            }).then(function(result) {
                if (result) {
                    const motivo = prompt('Ingrese el motivo de cancelación:');
                    
                    if (motivo && motivo.trim() !== '') {
                        const suiteletUrl = url.resolveScript({
                            scriptId: 'customscript_aprobar_consumo_sl',
                            deploymentId: 'customdeploy_aprobar_consumo_sl',
                            returnExternalUrl: false
                        });
                        
                        const response = https.post({
                            url: suiteletUrl,
                            body: JSON.stringify({
                                action: 'cancelar',
                                recordId: recordId,
                                motivo: motivo
                            })
                        });
                        
                        const result = JSON.parse(response.body);
                        
                        if (result.success) {
                            dialog.alert({
                                title: 'Cancelado',
                                message: 'La solicitud ha sido cancelada.'
                            }).then(function() {
                                window.location.reload();
                            });
                        } else {
                            dialog.alert({
                                title: 'Error',
                                message: 'Error al cancelar: ' + result.error
                            });
                        }
                    } else {
                        dialog.alert({
                            title: 'Motivo Requerido',
                            message: 'Debe ingresar un motivo para cancelar la solicitud.'
                        });
                    }
                }
            });
            
        } catch (e) {
            console.error('Error en cancelarSolicitud:', e);
            dialog.alert({
                title: 'Error',
                message: 'Error al cancelar: ' + e.message
            });
        }
    };

    /**
     * Función para Ajustar inventario después de aprobar
     */
    function ajustarInventario() {
        try {
            const record = currentRecord.get();
            const recordId = record.id;

            dialog.confirm({
                title: 'Ajustar Inventario',
                message: 'Se creará un ajuste de inventario con los artículos de esta   solicitud. ¿Desea continuar?'
            }).then(function (confirmado) {
                if (!confirmado) return;

                const suiteletUrl = url.resolveScript({
                    scriptId: 'customscript_crear_inv_adjustment',
                    deploymentId: 'customdeploy_crear_inv_adjustment',
                    returnExternalUrl: false,
                    params: {
                        consumoid: recordId
                    }
                });

                window.location.href = suiteletUrl;
            });

        } catch (e) {
            console.error('Error en ajustarInventario:', e);
            dialog.alert({
                title: 'Error',
                message: 'No fue posible iniciar el ajuste de inventario.'
            });
        }
    }
    function imprimirPDF(url) {
    try {
        window.open(url, '_blank');
    } catch (e) {
        console.error('Error al abrir PDF', e);
        alert('No se pudo abrir el PDF');
    }
}
    
    return {
        pageInit: pageInit,
        aprobarSolicitud: aprobarSolicitud,
        cancelarSolicitud: cancelarSolicitud,
        ajustarInventario: ajustarInventario,
        imprimirPDF: imprimirPDF
    };
});
