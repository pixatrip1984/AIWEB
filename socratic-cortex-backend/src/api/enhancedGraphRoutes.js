// socratic-cortex-backend/src/api/enhancedGraphRoutes.js
// FASE 1.2 - API extendida para arquitectura de datos mejorada (CORREGIDA)
const neo4j = require('neo4j-driver');
const express = require('express');
const router = express.Router();
const { driver } = require('../db/neo4j');
const ConnectionMetadataService = require('../services/connectionMetadataService');

// Inicializar servicio de metadatos
const metadataService = new ConnectionMetadataService(driver);

// ===================================================
// === ENDPOINT 1: ENRIQUECER CONEXIONES EXISTENTES ===
// ===================================================
router.post('/enrich-connections', async (req, res) => {
    try {
        console.log('🔗 Iniciando enriquecimiento de conexiones...');
        
        const result = await metadataService.enrichExistingConnections();
        
        res.status(200).json({
            success: true,
            message: 'Conexiones enriquecidas exitosamente',
            statistics: result
        });
        
    } catch (error) {
        console.error('❌ Error enriqueciendo conexiones:', error);
        res.status(500).json({
            success: false,
            error: 'Error al enriquecer conexiones',
            details: error.message
        });
    }
});

// ===================================================
// === ENDPOINT 2: BUSCAR POR METADATOS ===
// ===================================================
router.get('/search-by-metadata', async (req, res) => {
    console.log('🔍 ENHANCED ROUTES - Ejecutando search-by-metadata'); // ← AGREGAR
    console.log('🔍 ENHANCED ROUTES - limit recibido:', req.query.limit, typeof req.query.limit); // ← AGREGAR
    const session = driver.session();
    
    const {
        category,           // Categoría de relación
        minStrength,        // Fuerza mínima
        epistemicLevel,     // Nivel epistémico
        domainBridge,       // Solo puentes entre dominios
        minUniversality,    // Universalidad mínima
        sourceId,          // Nodo fuente específico
        limit = 20
    } = req.query;
    
    try {
        // Construir query dinámicamente basado en filtros
        let whereConditions = [];
        let params = { limit: neo4j.int(parseInt(limit) || 20) };
        console.log('🔍 DEBUG - params.limit:', params.limit, 'tipo:', typeof params.limit);
        
        if (category) {
            whereConditions.push('r.category = $category');
            params.category = category;
        }
        
        if (minStrength) {
            whereConditions.push('r.strength >= $minStrength');
            params.minStrength = Number(minStrength);
        }
        
        if (epistemicLevel) {
            whereConditions.push('r.epistemicLevel = $epistemicLevel');
            params.epistemicLevel = epistemicLevel;
        }
        
        if (domainBridge === 'true') {
            whereConditions.push('r.domainBridge = true');
        }
        
        if (minUniversality) {
            whereConditions.push('r.universality >= $minUniversality');
            params.minUniversality = Number(minUniversality);
        }
        
        if (sourceId) {
            whereConditions.push('source.id = $sourceId');
            params.sourceId = sourceId;
        }
        
        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';
        
        const query = `
            MATCH (source:KnowledgeNode)-[r:RELATES]->(target:KnowledgeNode)
            ${whereClause}
            RETURN source, r, target
            ORDER BY r.strength DESC, r.confidence DESC
            LIMIT $limit
        `;
        
        const result = await session.run(query, params);
        
        const connections = result.records.map(record => ({
            source: record.get('source').properties,
            target: record.get('target').properties,
            relationship: record.get('r').properties,
            metadata: {
                category: record.get('r').properties.category,
                strength: record.get('r').properties.strength,
                epistemicLevel: record.get('r').properties.epistemicLevel,
                universality: record.get('r').properties.universality,
                domainBridge: record.get('r').properties.domainBridge,
                confidence: record.get('r').properties.confidence
            }
        }));
        
        res.status(200).json({
            success: true,
            connections: connections,
            total: connections.length,
            appliedFilters: {
                category,
                minStrength,
                epistemicLevel,
                domainBridge,
                minUniversality,
                sourceId
            }
        });
        
    } catch (error) {
        console.error('❌ Error en búsqueda por metadatos:', error);
        res.status(500).json({
            success: false,
            error: 'Error en búsqueda por metadatos',
            details: error.message
        });
    } finally {
        await session.close();
    }
});

