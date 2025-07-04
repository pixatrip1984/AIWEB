// socratic-cortex-backend/src/services/normalizationService.js

const KnowledgeNormalizer = require('./knowledgeNormalizer');

class NormalizationService {
    constructor(driver) {
        this.driver = driver;
        this.normalizer = new KnowledgeNormalizer();
    }

    // Ejecutar normalización completa del grafo
    async normalizeGraph() {
        const session = this.driver.session();
        
        try {
            console.log('🔍 Iniciando normalización del grafo...');
            
            // 1. Obtener todos los nodos
            const nodes = await this.getAllNodes(session);
            console.log(`📊 Encontrados ${nodes.length} nodos para analizar`);
            
            // 2. Detectar duplicados
            const duplicateGroups = this.normalizer.detectDuplicates(nodes);
            console.log(`🎯 Detectados ${duplicateGroups.length} grupos de duplicados`);
            
            if (duplicateGroups.length === 0) {
                console.log('✅ No se encontraron duplicados. El grafo está limpio.');
                return { message: 'Grafo ya normalizado', duplicatesFound: 0 };
            }
            
            // 3. Procesar cada grupo de duplicados
            const mergeResults = [];
            
            for (const group of duplicateGroups) {
                console.log(`🔄 Procesando grupo: ${group.map(n => n.label).join(', ')}`);
                
                const mergedNode = this.normalizer.mergeNodes(group);
                const mergeResult = await this.executeNodeMerge(session, group, mergedNode);
                mergeResults.push(mergeResult);
            }
            
            // 4. Limpiar nodos huérfanos y relaciones inconsistentes
            await this.cleanupOrphanedNodes(session);
            await this.validateRelationships(session);
            
            // 5. Generar reporte
            const report = this.normalizer.generateNormalizationReport(duplicateGroups, mergeResults);
            
            console.log('✅ Normalización completada exitosamente');
            return report;
            
        } catch (error) {
            console.error('❌ Error durante la normalización:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    // Obtener todos los nodos del grafo
    async getAllNodes(session) {
        const result = await session.run(`
            MATCH (n:KnowledgeNode) 
            RETURN n.id as id, n.label as label, n.domain as domain, 
                   n.summary as summary, n.type as type
        `);
        
        return result.records.map(record => ({
            id: record.get('id'),
            label: record.get('label'),
            domain: record.get('domain'),
            summary: record.get('summary'),
            type: record.get('type')
        }));
    }

    // Ejecutar la fusión de un grupo de nodos
    async executeNodeMerge(session, originalNodes, mergedNode) {
        const nodeIds = originalNodes.map(n => n.id);
        const primaryId = mergedNode.id;
        
        try {
            // Iniciar transacción
            const tx = session.beginTransaction();
            
            // 1. Actualizar el nodo primario con la información fusionada
            await tx.run(`
                MATCH (n:KnowledgeNode {id: $primaryId})
                SET n.label = $label,
                    n.domain = $domain,
                    n.summary = $summary,
                    n.mergedFrom = $mergedFrom,
                    n.confidence = $confidence,
                    n.lastNormalized = datetime()
            `, {
                primaryId: primaryId,
                label: mergedNode.label,
                domain: mergedNode.domain,
                summary: mergedNode.summary,
                mergedFrom: mergedNode.mergedFrom,
                confidence: mergedNode.confidence
            });
            
            // 2. Transferir todas las relaciones de los nodos duplicados al primario
            for (const nodeId of nodeIds) {
                if (nodeId === primaryId) continue;
                
                // Transferir relaciones salientes
                await tx.run(`
                    MATCH (duplicate:KnowledgeNode {id: $nodeId})-[r:RELATES]->(target)
                    MATCH (primary:KnowledgeNode {id: $primaryId})
                    WHERE NOT (primary)-[:RELATES]->(target)
                    CREATE (primary)-[newR:RELATES]->(target)
                    SET newR = properties(r)
                    DELETE r
                `, { nodeId, primaryId });
                
                // Transferir relaciones entrantes
                await tx.run(`
                    MATCH (source)-[r:RELATES]->(duplicate:KnowledgeNode {id: $nodeId})
                    MATCH (primary:KnowledgeNode {id: $primaryId})
                    WHERE NOT (source)-[:RELATES]->(primary)
                    CREATE (source)-[newR:RELATES]->(primary)
                    SET newR = properties(r)
                    DELETE r
                `, { nodeId, primaryId });
            }
            
            // 3. Eliminar nodos duplicados
            for (const nodeId of nodeIds) {
                if (nodeId === primaryId) continue;
                
                await tx.run(`
                    MATCH (n:KnowledgeNode {id: $nodeId})
                    DETACH DELETE n
                `, { nodeId });
            }
            
            // Confirmar transacción
            await tx.commit();
            
            console.log(`✅ Fusionado exitosamente: ${originalNodes.map(n => n.label).join(' + ')} → ${mergedNode.label}`);
            
            return mergedNode;
            
        } catch (error) {
            console.error(`❌ Error fusionando nodos: ${error.message}`);
            throw error;
        }
    }

    // Limpiar nodos huérfanos
    async cleanupOrphanedNodes(session) {
        const result = await session.run(`
            MATCH (n:KnowledgeNode)
            WHERE NOT (n)-[:RELATES]-() AND NOT ()-[:RELATES]-(n)
            RETURN count(n) as orphanCount
        `);
        
        const orphanCount = result.records[0].get('orphanCount').toNumber();
        
        if (orphanCount > 0) {
            console.log(`🧹 Encontrados ${orphanCount} nodos huérfanos. Marcando para revisión...`);
            
            // En lugar de eliminar, marcar para revisión manual
            await session.run(`
                MATCH (n:KnowledgeNode)
                WHERE NOT (n)-[:RELATES]-() AND NOT ()-[:RELATES]-(n)
                SET n.needsReview = true, n.orphanedAt = datetime()
            `);
        }
    }

    // Validar relaciones
    async validateRelationships(session) {
        // Detectar relaciones duplicadas
        const result = await session.run(`
            MATCH (a)-[r1:RELATES]->(b)
            MATCH (a)-[r2:RELATES]->(b)
            WHERE id(r1) < id(r2) AND r1.type = r2.type
            RETURN count(*) as duplicateRels
        `);
        
        const duplicateCount = result.records[0].get('duplicateRels').toNumber();
        
        if (duplicateCount > 0) {
            console.log(`🔗 Eliminando ${duplicateCount} relaciones duplicadas...`);
            
            await session.run(`
                MATCH (a)-[r1:RELATES]->(b)
                MATCH (a)-[r2:RELATES]->(b)
                WHERE id(r1) < id(r2) AND r1.type = r2.type
                DELETE r2
            `);
        }
    }

    // Obtener estadísticas del grafo después de normalización
    async getGraphStats(session) {
        const stats = {};
        
        // Contar nodos por dominio
        const domainResult = await session.run(`
            MATCH (n:KnowledgeNode)
            RETURN n.domain as domain, count(n) as count
            ORDER BY count DESC
        `);
        
        stats.nodesByDomain = domainResult.records.map(record => ({
            domain: record.get('domain') || 'Sin Dominio',
            count: record.get('count').toNumber()
        }));
        
        // Contar relaciones por tipo
        const relResult = await session.run(`
            MATCH ()-[r:RELATES]->()
            RETURN r.type as type, count(r) as count
            ORDER BY count DESC
        `);
        
        stats.relationshipsByType = relResult.records.map(record => ({
            type: record.get('type') || 'Sin Tipo',
            count: record.get('count').toNumber()
        }));
        
        // Estadísticas generales
        const generalResult = await session.run(`
            MATCH (n:KnowledgeNode)
            OPTIONAL MATCH ()-[r:RELATES]->()
            RETURN count(DISTINCT n) as totalNodes, count(r) as totalRelationships
        `);
        
        const record = generalResult.records[0];
        stats.totalNodes = record.get('totalNodes').toNumber();
        stats.totalRelationships = record.get('totalRelationships').toNumber();
        
        return stats;
    }

    // Normalización incremental (para nuevos nodos)
    async normalizeNewNode(nodeData) {
        const session = this.driver.session();
        
        try {
            // Buscar posibles duplicados del nuevo nodo
            const existingNodes = await this.getAllNodes(session);
            const potentialDuplicates = existingNodes.filter(existing => 
                this.normalizer.areSimilarConcepts(nodeData, existing)
            );
            
            if (potentialDuplicates.length > 0) {
                console.log(`⚠️  Nuevo nodo "${nodeData.label}" tiene posibles duplicados:`, 
                    potentialDuplicates.map(n => n.label));
                
                return {
                    shouldMerge: true,
                    duplicates: potentialDuplicates,
                    suggestedMerge: this.normalizer.mergeNodes([nodeData, ...potentialDuplicates])
                };
            }
            
            // Si no hay duplicados, normalizar el nodo individual
            const normalizedNode = {
                ...nodeData,
                id: this.normalizer.idPatterns.normalize(nodeData.label),
                domain: this.normalizer.normalizeDomain(nodeData.domain)
            };
            
            return {
                shouldMerge: false,
                normalizedNode
            };
            
        } finally {
            await session.close();
        }
    }
}

module.exports = NormalizationService;