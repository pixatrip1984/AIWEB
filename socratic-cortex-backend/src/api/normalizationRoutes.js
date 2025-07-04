// socratic-cortex-backend/src/api/normalizationRoutes.js

const express = require('express');
const router = express.Router();
const { driver } = require('../db/neo4j');
const NormalizationService = require('../services/normalizationService');

// Instancia del servicio de normalización
const normalizationService = new NormalizationService(driver);

// ===================================================
// === ENDPOINT 1: NORMALIZACIÓN COMPLETA DEL GRAFO ===
// ===================================================
router.post('/normalize-graph', async (req, res) => {
    try {
        console.log('🚀 Iniciando normalización completa del grafo...');
        
        const report = await normalizationService.normalizeGraph();
        
        res.status(200).json({
            success: true,
            message: 'Normalización completada exitosamente',
            report: report
        });
        
    } catch (error) {
        console.error('❌ Error en normalización:', error);
        res.status(500).json({
            success: false,
            error: 'Error durante la normalización del grafo',
            details: error.message
        });
    }
});

// ===================================================
// === ENDPOINT 2: ESTADÍSTICAS POST-NORMALIZACIÓN ===
// ===================================================
router.get('/graph-stats', async (req, res) => {
    const session = driver.session();
    
    try {
        const stats = await normalizationService.getGraphStats(session);
        
        res.status(200).json({
            success: true,
            stats: stats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas del grafo'
        });
    } finally {
        await session.close();
    }
});

// ===================================================
// === ENDPOINT 3: DETECTAR DUPLICADOS SIN FUSIONAR ===
// ===================================================
router.get('/detect-duplicates', async (req, res) => {
    const session = driver.session();
    
    try {
        // Obtener todos los nodos
        const result = await session.run(`
            MATCH (n:KnowledgeNode) 
            RETURN n.id as id, n.label as label, n.domain as domain, 
                   n.summary as summary, n.type as type
        `);
        
        const nodes = result.records.map(record => ({
            id: record.get('id'),
            label: record.get('label'),
            domain: record.get('domain'),
            summary: record.get('summary'),
            type: record.get('type')
        }));
        
        // Detectar duplicados usando el normalizador
        const normalizer = normalizationService.normalizer;
        const duplicateGroups = normalizer.detectDuplicates(nodes);
        
        // Preparar respuesta detallada
        const detailedGroups = duplicateGroups.map(group => ({
            nodes: group.map(node => ({
                id: node.id,
                label: node.label,
                domain: node.domain
            })),
            suggestedMerge: normalizer.mergeNodes(group),
            confidence: normalizer.calculateMergeConfidence(group)
        }));
        
        res.status(200).json({
            success: true,
            duplicateGroups: detailedGroups,
            totalGroups: duplicateGroups.length,
            totalDuplicates: duplicateGroups.reduce((sum, group) => sum + group.length, 0)
        });
        
    } catch (error) {
        console.error('❌ Error detectando duplicados:', error);
        res.status(500).json({
            success: false,
            error: 'Error al detectar duplicados'
        });
    } finally {
        await session.close();
    }
});

// ===================================================
// === ENDPOINT 4: FUSIONAR GRUPO ESPECÍFICO      ===
// ===================================================
router.post('/merge-group', async (req, res) => {
    const session = driver.session();
    const { nodeIds, primaryNodeId } = req.body;
    
    if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length < 2) {
        return res.status(400).json({
            success: false,
            error: 'Se requiere un array de al menos 2 nodeIds'
        });
    }
    
    try {
        // Obtener los nodos a fusionar
        const result = await session.run(`
            MATCH (n:KnowledgeNode) 
            WHERE n.id IN $nodeIds
            RETURN n.id as id, n.label as label, n.domain as domain, 
                   n.summary as summary, n.type as type
        `, { nodeIds });
        
        const nodes = result.records.map(record => ({
            id: record.get('id'),
            label: record.get('label'),
            domain: record.get('domain'),
            summary: record.get('summary'),
            type: record.get('type')
        }));
        
        if (nodes.length !== nodeIds.length) {
            return res.status(404).json({
                success: false,
                error: 'Algunos nodos no fueron encontrados'
            });
        }
        
        // Establecer nodo primario si se especificó
        if (primaryNodeId) {
            const primaryIndex = nodes.findIndex(n => n.id === primaryNodeId);
            if (primaryIndex > 0) {
                // Mover el nodo primario al inicio
                const primaryNode = nodes.splice(primaryIndex, 1)[0];
                nodes.unshift(primaryNode);
            }
        }
        
        // Fusionar los nodos
        const normalizer = normalizationService.normalizer;
        const mergedNode = normalizer.mergeNodes(nodes);
        const mergeResult = await normalizationService.executeNodeMerge(session, nodes, mergedNode);
        
        res.status(200).json({
            success: true,
            message: 'Nodos fusionados exitosamente',
            mergedNode: mergeResult,
            originalNodes: nodes.map(n => ({ id: n.id, label: n.label }))
        });
        
    } catch (error) {
        console.error('❌ Error fusionando grupo:', error);
        res.status(500).json({
            success: false,
            error: 'Error al fusionar el grupo de nodos',
            details: error.message
        });
    } finally {
        await session.close();
    }
});

