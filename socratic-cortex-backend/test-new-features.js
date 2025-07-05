// test-new-features.js
// Script para probar las nuevas funcionalidades de la Fase 1.2

require('dotenv').config();
const axios = require('axios');

const API_BASE = 'http://127.0.0.1:5000';

// Colores para output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m'
};

const log = (color, message) => console.log(`${colors[color]}${message}${colors.reset}`);

async function testEnhancedFeatures() {
    log('cyan', '🧪 PROBANDO NUEVAS FUNCIONALIDADES DE FASE 1.2');
    log('cyan', '=' .repeat(60));
    
    try {
        // 1. Reporte de Metadatos
        log('blue', '\n1. 📋 REPORTE DE METADATOS COMPLETO:');
        const metadataReport = await axios.get(`${API_BASE}/api/enhanced/metadata-report`);
        
        if (metadataReport.data.success) {
            const report = metadataReport.data.report;
            const summary = metadataReport.data.summary;
            
            log('green', '✅ Reporte generado exitosamente');
            log('yellow', `📊 Resumen:`);
            log('reset', `   • Total categorías: ${summary.totalCategories}`);
            log('reset', `   • Total niveles epistémicos: ${summary.totalEpistemicLevels}`);
            log('reset', `   • Total puentes entre dominios: ${summary.totalDomainBridges}`);
            log('reset', `   • Categoría dominante: ${summary.mostConnectedCategory}`);
            log('reset', `   • Nivel epistémico dominante: ${summary.dominantEpistemicLevel}`);
            
            if (report.categories && report.categories.length > 0) {
                log('cyan', '\n📚 Distribución por Categorías:');
                report.categories.slice(0, 5).forEach(cat => {
                    log('reset', `   • ${cat.category}: ${cat.count} conexiones (fuerza promedio: ${(cat.avgStrength * 100).toFixed(1)}%)`);
                });
            }
            
            if (report.epistemicLevels && report.epistemicLevels.length > 0) {
                log('cyan', '\n🎓 Distribución por Niveles Epistémicos:');
                report.epistemicLevels.forEach(level => {
                    log('reset', `   • ${level.level}: ${level.count} conexiones`);
                });
            }
        }

        // 2. Búsquedas por Metadatos
        log('blue', '\n2. 🔍 BÚSQUEDAS POR METADATOS:');
        
        // Búsqueda general
        const generalSearch = await axios.get(`${API_BASE}/api/enhanced/search-by-metadata?limit=5`);
        if (generalSearch.data.success && generalSearch.data.connections.length > 0) {
            log('green', `✅ Búsqueda general: ${generalSearch.data.connections.length} conexiones encontradas`);
            generalSearch.data.connections.slice(0, 3).forEach((conn, index) => {
                log('cyan', `   ${index + 1}. ${conn.source.label} → ${conn.target.label}`);
                log('reset', `      Categoría: ${conn.metadata.category || 'N/A'}, Fuerza: ${(conn.metadata.strength * 100).toFixed(1)}%`);
            });
        }

        // Búsqueda por nivel epistémico
        const epistemicSearch = await axios.get(`${API_BASE}/api/enhanced/search-by-metadata?epistemicLevel=metaphysical&limit=3`);
        if (epistemicSearch.data.success && epistemicSearch.data.connections.length > 0) {
            log('green', `✅ Búsqueda metafísica: ${epistemicSearch.data.connections.length} conexiones encontradas`);
            epistemicSearch.data.connections.forEach((conn, index) => {
                log('magenta', `   ${index + 1}. ${conn.source.label} ↔ ${conn.target.label} (metafísico)`);
            });
        }

        // Búsqueda por fuerza
        const strengthSearch = await axios.get(`${API_BASE}/api/enhanced/search-by-metadata?minStrength=0.7&limit=3`);
        if (strengthSearch.data.success && strengthSearch.data.connections.length > 0) {
            log('green', `✅ Conexiones fuertes (>70%): ${strengthSearch.data.connections.length} encontradas`);
            strengthSearch.data.connections.forEach((conn, index) => {
                log('yellow', `   ${index + 1}. ${conn.source.label} → ${conn.target.label} (${(conn.metadata.strength * 100).toFixed(1)}%)`);
            });
        }

        // 3. Análisis de Dominios Cruzados
        log('blue', '\n3. 🌉 ANÁLISIS DE DOMINIOS CRUZADOS:');
        const crossDomainAnalysis = await axios.get(`${API_BASE}/api/enhanced/cross-domain-analysis`);
        
        if (crossDomainAnalysis.data.success) {
            const analysis = crossDomainAnalysis.data.analysis;
            const insights = crossDomainAnalysis.data.insights;
            
            log('green', '✅ Análisis completado');
            
            if (analysis.domainBridges && analysis.domainBridges.length > 0) {
                log('cyan', '\n🌉 Puentes Interdisciplinarios:');
                analysis.domainBridges.slice(0, 5).forEach(bridge => {
                    log('reset', `   • ${bridge.sourceDomain} ↔ ${bridge.targetDomain}: ${bridge.bridgeCount} conexiones`);
                    log('reset', `     Fuerza promedio: ${(bridge.avgStrength * 100).toFixed(1)}%`);
                });
            } else {
                log('yellow', '⚠️  No se encontraron puentes interdisciplinarios claros');
            }
            
            if (analysis.universalConcepts && analysis.universalConcepts.length > 0) {
                log('cyan', '\n🌌 Conceptos Universales:');
                analysis.universalConcepts.slice(0, 5).forEach(concept => {
                    log('magenta', `   • "${concept.concept}" (${concept.primaryDomain})`);
                    log('reset', `     Conecta ${concept.domainSpan} dominios con ${concept.totalConnections} conexiones`);
                });
            } else {
                log('yellow', '⚠️  No se detectaron conceptos universales aún');
            }
            
            if (insights && insights.length > 0) {
                log('cyan', '\n💡 Insights Generados:');
                insights.forEach(insight => {
                    const icon = insight.significance === 'high' ? '🔥' : '📌';
                    log('reset', `   ${icon} ${insight.title}`);
                    log('reset', `      ${insight.description}`);
                });
            }
        }

        // 4. Estadísticas Generales
        log('blue', '\n4. 📊 ESTADÍSTICAS GENERALES DEL GRAFO:');
        const graphStats = await axios.get(`${API_BASE}/api/normalization/graph-stats`);
        
        if (graphStats.data.success) {
            const stats = graphStats.data.stats;
            
            log('green', '✅ Estadísticas obtenidas');
            log('yellow', `📈 Grafo actual:`);
            log('reset', `   • Total nodos: ${stats.totalNodes}`);
            log('reset', `   • Total relaciones: ${stats.totalRelationships}`);
            log('reset', `   • Densidad: ${(stats.totalRelationships / (stats.totalNodes * (stats.totalNodes - 1)) * 100).toFixed(2)}%`);
            
            if (stats.nodesByDomain) {
                log('cyan', '\n📚 Distribución por Dominios:');
                stats.nodesByDomain.slice(0, 5).forEach(domain => {
                    log('reset', `   • ${domain.domain}: ${domain.count} nodos`);
                });
            }
        }

        log('green', '\n🎉 TODAS LAS PRUEBAS COMPLETADAS');
        log('cyan', '\n💡 Su sistema ahora tiene capacidades avanzadas de:');
        log('reset', '   • Búsquedas por metadatos específicos');
        log('reset', '   • Análisis de conexiones interdisciplinarias');
        log('reset', '   • Detección de patrones epistémicos');
        log('reset', '   • Identificación de conceptos universales');
        log('magenta', '\n🚀 ¡Listo para la Fase 2: Motor de Analogías Profundas!');

    } catch (error) {
        log('red', `\n❌ Error durante las pruebas: ${error.message}`);
        if (error.response) {
            log('red', `   Código: ${error.response.status}`);
            log('red', `   URL: ${error.config?.url}`);
        }
        log('yellow', '\n💡 Asegúrese de que:');
        log('reset', '   • El servidor esté ejecutándose en puerto 5000');
        log('reset', '   • La migración se haya completado exitosamente');
    }
}

// Ejecutar las pruebas
testEnhancedFeatures();