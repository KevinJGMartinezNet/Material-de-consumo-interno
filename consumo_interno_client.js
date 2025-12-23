/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/ui/dialog', 'N/currentRecord'], 
    function(search, dialog, currentRecord) {
    
    // VARIABLE PARA EVITAR BUCLES INFINITOS LO APRENDÍ A LA MALA
    let isUpdating = false;
    
    /**
     * Se ejecuta cuando cambia un campo en la sublista
     */
    function fieldChanged(context) {
        try {
            if (isUpdating) {
                return;
            }
            
            const record = context.currentRecord;
            const sublistId = context.sublistId;
            const fieldId = context.fieldId;
            
            if (sublistId === 'recmachcustrecord_linea_parent') {
                
                if (fieldId === 'custrecord_linea_codigo') {
                    const codigo = record.getCurrentSublistValue({
                        sublistId: sublistId,
                        fieldId: 'custrecord_linea_codigo'
                    });
                    
                    if (codigo && codigo.trim() !== '') {
                        buscarArticuloPorCodigo(record, sublistId, codigo.trim());
                    }
                }
                
                if (fieldId === 'custrecord_linea_articulo') {
                    const articuloId = record.getCurrentSublistValue({
                        sublistId: sublistId,
                        fieldId: 'custrecord_linea_articulo'
                    });
                    
                    if (articuloId) {
                        buscarCodigoPorArticulo(record, sublistId, articuloId);
                    } else {
                        isUpdating = true;
                        record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custrecord_linea_codigo',
                            value: ''
                        });
                        isUpdating = false;
                    }
                }
            }
            
        } catch (e) {
            console.error('Error en fieldChanged:', e);
            isUpdating = false; 
        }
    }
    
    /**
     * Busca un artículo por su código/itemid
     */
    function buscarArticuloPorCodigo(record, sublistId, codigo) {
        try {
            const itemSearch = search.create({
                type: search.Type.ITEM,
                filters: [
                    ['isinactive', 'is', 'F'],
                    'AND',
                    [
                        ['itemid', 'is', codigo],
                        'OR',
                        ['upccode', 'is', codigo],
                        'OR',
                        ['displayname', 'contains', codigo]
                    ]
                ],
                columns: [
                    'internalid',
                    'itemid',
                    'displayname',
                    'type'
                ]
            });
            
            let encontrado = false;
            
            itemSearch.run().each(function(result) {
                isUpdating = true;
                
                record.setCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: 'custrecord_linea_articulo',
                    value: result.id
                });
                
                isUpdating = false;
                
                encontrado = true;
                
                console.log('Artículo encontrado:', result.getValue('displayname'));
                
                return false; 
            });
            
            if (!encontrado) {
                isUpdating = true;
                
                record.setCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: 'custrecord_linea_articulo',
                    value: ''
                });
                
                isUpdating = false;
                
                dialog.alert({
                    title: 'Artículo No Encontrado',
                    message: 'No se encontró ningún artículo con el código: ' + codigo
                });
            }
            
        } catch (e) {
            console.error('Error al buscar artículo:', e);
            isUpdating = false; 
            dialog.alert({
                title: 'Error',
                message: 'Error al buscar el artículo: ' + e.message
            });
        }
    }
    
    /**
     * Busca el código de un artículo por su ID
     */
    function buscarCodigoPorArticulo(record, sublistId, articuloId) {
        try {
            const itemLookup = search.lookupFields({
                type: search.Type.ITEM,
                id: articuloId,
                columns: ['itemid', 'upccode', 'displayname']
            });
            
            if (itemLookup && itemLookup.displayname) {
                isUpdating = true;
                
                record.setCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: 'custrecord_linea_codigo',
                    value: itemLookup.displayname
                });
                
                isUpdating = false;
                
                console.log('Código encontrado:', itemLookup.displayname);
            }
            
        } catch (e) {
            console.error('Error al buscar código:', e);
            isUpdating = false;
        }
    }
    
    /**
     * Validación antes de agregar línea
     */
    function validateLine(context) {
        try {
            const record = context.currentRecord;
            const sublistId = context.sublistId;
            
            if (sublistId === 'recmachcustrecord_linea_parent') {
                const articulo = record.getCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: 'custrecord_linea_articulo'
                });
                
                const cantidad = record.getCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: 'custrecord_linea_cantidad'
                });
                
                if (!articulo) {
                    dialog.alert({
                        title: 'Campo Requerido',
                        message: 'Debe seleccionar un artículo válido'
                    });
                    return false;
                }
                
                if (!cantidad || cantidad < 0) {
                    dialog.alert({
                        title: 'Cantidad Inválida',
                        message: 'La cantidad debe ser mayor a 0'
                    });
                    return false;
                }
            }
            
            return true;
            
        } catch (e) {
            console.error('Error en validateLine:', e);
            return true;
        }
    }
    
    /**
     * Se ejecuta al cargar la página
     */
    function pageInit(context) {
        // Solo para propósitos de depuración inicial y verifiar que el script se cargue
        console.log('Client Script - Material Consumo Interno cargado correctamente');
        console.log('Sublista ID: recmachcustrecord_linea_parent');
    }
    
    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged,
        validateLine: validateLine
    };
});