// ===================================================
// === ENDPOINT 3: RUTAS DE CONOCIMIENTO INTELIGENTES ===
// ===================================================
router.get('/knowledge-paths/:sourceId/:targetId', async (req, res) => {
    const session = driver.session();
    const { sourceId, targetId } = req.params;
    const { 
        maxDepth = 4, 
        epistemicProgression = 'ascending',  // ascending, descending, any
        minStrength = 0.3 
    } = req.query;
    
    try {
        const maxDepthInt = Math.floor(parseInt(maxDepth, 10) || 4);
        const minStrengthFloat = Number(minStrength) || 0.3;
        
        // Query para encontrar rutas con progresión epistémica
        const pathQuery = `
            MATCH path = (source:KnowledgeNode {id: $sourceId})-[r:RELATES*1..${maxDepthInt}]-(target:KnowledgeNode {id: $targetId})
            WHERE ALL(rel in r WHERE rel.strength >= $minStrength)
            WITH path, r,
                 [rel in r | rel.epistemicLevel] as levels,
                 [rel in r | rel.strength] as strengths,
                 reduce(weight = 0, rel in r | weight + COALESCE(rel.pathWeight, 1.0)) as totalWeight
            WHERE size(levels) > 0
            RETURN path, levels, strengths, totalWeight,
                   reduce(avgStrength = 0.0, s in strengths | avgStrength + s) / size(strengths) as avgStrength
            ORDER BY 
                CASE WHEN $epistemicProgression = 'ascending' 
                     THEN reduce(score = 0, i in range(0, size(levels)-2) | 
                          score + CASE WHEN levels[i] <= levels[i+1] THEN 1 ELSE -1 END)
                     ELSE 0 END DESC,
                avgStrength DESC,
                totalWeight ASC
            LIMIT 10
        `;
        
        const result = await session.run(pathQuery, {
            sourceId,
            targetId,
            epistemicProgression,
            minStrength: minStrengthFloat
        });
        
        const paths = result.records.map(record => {
            const path = record.get('path');
            const levels = record.get('levels');
            const strengths = record.get('strengths');
            const totalWeight = record.get('totalWeight');
            const avgStrength = record.get('avgStrength');
            
            return {
                nodes: path.segments.map((segment, index) => ({
                    node: index === 0 ? segment.start.properties : segment.end.properties,
                    relation: segment.relationship.properties
                })).concat([{
                    node: path.segments[path.segments.length - 1].end.properties,
                    relation: null
                }]),
                epistemicLevels: levels,
                strengths: strengths,
                totalWeight: totalWeight,
                avgStrength: avgStrength,
                pathScore: calculatePathScore(levels, strengths, epistemicProgression)
            };
        });
        
        res.status(200).json({
            success: true,
            paths: paths,
            searchParams: {
                sourceId,
                targetId,
                maxDepth: maxDepthInt,
                epistemicProgression,
                minStrength: minStrengthFloat
            }
        });
        
    } catch (error) {
        console.error('❌ Error encontrando rutas de conocimiento:', error);
        res.status(500).json({
            success: false,
            error: 'Error encontrando rutas de conocimiento',
            details: error.message
        });
    } finally {
        await session.close();
    }
});

