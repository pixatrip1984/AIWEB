// socratic-cortex-backend/migrate-to-enhanced-architecture.js
// FASE 1.2 - Script de migración para arquitectura de datos extendida

require('dotenv').config();

const axios = require('axios');
const { driver } = require('./src/db/neo4j');

const API_BASE = 'http://127.0.0.1:5000';

// Colores para console output
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

async function migrateToEnhancedArchitecture() {
    log('cyan', '🚀 MIGRANDO A ARQUITECTURA DE DATOS EXTENDIDA');
    log('cyan', '=' .repeat(60));
    
    try {
        // 1. Verificar estado del servidor
        log('blue', '\n1. Verificando estado del servidor...');
        const healthResponse = await axios.get(`${API_BASE}/health`);
        log('green', `✅ Servidor activo: ${healthResponse.data.status}`);

        // 2. Obtener estadísticas pre-migración
        log('blue', '\n2. Obteniendo estadísticas pre-migración...');
        const preStatsResponse = await axios.get(`${API_BASE}/api/normalization/graph-stats`);
        const preStats = preStatsResponse.data.stats;
        log('yellow', `📊 Estado actual: ${preStats.totalNodes} nodos, ${preStats.totalRelationships} relaciones`);

        // 3. Configurar arquitectura extendida
        log('blue', '\n3. Configurando arquitectura de datos extendida...');
        const setupResponse = await axios.post(`${API_BASE}/api/graph/setup-enhanced-architecture`);
        if (setupResponse.data.success) {
            log('green', '✅ Arquitectura extendida configurada');
            setupResponse.data.features.forEach(feature => {
                log('cyan', `   • ${feature}`);
            });
        }

        // 4. Enriquecer conexiones existentes
        log('blue', '\n4. Enriqueciendo conexiones con metadatos...');
        log('yellow', '⚠️  Este proceso puede tomar varios minutos...');
        
        const enrichResponse = await axios.post(`${API_BASE}/api/graph/enrich-connections`);
        if (enrichResponse.data.success) {
            const stats = enrichResponse.data.statistics;
            log('green', `✅ Enriquecimiento completado:`);
            log('cyan', `   • Conexiones procesadas: ${stats.totalProcessed}`);
            log('cyan', `   • Conexiones enriquecidas: ${stats.enrichedCount}`);
        }

        // 5. Generar reporte de metadatos
        log('blue', '\n5. Generando reporte de metadatos...');
        const reportResponse = await axios.get(`${API_BASE}/api/graph/metadata-report`);
        if (reportResponse.data.success) {
            const report = reportResponse.data.report;
            const summary = reportResponse.data.summary;
            
            log('green', '\n📋 REPORTE DE METADATOS:');
            log('cyan', `   • Categorías de relación: ${summary.totalCategories}`);
            log('cyan', `   • Niveles epistémicos: ${summary.totalEpistemicLevels}`);
            log('cyan', `   • Puentes entre dominios: ${summary.totalDomainBridges}`);
            log('cyan', `   • Categoría dominante: ${summary.mostConnectedCategory}`);
            log('cyan', `   • Nivel epistémico dominante: ${summary.dominantEpistemicLevel}`);
        }

        log('green', '\n🎉 MIGRACIÓN BÁSICA COMPLETADA EXITOSAMENTE');
        
    } catch (error) {
        log('red', `\n❌ Error durante la migración: ${error.message}`);
        if (error.response) {
            log('red', `   Código: ${error.response.status}`);
            log('red', `   Detalle: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        log('yellow', '\n💡 Pasos para resolver:');
        log('reset', '   • Verificar que el servidor esté ejecutándose en puerto 5000');
        log('reset', '   • Verificar conexión a Neo4j');
        log('reset', '   • Revisar logs del servidor para más detalles');
    }
}

// Función principal
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        log('cyan', '\n🏗️ ARQUITECTURA DE DATOS EXTENDIDA - AYUDA');
        log('reset', 'Uso: node migrate-to-enhanced-architecture.js [opciones]');
        log('reset', 'Opciones:');
        log('yellow', '  --full    Migración completa con datos de prueba');
        log('yellow', '  --help    Mostrar esta ayuda');
    } else {
        await migrateToEnhancedArchitecture();
    }
}

// Ejecutar el script
main().catch(error => {
    log('red', `❌ Error fatal: ${error.message}`);
    process.exit(1);
});