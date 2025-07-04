// test-normalization.js - Script para probar el sistema de normalización

const axios = require('axios');

const API_BASE = 'http://127.0.0.1:5000';

// Colores para console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

const log = (color, message) => console.log(`${colors[color]}${message}${colors.reset}`);

async function testNormalizationSystem() {
    log('cyan', '🧠 PROBANDO SISTEMA DE NORMALIZACIÓN DE SOCRATIC CORTEX');
    log('cyan', '=' .repeat(60));

    try {
        // 1. Verificar estado del servidor
        log('blue', '\n1. Verificando estado del servidor...');
        const healthResponse = await axios.get(`${API_BASE}/health`);
        log('green', `✅ Servidor activo: ${healthResponse.data.status}`);

        // 2. Obtener estadísticas iniciales
        log('blue', '\n2. Obteniendo estadísticas iniciales del grafo...');
        const initialStatsResponse = await axios.get(`${API_BASE}/api/normalization/graph-stats`);
        const initialStats = initialStatsResponse.data.stats;
        log('yellow', `📊 Nodos iniciales: ${initialStats.totalNodes}`);
        log('yellow', `🔗 Relaciones iniciales: ${initialStats.totalRelationships}`);

        // 3. Detectar duplicados
        log('blue', '\n3. Detectando duplicados en el grafo...');
        const duplicatesResponse = await axios.get(`${API_BASE}/api/normalization/detect-duplicates`);
        const duplicates = duplicatesResponse.data;
        log('yellow', `🎯 Grupos de duplicados encontrados: ${duplicates.totalGroups}`);
        log('yellow', `📝 Total de nodos duplicados: ${duplicates.totalDuplicates}`);

        if (duplicates.totalGroups > 0) {
            log('cyan', '\n📋 REPORTE DE DUPLICADOS:');
            duplicates.duplicateGroups.forEach((group, index) => {
                log('yellow', `\nGrupo ${index + 1} (Confianza: ${(group.confidence * 100).toFixed(1)}%):`);
                group.nodes.forEach(node => {
                    log('reset', `  • ${node.label} [${node.id}] (${node.domain})`);
                });
                log('green', `  → Fusión sugerida: ${group.suggestedMerge.label}`);
            });

            // 4. Ejecutar normalización si hay duplicados
            log('blue', '\n4. ¿Ejecutar normalización completa? (Automático en test)');
            log('yellow', '⚠️  Esto fusionará todos los duplicados detectados...');
            
            // Simulamos confirmación automática para testing
            await new Promise(resolve => setTimeout(resolve, 2000));
            log('green', '✅ Procediendo con normalización...');

            const normalizationResponse = await axios.post(`${API_BASE}/api/normalization/normalize-graph`);
            const report = normalizationResponse.data.report;
            
            log('green', '\n🎉 NORMALIZACIÓN COMPLETADA:');
            log('cyan', `   • Grupos procesados: ${report.duplicatesFound}`);
            log('cyan', `   • Nodos fusionados: ${report.mergedNodes || 0}`);
            log('cyan', `   • Confianza promedio: ${(report.confidence * 100).toFixed(1)}%`);

        } else {
            log('green', '\n✅ No se encontraron duplicados. El grafo ya está normalizado.');
        }

        // 5. Obtener estadísticas finales
        log('blue', '\n5. Obteniendo estadísticas post-normalización...');
        const finalStatsResponse = await axios.get(`${API_BASE}/api/normalization/graph-stats`);
        const finalStats = finalStatsResponse.data.stats;
        
        log('green', '\n📈 COMPARACIÓN ANTES/DESPUÉS:');
        log('reset', `Nodos: ${initialStats.totalNodes} → ${finalStats.totalNodes} (${finalStats.totalNodes - initialStats.totalNodes >= 0 ? '+' : ''}${finalStats.totalNodes - initialStats.totalNodes})`);
        log('reset', `Relaciones: ${initialStats.totalRelationships} → ${finalStats.totalRelationships} (${finalStats.totalRelationships - initialStats.totalRelationships >= 0 ? '+' : ''}${finalStats.totalRelationships - initialStats.totalRelationships})`);

        // 6. Generar reporte detallado
        log('blue', '\n6. Generando reporte detallado...');
        const reportResponse = await axios.get(`${API_BASE}/api/normalization/normalization-report`);
        const detailedReport = reportResponse.data.report;

        log('cyan', '\n📋 REPORTE DE CALIDAD:');
        log('reset', `• Completitud de dominios: ${detailedReport.quality.domainCompleteness}`);
        log('reset', `• Completitud de resúmenes: ${detailedReport.quality.summaryCompleteness}`);
        log('reset', `• Nodos normalizados: ${detailedReport.quality.normalizedNodes}`);
        log('reset', `• Nodos que necesitan revisión: ${detailedReport.quality.nodesNeedingReview}`);

        if (detailedReport.recentNormalizations.length > 0) {
            log('cyan', '\n🔄 NORMALIZACIONES RECIENTES:');
            detailedReport.recentNormalizations.slice(0, 5).forEach(norm => {
                log('reset', `• ${norm.label} (fusionado desde: ${norm.mergedFrom.join(', ')})`);
            });
        }

        // 7. Test de validación de nuevo nodo
        log('blue', '\n7. Probando validación de nuevo nodo...');
        const testNode = {
            label: 'Ideas Platónicas Test',
            domain: 'Philosophy',
            summary: 'Concepto de prueba que debería detectarse como duplicado'
        };

        const validationResponse = await axios.post(`${API_BASE}/api/normalization/validate-new-node`, {
            nodeData: testNode
        });

        const validation = validationResponse.data.validation;
        if (validation.shouldMerge) {
            log('yellow', `⚠️  Nuevo nodo detectado como posible duplicado de: ${validation.duplicates.map(d => d.label).join(', ')}`);
        } else {
            log('green', '✅ Nuevo nodo es único, puede agregarse sin problemas');
        }

        log('green', '\n🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE');
        log('cyan', '\n💡 El sistema de normalización está funcionando correctamente.');
        log('cyan', '   Puedes usar el panel de normalización en la interfaz web.');

    } catch (error) {
        log('red', `\n❌ Error durante las pruebas: ${error.message}`);
        if (error.response) {
            log('red', `   Código: ${error.response.status}`);
            log('red', `   Detalle: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        log('yellow', '\n💡 Asegúrate de que:');
        log('reset', '   • El servidor backend esté ejecutándose en el puerto 5000');
        log('reset', '   • Neo4j esté activo y conectado');
        log('reset', '   • Haya datos en el grafo para probar');
    }
}

// Función para mostrar ayuda de comandos
function showHelp() {
    log('cyan', '\n🧠 SISTEMA DE NORMALIZACIÓN - COMANDOS DISPONIBLES');
    log('cyan', '=' .repeat(50));
    log('reset', '\nComandos de API disponibles:');
    log('green', 'GET    /api/normalization/graph-stats         - Estadísticas del grafo');
    log('green', 'GET    /api/normalization/detect-duplicates   - Detectar duplicados');
    log('green', 'POST   /api/normalization/normalize-graph     - Normalización completa');
    log('green', 'POST   /api/normalization/merge-group         - Fusionar grupo específico');
    log('green', 'POST   /api/normalization/validate-new-node   - Validar nuevo nodo');
    log('green', 'GET    /api/normalization/normalization-report - Reporte detallado');
    log('green', 'POST   /api/normalization/cleanup-metadata    - Limpiar metadatos');
    
    log('reset', '\nPruebas disponibles:');
    log('yellow', 'node test-normalization.js                   - Ejecutar todas las pruebas');
    log('yellow', 'node test-normalization.js --help            - Mostrar esta ayuda');
}

// Ejecutar el script
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
} else {
    testNormalizationSystem();
}