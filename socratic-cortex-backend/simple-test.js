// simple-test.js
// Script simple para probar la consulta problemática

require('dotenv').config();
const { driver } = require('./src/db/neo4j');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

const log = (color, message) => console.log(`${colors[color]}${message}${colors.reset}`);

async function testSimpleQuery() {
    log('cyan', '🧪 PRUEBA SIMPLE DE CONSULTA');
    log('cyan', '=' .repeat(30));
    
    const session = driver.session();
    
    try {
        // Probar la consulta exacta que está fallando
        log('blue', '\n1. Probando consulta básica de búsqueda...');
        
        const result = await session.run(`
            MATCH (source:KnowledgeNode)-[r:RELATES]->(target:KnowledgeNode)
            RETURN source, r, target
            LIMIT 5
        `);
        
        log('green', `✅ Consulta básica exitosa: ${result.records.length} resultados`);
        
        // Mostrar los resultados
        result.records.forEach((record, index) => {
            const source = record.get('source').properties;
            const target = record.get('target').properties;
            const rel = record.get('r').properties;
            
            log('cyan', `   ${index + 1}. ${source.label} → ${target.label}`);
            log('reset', `      Categoría: ${rel.category || 'N/A'}`);
            log('reset', `      Fuerza: ${rel.strength || 'N/A'}`);
            log('reset', `      Nivel: ${rel.epistemicLevel || 'N/A'}`);
        });
        
        // Probar consulta con filtros como en la API
        log('blue', '\n2. Probando consulta con filtros...');
        
        const filteredResult = await session.run(`
            MATCH (source:KnowledgeNode)-[r:RELATES]->(target:KnowledgeNode)
            WHERE r.category IS NOT NULL AND r.strength IS NOT NULL
            RETURN source, r, target
            ORDER BY r.strength DESC, r.confidence DESC
            LIMIT 5
        `);
        
        log('green', `✅ Consulta filtrada exitosa: ${filteredResult.records.length} resultados`);
        
        // Probar conversión de metadatos como en la API
        log('blue', '\n3. Probando conversión de metadatos...');
        
        const connections = filteredResult.records.map(record => {
            const source = record.get('source').properties;
            const target = record.get('target').properties;
            const relationship = record.get('r').properties;
            
            return {
                source: source,
                target: target,
                relationship: relationship,
                metadata: {
                    category: relationship.category,
                    strength: relationship.strength,
                    epistemicLevel: relationship.epistemicLevel,
                    universality: relationship.universality,
                    domainBridge: relationship.domainBridge,
                    confidence: relationship.confidence
                }
            };
        });
        
        log('green', `✅ Conversión de metadatos exitosa: ${connections.length} conexiones procesadas`);
        
        // Mostrar ejemplo de conexión procesada
        if (connections.length > 0) {
            const conn = connections[0];
            log('yellow', '\n📋 Ejemplo de conexión procesada:');
            log('reset', `   Fuente: ${conn.source.label}`);
            log('reset', `   Destino: ${conn.target.label}`);
            log('reset', `   Categoría: ${conn.metadata.category}`);
            log('reset', `   Fuerza: ${conn.metadata.strength}`);
            log('reset', `   Nivel: ${conn.metadata.epistemicLevel}`);
        }
        
        log('green', '\n🎉 TODAS LAS CONSULTAS DIRECTAS FUNCIONAN CORRECTAMENTE');
        log('yellow', '\n💡 El problema está en el endpoint de la API, no en los datos');
        
    } catch (error) {
        log('red', `❌ Error en consulta directa: ${error.message}`);
        log('red', `   Detalles: ${error.stack}`);
    } finally {
        await session.close();
        process.exit(0);
    }
}

testSimpleQuery();