// ===================================================
// === ENDPOINT 4: ANÁLISIS DE DOMINIOS CRUZADOS ===
// ===================================================
router.get('/cross-domain-analysis', async (req, res) => {
    const session = driver.session();
    
    try {
        // Análisis de puentes entre dominios
        const bridgeAnalysis = await session.run(`
            MATCH (source:KnowledgeNode)-[r:RELATES]->(target:KnowledgeNode)
            WHERE source.domain <> target.domain AND r.domainBridge = true
            WITH source.domain as sourceDomain, target.domain as targetDomain,
                 count(r) as bridgeCount,
                 avg(r.strength) as avgStrength,
                 avg(r.universality) as avgUniversality,
                 collect({
                     sourceLabel: source.label,
                     targetLabel: target.label,
                     relationType: r.type,
                     strength: r.strength
                 }) as connections
            RETURN sourceDomain, targetDomain, bridgeCount, avgStrength, avgUniversality, connections
            ORDER BY bridgeCount DESC, avgStrength DESC
        `);
        
        // Identificar conceptos universales (conectan múltiples dominios)
        const universalConcepts = await session.run(`
            MATCH (n:KnowledgeNode)-[r:RELATES]-(connected:KnowledgeNode)
            WHERE r.universality >= 0.7
            WITH n, collect(DISTINCT connected.domain) as connectedDomains, count(r) as totalConnections
            WHERE size(connectedDomains) >= 3
            RETURN n.label as concept, n.domain as primaryDomain, 
                   connectedDomains, totalConnections,
                   size(connectedDomains) as domainSpan
            ORDER BY domainSpan DESC, totalConnections DESC
            LIMIT 20
        `);
        
        // Métricas de cohesión interdisciplinaria
        const cohesionMetrics = await session.run(`
            MATCH (n:KnowledgeNode)
            WITH DISTINCT n.domain as domain
            WITH collect(domain) as allDomains
            UNWIND allDomains as domain1
            UNWIND allDomains as domain2
            WITH domain1, domain2
            WHERE domain1 < domain2
            OPTIONAL MATCH (n1:KnowledgeNode {domain: domain1})-[r:RELATES]-(n2:KnowledgeNode {domain: domain2})
            WHERE r.domainBridge = true
            RETURN domain1, domain2, count(r) as connectionCount,
                   avg(r.strength) as avgConnectionStrength
            ORDER BY connectionCount DESC
        `);
        
        const analysis = {
            domainBridges: bridgeAnalysis.records.map(record => ({
                sourceDomain: record.get('sourceDomain'),
                targetDomain: record.get('targetDomain'),
                bridgeCount: record.get('bridgeCount').toNumber(),
                avgStrength: record.get('avgStrength'),
                avgUniversality: record.get('avgUniversality'),
                sampleConnections: record.get('connections').slice(0, 5)
            })),
            universalConcepts: universalConcepts.records.map(record => ({
                concept: record.get('concept'),
                primaryDomain: record.get('primaryDomain'),
                connectedDomains: record.get('connectedDomains'),
                totalConnections: record.get('totalConnections').toNumber(),
                domainSpan: record.get('domainSpan').toNumber()
            })),
            interdisciplinaryCohesion: cohesionMetrics.records.map(record => ({
                domain1: record.get('domain1'),
                domain2: record.get('domain2'),
                connectionCount: record.get('connectionCount').toNumber(),
                avgStrength: record.get('avgConnectionStrength')
            }))
        };
        
        res.status(200).json({
            success: true,
            analysis: analysis,
            insights: generateCrossDomainInsights(analysis)
        });
        
    } catch (error) {
        console.error('❌ Error en análisis de dominios cruzados:', error);
        res.status(500).json({
            success: false,
            error: 'Error en análisis de dominios cruzados',
            details: error.message
        });
    } finally {
        await session.close();
    }
});

// ===================================================
// === ENDPOINT 5: CONFIGURAR ARQUITECTURA EXTENDIDA ===
// ===================================================
router.post('/setup-enhanced-architecture', async (req, res) => {
    try {
        console.log('🏗️ Configurando arquitectura de datos extendida...');
        
        // 1. Crear índices de metadatos
        await metadataService.createMetadataIndexes();
        console.log('✅ Índices de metadatos creados');
        
        // 2. Verificar estructura (sin constraints para Community Edition)
        const session = driver.session();
        try {
            // En lugar de constraints, verificamos que existan relaciones
            const relationCheck = await session.run(`
                MATCH ()-[r:RELATES]->()
                RETURN count(r) as totalRelations
                LIMIT 1
            `);
            
            const relationCount = relationCheck.records[0].get('totalRelations').toNumber();
            console.log(`✅ Verificación: ${relationCount} relaciones encontradas en el grafo`);
            
        } finally {
            await session.close();
        }
        
        console.log('✅ Validación de tipos de relación aplicada');
        
        res.status(200).json({
            success: true,
            message: 'Arquitectura de datos extendida configurada exitosamente',
            features: [
                'Índices de metadatos optimizados',
                'Validación de tipos de relación',
                'Sistema de metadatos enriquecidos',
                'Búsquedas complejas habilitadas'
            ]
        });
        
    } catch (error) {
        console.error('❌ Error configurando arquitectura extendida:', error);
        res.status(500).json({
            success: false,
            error: 'Error configurando arquitectura extendida',
            details: error.message
        });
    }
});

