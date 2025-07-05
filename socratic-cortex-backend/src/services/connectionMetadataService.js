// socratic-cortex-backend/src/services/connectionMetadataService.js
// FASE 1.2 - Sistema de metadatos para conexiones enriquecidas

const RelationshipTypes = require('../models/RelationshipTypes');

class ConnectionMetadataService {
    constructor(driver) {
        this.driver = driver;
        this.relationTypes = new RelationshipTypes();
    }

    // Enriquecer todas las relaciones existentes con metadatos
    async enrichExistingConnections() {
        const session = this.driver.session();
        let enrichedCount = 0;
        
        try {
            console.log('🔗 Iniciando enriquecimiento de conexiones existentes...');
            
            // Obtener todas las relaciones sin metadatos completos
            const result = await session.run(`
                MATCH (source:KnowledgeNode)-[r:RELATES]->(target:KnowledgeNode)
                WHERE r.category IS NULL OR r.strength IS NULL
                RETURN source, r, target
                ORDER BY source.domain, target.domain
            `);

            console.log(`📊 Encontradas ${result.records.length} conexiones por enriquecer`);

            // Procesar en lotes para eficiencia
            const batchSize = 50;
            for (let i = 0; i < result.records.length; i += batchSize) {
                const batch = result.records.slice(i, i + batchSize);
                
                for (const record of batch) {
                    const source = record.get('source').properties;
                    const target = record.get('target').properties;
                    const relation = record.get('r');
                    
                    // Generar metadatos enriquecidos
                    const metadata = await this.generateConnectionMetadata(source, target, relation.properties);
                    
                    // Actualizar la relación con metadatos
                    await this.updateConnectionMetadata(session, relation.identity.toString(), metadata);
                    enrichedCount++;
                }
                
                console.log(`✅ Procesadas ${Math.min(i + batchSize, result.records.length)}/${result.records.length} conexiones`);
            }

            console.log(`🎉 Enriquecimiento completado. ${enrichedCount} conexiones actualizadas.`);
            return { enrichedCount, totalProcessed: result.records.length };

        } catch (error) {
            console.error('❌ Error durante enriquecimiento:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    // Generar metadatos completos para una conexión
    async generateConnectionMetadata(sourceNode, targetNode, existingRelation = {}) {
        const metadata = {
            // Metadatos básicos de la relación
            type: existingRelation.type || 'ANALOGIA_ESTRUCTURAL',
            category: null,
            strength: 0.5,
            bidirectional: false,
            
            // Metadatos epistemológicos
            epistemicLevel: this.determineEpistemicLevel(sourceNode, targetNode),
            abstraction: this.calculateAbstractionLevel(sourceNode, targetNode),
            universality: this.calculateUniversality(sourceNode, targetNode),
            
            // Metadatos contextuales
            domainBridge: this.isDomainBridge(sourceNode, targetNode),
            historicalRelevance: this.calculateHistoricalRelevance(sourceNode, targetNode),
            
            // Metadatos de confianza
            confidence: 0.7,
            source: 'system_generated',
            lastUpdated: new Date().toISOString(),
            
            // Metadatos para navegación
            pathWeight: 1.0,
            prerequisites: [],
            implications: []
        };

        // Enriquecer con información del tipo de relación
        const relationType = this.relationTypes.getOptimalRelationType(
            sourceNode.domain, 
            targetNode.domain,
            `${sourceNode.summary} ${targetNode.summary}`
        );
        
        const relationMetadata = this.relationTypes.getRelationMetadata(relationType);
        if (relationMetadata) {
            metadata.type = relationType;
            metadata.category = relationMetadata.category;
            metadata.strength = relationMetadata.strength;
            metadata.bidirectional = relationMetadata.bidirectional;
        }

        // Ajustar confianza basada en dominios
        metadata.confidence = this.adjustConfidenceByDomain(metadata.confidence, sourceNode, targetNode);

        return metadata;
    }

    // Determinar nivel epistémico de la conexión
    determineEpistemicLevel(sourceNode, targetNode) {
        const levels = {
            'empirical': 1,      // Observacional, datos
            'theoretical': 2,    // Hipótesis, teorías
            'conceptual': 3,     // Conceptos abstractos
            'metaphysical': 4,   // Principios fundamentales
            'transcendental': 5  // Realidades últimas
        };

        // Mapeo de dominios a niveles epistémicos
        const domainLevels = {
            'Física': 'theoretical',
            'Matemáticas': 'conceptual',
            'Filosofía': 'metaphysical',
            'Teología': 'transcendental',
            'Metafísica': 'metaphysical'
        };

        const sourceLevel = domainLevels[sourceNode.domain] || 'conceptual';
        const targetLevel = domainLevels[targetNode.domain] || 'conceptual';
        
        // Retornar el nivel más alto (más abstracto)
        return levels[sourceLevel] > levels[targetLevel] ? sourceLevel : targetLevel;
    }

    // Calcular nivel de abstracción
    calculateAbstractionLevel(sourceNode, targetNode) {
        let abstraction = 0.5; // Base

        // Aumentar por dominio abstracto
        const abstractDomains = ['Matemáticas', 'Filosofía', 'Metafísica', 'Teología'];
        if (abstractDomains.includes(sourceNode.domain)) abstraction += 0.2;
        if (abstractDomains.includes(targetNode.domain)) abstraction += 0.2;

        // Aumentar por términos abstractos en resúmenes
        const abstractTerms = ['universal', 'absoluto', 'esencia', 'principio', 'fundamento'];
        const sourceAbstract = abstractTerms.some(term => 
            sourceNode.summary?.toLowerCase().includes(term)
        );
        const targetAbstract = abstractTerms.some(term => 
            targetNode.summary?.toLowerCase().includes(term)
        );
        
        if (sourceAbstract) abstraction += 0.1;
        if (targetAbstract) abstraction += 0.1;

        return Math.min(abstraction, 1.0);
    }

    // Calcular universalidad (aplicabilidad transversal)
    calculateUniversality(sourceNode, targetNode) {
        let universality = 0.3; // Base

        // Conceptos que tienden a ser universales
        const universalConcepts = [
            'trinidad', 'dualidad', 'unidad', 'forma', 'esencia', 
            'armonía', 'proporción', 'orden', 'caos', 'infinito'
        ];

        const sourceUniversal = universalConcepts.some(concept =>
            sourceNode.label?.toLowerCase().includes(concept) ||
            sourceNode.summary?.toLowerCase().includes(concept)
        );
        
        const targetUniversal = universalConcepts.some(concept =>
            targetNode.label?.toLowerCase().includes(concept) ||
            targetNode.summary?.toLowerCase().includes(concept)
        );

        if (sourceUniversal) universality += 0.3;
        if (targetUniversal) universality += 0.3;

        // Boost si conecta dominios muy diferentes
        if (this.isDomainBridge(sourceNode, targetNode)) {
            universality += 0.2;
        }

        return Math.min(universality, 1.0);
    }

    // Detectar si es un puente entre dominios
    isDomainBridge(sourceNode, targetNode) {
        const crossDomainPairs = [
            ['Matemáticas', 'Física'],
            ['Filosofía', 'Teología'],
            ['Física', 'Filosofía'],
            ['Matemáticas', 'Filosofía'],
            ['Teología', 'Física']
        ];

        return crossDomainPairs.some(([domain1, domain2]) =>
            (sourceNode.domain === domain1 && targetNode.domain === domain2) ||
            (sourceNode.domain === domain2 && targetNode.domain === domain1)
        );
    }

    // Calcular relevancia histórica
    calculateHistoricalRelevance(sourceNode, targetNode) {
        const historicalTerms = [
            'platón', 'aristóteles', 'newton', 'einstein', 'aquino',
            'agustín', 'kant', 'heisenberg', 'pitágoras'
        ];

        let relevance = 0.2; // Base

        const sourceHistorical = historicalTerms.some(term =>
            sourceNode.label?.toLowerCase().includes(term) ||
            sourceNode.summary?.toLowerCase().includes(term)
        );
        
        const targetHistorical = historicalTerms.some(term =>
            targetNode.label?.toLowerCase().includes(term) ||
            targetNode.summary?.toLowerCase().includes(term)
        );

        if (sourceHistorical) relevance += 0.4;
        if (targetHistorical) relevance += 0.4;

        return Math.min(relevance, 1.0);
    }

    // Ajustar confianza basada en dominios
    adjustConfidenceByDomain(baseConfidence, sourceNode, targetNode) {
        let confidence = baseConfidence;

        // Conexiones dentro del mismo dominio = mayor confianza
        if (sourceNode.domain === targetNode.domain) {
            confidence += 0.2;
        }

        // Ciertos dominios tienen conexiones más confiables
        const reliableDomains = ['Matemáticas', 'Física'];
        if (reliableDomains.includes(sourceNode.domain) || 
            reliableDomains.includes(targetNode.domain)) {
            confidence += 0.1;
        }

        // Conexiones bien establecidas históricamente
        if (this.calculateHistoricalRelevance(sourceNode, targetNode) > 0.6) {
            confidence += 0.1;
        }

        return Math.min(confidence, 1.0);
    }

    // Actualizar metadatos de una conexión específica
    async updateConnectionMetadata(session, relationId, metadata) {
        await session.run(`
            MATCH ()-[r:RELATES]->()
            WHERE id(r) = $relationId
            SET r += $metadata
        `, { relationId: parseInt(relationId), metadata });
    }

    // Crear índices para búsquedas eficientes por metadatos
    async createMetadataIndexes() {
        const session = this.driver.session();
        
        try {
            const indexes = [
                'CREATE INDEX rel_category IF NOT EXISTS FOR ()-[r:RELATES]-() ON (r.category)',
                'CREATE INDEX rel_strength IF NOT EXISTS FOR ()-[r:RELATES]-() ON (r.strength)',
                'CREATE INDEX rel_epistemic_level IF NOT EXISTS FOR ()-[r:RELATES]-() ON (r.epistemicLevel)',
                'CREATE INDEX rel_universality IF NOT EXISTS FOR ()-[r:RELATES]-() ON (r.universality)',
                'CREATE INDEX rel_domain_bridge IF NOT EXISTS FOR ()-[r:RELATES]-() ON (r.domainBridge)'
            ];

            for (const indexQuery of indexes) {
                await session.run(indexQuery);
                console.log(`✅ Índice creado: ${indexQuery.split(' ')[2]}`);
            }

        } catch (error) {
            console.error('❌ Error creando índices:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    // Generar reporte de metadatos del grafo
    async generateMetadataReport() {
        const session = this.driver.session();
        
        try {
            // Estadísticas por categoría de relación
            const categoryStats = await session.run(`
                MATCH ()-[r:RELATES]->()
                WHERE r.category IS NOT NULL
                RETURN r.category as category, count(r) as count, 
                       avg(r.strength) as avgStrength, avg(r.confidence) as avgConfidence
                ORDER BY count DESC
            `);

            // Distribución de niveles epistémicos
            const epistemicStats = await session.run(`
                MATCH ()-[r:RELATES]->()
                WHERE r.epistemicLevel IS NOT NULL
                RETURN r.epistemicLevel as level, count(r) as count
                ORDER BY count DESC
            `);

            // Puentes entre dominios
            const bridgeStats = await session.run(`
                MATCH (source:KnowledgeNode)-[r:RELATES]->(target:KnowledgeNode)
                WHERE r.domainBridge = true
                RETURN source.domain as sourceDomain, target.domain as targetDomain, 
                       count(r) as bridgeCount
                ORDER BY bridgeCount DESC
            `);

            return {
                categories: categoryStats.records.map(r => ({
                    category: r.get('category'),
                    count: r.get('count').toNumber(),
                    avgStrength: r.get('avgStrength'),
                    avgConfidence: r.get('avgConfidence')
                })),
                epistemicLevels: epistemicStats.records.map(r => ({
                    level: r.get('level'),
                    count: r.get('count').toNumber()
                })),
                domainBridges: bridgeStats.records.map(r => ({
                    sourceDomain: r.get('sourceDomain'),
                    targetDomain: r.get('targetDomain'),
                    bridgeCount: r.get('bridgeCount').toNumber()
                }))
            };

        } catch (error) {
            console.error('❌ Error generando reporte de metadatos:', error);
            throw error;
        } finally {
            await session.close();
        }
    }
}

module.exports = ConnectionMetadataService;