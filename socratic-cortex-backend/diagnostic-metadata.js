// diagnostic-metadata.js
// Script para diagnosticar problemas con los metadatos

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

async function diagnosisMetadata() {
    log('cyan', '🔍 DIAGNÓSTICO DE METADATOS');
    log('cyan', '=' .repeat(40));
    
    const session = driver.session();
    
    try {
        // 1. Verificar propiedades de las relaciones
        log('blue', '\n1. Verificando propiedades de relaciones...');
        
        const propCheck = await session.run(`
            MATCH ()-[r:RELATES]->()
            RETURN 
                count(r) as totalRelations,
                count(CASE WHEN r.category IS NOT NULL THEN 1 END) as withCategory,
                count(CASE WHEN r.strength IS NOT NULL THEN 1 END) as withStrength,
                count(CASE WHEN r.epistemicLevel IS NOT NULL THEN 1 END) as withEpistemicLevel,
                count(CASE WHEN r.universality IS NOT NULL THEN 1 END) as withUniversality,
                count(CASE WHEN r.domainBridge IS NOT NULL THEN 1 END) as withDomainBridge,
                count(CASE WHEN r.confidence IS NOT NULL THEN 1 END) as withConfidence
        `);
        
        const props = propCheck.records[0];
        const total = props.get('totalRelations').toNumber();
        
        log('yellow', `📊 Análisis de ${total} relaciones:`);
        log('reset', `   • Con categoría: ${props.get('withCategory').toNumber()}/${total}`);
        log('reset', `   • Con fuerza: ${props.get('withStrength').toNumber()}/${total}`);
        log('reset', `   • Con nivel epistémico: ${props.get('withEpistemicLevel').toNumber()}/${total}`);
        log('reset', `   • Con universalidad: ${props.get('withUniversality').toNumber()}/${total}`);
        log('reset', `   • Con puente de dominio: ${props.get('withDomainBridge').toNumber()}/${total}`);
        log('reset', `   • Con confianza: ${props.get('withConfidence').toNumber()}/${total}`);
        
        // 2. Mostrar ejemplos de relaciones
        log('blue', '\n2. Ejemplos de relaciones con sus metadatos:');
        
        const examples = await session.run(`
            MATCH (source)-[r:RELATES]->(target)
            RETURN source.label as sourceLabel, 
                   target.label as targetLabel,
                   r.type as type,
                   r.category as category,
                   r.strength as strength,
                   r.epistemicLevel as epistemicLevel,
                   r.confidence as confidence
            LIMIT 5
        `);
        
        examples.records.forEach((record, index) => {
            log('cyan', `   ${index + 1}. ${record.get('sourceLabel')} → ${record.get('targetLabel')}`);
            log('reset', `      Tipo: ${record.get('type') || 'N/A'}`);
            log('reset', `      Categoría: ${record.get('category') || 'N/A'}`);
            log('reset', `      Fuerza: ${record.get('strength') || 'N/A'}`);
            log('reset', `      Nivel: ${record.get('epistemicLevel') || 'N/A'}`);
            log('reset', `      Confianza: ${record.get('confidence') || 'N/A'}`);
        });
        
        // 3. Verificar si hay relaciones con problemas
        log('blue', '\n3. Verificando relaciones problemáticas...');
        
        const problematic = await session.run(`
            MATCH ()-[r:RELATES]->()
            WHERE r.strength IS NULL OR r.category IS NULL
            RETURN count(r) as problematicCount
        `);
        
        const probCount = problematic.records[0].get('problematicCount').toNumber();
        
        if (probCount > 0) {
            log('red', `⚠️  ${probCount} relaciones tienen metadatos incompletos`);
            log('yellow', '💡 Solución: Ejecutar re-enriquecimiento');
        } else {
            log('green', '✅ Todas las relaciones tienen metadatos básicos');
        }
        
        // 4. Verificar tipos de datos
        log('blue', '\n4. Verificando tipos de datos de metadatos...');
        
        const typeCheck = await session.run(`
            MATCH ()-[r:RELATES]->()
            WHERE r.strength IS NOT NULL
            RETURN 
                min(r.strength) as minStrength,
                max(r.strength) as maxStrength,
                avg(r.strength) as avgStrength,
                collect(DISTINCT r.epistemicLevel) as epistemicLevels
            LIMIT 1
        `);
        
        if (typeCheck.records.length > 0) {
            const types = typeCheck.records[0];
            log('green', '✅ Tipos de datos verificados:');
            log('reset', `   • Fuerza mínima: ${types.get('minStrength')}`);
            log('reset', `   • Fuerza máxima: ${types.get('maxStrength')}`);
            log('reset', `   • Fuerza promedio: ${types.get('avgStrength')}`);
            log('reset', `   • Niveles epistémicos: ${types.get('epistemicLevels').join(', ')}`);
        }
        
    } catch (error) {
        log('red', `❌ Error durante diagnóstico: ${error.message}`);
    } finally {
        await session.close();
    }
}

// Función para re-enriquecer solo las relaciones problemáticas
async function fixProblematicRelations() {
    log('cyan', '\n🔧 REPARANDO RELACIONES PROBLEMÁTICAS');
    log('cyan', '=' .repeat(40));
    
    const session = driver.session();
    
    try {
        // Agregar metadatos básicos a relaciones que no los tienen
        const fixResult = await session.run(`
            MATCH ()-[r:RELATES]->()
            WHERE r.strength IS NULL OR r.category IS NULL
            SET r.strength = 0.5,
                r.category = 'similarity',
                r.epistemicLevel = 'conceptual',
                r.universality = 0.3,
                r.domainBridge = false,
                r.confidence = 0.6
            RETURN count(r) as fixedCount
        `);
        
        const fixed = fixResult.records[0].get('fixedCount').toNumber();
        log('green', `✅ ${fixed} relaciones reparadas con metadatos por defecto`);
        
    } catch (error) {
        log('red', `❌ Error reparando relaciones: ${error.message}`);
    } finally {
        await session.close();
    }
}

// Función principal
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--fix')) {
        await diagnosisMetadata();
        await fixProblematicRelations();
        log('cyan', '\n🔄 Ejecute las pruebas nuevamente:');
        log('reset', 'node test-new-features.js');
    } else {
        await diagnosisMetadata();
        log('cyan', '\n💡 Para reparar problemas encontrados:');
        log('reset', 'node diagnostic-metadata.js --fix');
    }
    
    process.exit(0);
}

main().catch(error => {
    log('red', `❌ Error fatal: ${error.message}`);
    process.exit(1);
});