// ===================================================
// === ENDPOINT 5: NORMALIZACIÓN INCREMENTAL      ===
// ===================================================
router.post('/validate-new-node', async (req, res) => {
    const { nodeData } = req.body;
    
    if (!nodeData || !nodeData.label) {
        return res.status(400).json({
            success: false,
            error: 'Se requiere nodeData con label'
        });
    }
    
    try {
        const validation = await normalizationService.normalizeNewNode(nodeData);
        
        res.status(200).json({
            success: true,
            validation: validation
        });
        
    } catch (error) {
        console.error('❌ Error validando nuevo nodo:', error);
        res.status(500).json({
            success: false,
            error: 'Error al validar el nuevo nodo'
        });
    }
});

// ===================================================
// === ENDPOINT 6: LIMPIAR METADATOS DE NORMALIZACIÓN ===
// ===================================================
router.post('/cleanup-metadata', async (req, res) => {
    const session = driver.session();
    
    try {
        // Limpiar metadatos de normalización para testing
        await session.run(`
            MATCH (n:KnowledgeNode)
            REMOVE n.mergedFrom, n.confidence, n.lastNormalized, n.needsReview, n.orphanedAt
        `);
        
        res.status(200).json({
            success: true,
            message: 'Metadatos de normalización limpiados'
        });
        
    } catch (error) {
        console.error('❌ Error limpiando metadatos:', error);
        res.status(500).json({
            success: false,
            error: 'Error al limpiar metadatos'
        });
    } finally {
        await session.close();
    }
});

// ===================================================
// === ENDPOINT 7: REPORTE DETALLADO DE NORMALIZACIÓN ===
// ===================================================
router.get('/normalization-report', async (req, res) => {
    const session = driver.session();
    
    try {
        // Obtener nodos que han sido normalizados
        const normalizedResult = await session.run(`
            MATCH (n:KnowledgeNode)
            WHERE EXISTS(n.mergedFrom)
            RETURN n.id as id, n.label as label, n.mergedFrom as mergedFrom, 
                   n.confidence as confidence, n.lastNormalized as lastNormalized
            ORDER BY n.lastNormalized DESC
        `);
        
        // Obtener nodos que necesitan revisión
        const reviewResult = await session.run(`
            MATCH (n:KnowledgeNode)
            WHERE EXISTS(n.needsReview)
            RETURN n.id as id, n.label as label, n.orphanedAt as orphanedAt
        `);
        
        // Estadísticas de calidad
        const qualityResult = await session.run(`
            MATCH (n:KnowledgeNode)
            RETURN 
                count(n) as totalNodes,
                count(CASE WHEN n.domain IS NOT NULL AND n.domain <> 'Sin Dominio' THEN 1 END) as nodesWithDomain,
                count(CASE WHEN n.summary IS NOT NULL AND length(n.summary) > 50 THEN 1 END) as nodesWithGoodSummary,
                count(CASE WHEN EXISTS(n.mergedFrom) THEN 1 END) as normalizedNodes,
                count(CASE WHEN EXISTS(n.needsReview) THEN 1 END) as nodesNeedingReview
        `);
        
        const qualityRecord = qualityResult.records[0];
        const totalNodes = qualityRecord.get('totalNodes').toNumber();
        
        const report = {
            timestamp: new Date().toISOString(),
            quality: {
                totalNodes: totalNodes,
                nodesWithDomain: qualityRecord.get('nodesWithDomain').toNumber(),
                nodesWithGoodSummary: qualityRecord.get('nodesWithGoodSummary').toNumber(),
                normalizedNodes: qualityRecord.get('normalizedNodes').toNumber(),
                nodesNeedingReview: qualityRecord.get('nodesNeedingReview').toNumber(),
                domainCompleteness: totalNodes > 0 ? (qualityRecord.get('nodesWithDomain').toNumber() / totalNodes * 100).toFixed(1) + '%' : '0%',
                summaryCompleteness: totalNodes > 0 ? (qualityRecord.get('nodesWithGoodSummary').toNumber() / totalNodes * 100).toFixed(1) + '%' : '0%'
            },
            recentNormalizations: normalizedResult.records.map(record => ({
                id: record.get('id'),
                label: record.get('label'),
                mergedFrom: record.get('mergedFrom'),
                confidence: record.get('confidence'),
                date: record.get('lastNormalized')
            })),
            nodesNeedingReview: reviewResult.records.map(record => ({
                id: record.get('id'),
                label: record.get('label'),
                orphanedAt: record.get('orphanedAt')
            }))
        };
        
        res.status(200).json({
            success: true,
            report: report
        });
        
    } catch (error) {
        console.error('❌ Error generando reporte:', error);
        res.status(500).json({
            success: false,
            error: 'Error al generar reporte de normalización'
        });
    } finally {
        await session.close();
    }
});

module.exports = router;