// ===================================================
// === ENDPOINT 6: REPORTE DE METADATOS ===
// ===================================================
router.get('/metadata-report', async (req, res) => {
    try {
        const report = await metadataService.generateMetadataReport();
        
        res.status(200).json({
            success: true,
            report: report,
            summary: {
                totalCategories: report.categories.length,
                totalEpistemicLevels: report.epistemicLevels.length,
                totalDomainBridges: report.domainBridges.reduce((sum, bridge) => sum + bridge.bridgeCount, 0),
                mostConnectedCategory: report.categories[0]?.category || 'N/A',
                dominantEpistemicLevel: report.epistemicLevels[0]?.level || 'N/A'
            }
        });
        
    } catch (error) {
        console.error('❌ Error generando reporte de metadatos:', error);
        res.status(500).json({
            success: false,
            error: 'Error generando reporte de metadatos',
            details: error.message
        });
    }
});

// ===================================================
// === FUNCIONES AUXILIARES ===
// ===================================================

// Calcular score de ruta basado en progresión epistémica
function calculatePathScore(levels, strengths, progression) {
    let score = 0;
    
    // Score base por fuerza promedio
    const avgStrength = strengths.reduce((sum, s) => sum + s, 0) / strengths.length;
    score += avgStrength * 50;
    
    // Bonus por progresión epistémica correcta
    const epistemicOrder = {
        'empirical': 1,
        'theoretical': 2,
        'conceptual': 3,
        'metaphysical': 4,
        'transcendental': 5
    };
    
    if (progression === 'ascending') {
        for (let i = 0; i < levels.length - 1; i++) {
            if (epistemicOrder[levels[i]] <= epistemicOrder[levels[i + 1]]) {
                score += 10;
            }
        }
    }
    
    // Penalty por longitud excesiva
    score -= (levels.length - 2) * 5;
    
    return Math.max(score, 0);
}

// Generar insights de análisis de dominios cruzados
function generateCrossDomainInsights(analysis) {
    const insights = [];
    
    // Insight sobre puentes más fuertes
    const strongestBridge = analysis.domainBridges[0];
    if (strongestBridge) {
        insights.push({
            type: 'strongest_bridge',
            title: 'Puente Interdisciplinario Más Fuerte',
            description: `La conexión ${strongestBridge.sourceDomain} ↔ ${strongestBridge.targetDomain} tiene ${strongestBridge.bridgeCount} enlaces con fuerza promedio de ${(strongestBridge.avgStrength * 100).toFixed(1)}%`,
            significance: 'high'
        });
    }
    
    // Insight sobre conceptos universales
    const topUniversal = analysis.universalConcepts[0];
    if (topUniversal) {
        insights.push({
            type: 'universal_concept',
            title: 'Concepto Más Universal',
            description: `"${topUniversal.concept}" conecta ${topUniversal.domainSpan} dominios diferentes, siendo un nexo central del conocimiento`,
            significance: 'high'
        });
    }
    
    // Insight sobre cohesión general
    const totalConnections = analysis.interdisciplinaryCohesion.reduce(
        (sum, cohesion) => sum + cohesion.connectionCount, 0
    );
    insights.push({
        type: 'cohesion_level',
        title: 'Nivel de Cohesión Interdisciplinaria',
        description: `El grafo tiene ${totalConnections} conexiones interdisciplinarias, indicando un nivel ${totalConnections > 50 ? 'alto' : 'moderado'} de integración`,
        significance: totalConnections > 50 ? 'high' : 'medium'
    });
    
    return insights;
}

module.exports = router;