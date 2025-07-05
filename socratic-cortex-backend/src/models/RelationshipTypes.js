// socratic-cortex-backend/src/models/RelationshipTypes.js
// FASE 1.2 - Modelo extendido para tipos de relación

class RelationshipTypes {
    constructor() {
        // Tipología jerárquica de relaciones basada en epistemología
        this.relationshipHierarchy = {
            // === RELACIONES CAUSALES ===
            CAUSAL: {
                category: 'causality',
                subcategories: {
                    CAUSA_DIRECTA: { strength: 1.0, bidirectional: false },
                    CAUSA_INDIRECTA: { strength: 0.7, bidirectional: false },
                    CONDICION_NECESARIA: { strength: 0.8, bidirectional: false },
                    CONDICION_SUFICIENTE: { strength: 0.9, bidirectional: false },
                    CORRELACION: { strength: 0.6, bidirectional: true }
                }
            },

            // === RELACIONES ANALÓGICAS ===
            ANALOGICAL: {
                category: 'similarity',
                subcategories: {
                    ANALOGIA_ESTRUCTURAL: { strength: 0.9, bidirectional: true },
                    ANALOGIA_FUNCIONAL: { strength: 0.8, bidirectional: true },
                    METAFORA: { strength: 0.6, bidirectional: false },
                    SIMBOLISMO: { strength: 0.7, bidirectional: false },
                    ARQUETIPO: { strength: 1.0, bidirectional: true }
                }
            },

            // === RELACIONES JERÁRQUICAS ===
            HIERARCHICAL: {
                category: 'hierarchy',
                subcategories: {
                    ES_TIPO_DE: { strength: 1.0, bidirectional: false },
                    CONTIENE: { strength: 0.9, bidirectional: false },
                    ES_PARTE_DE: { strength: 0.9, bidirectional: false },
                    GENERALIZA: { strength: 0.8, bidirectional: false },
                    ESPECIFICA: { strength: 0.8, bidirectional: false }
                }
            },

            // === RELACIONES EPISTÉMICAS ===
            EPISTEMIC: {
                category: 'knowledge',
                subcategories: {
                    FUNDAMENTA: { strength: 0.9, bidirectional: false },
                    PRESUPONE: { strength: 0.8, bidirectional: false },
                    CONTRADICE: { strength: 0.7, bidirectional: true },
                    COMPLEMENTA: { strength: 0.8, bidirectional: true },
                    EVIDENCIA: { strength: 0.7, bidirectional: false }
                }
            },

            // === RELACIONES TEMPORALES ===
            TEMPORAL: {
                category: 'temporality',
                subcategories: {
                    PRECEDE: { strength: 0.8, bidirectional: false },
                    DESARROLLA: { strength: 0.9, bidirectional: false },
                    EVOLUCIONA_A: { strength: 0.8, bidirectional: false },
                    INFLUENCIA_HISTORICA: { strength: 0.7, bidirectional: false }
                }
            },

            // === RELACIONES TRASCENDENTALES ===
            TRANSCENDENTAL: {
                category: 'transcendence',
                subcategories: {
                    PARTICIPA_EN: { strength: 0.9, bidirectional: false },
                    REFLEJA: { strength: 0.8, bidirectional: false },
                    EMANA_DE: { strength: 0.9, bidirectional: false },
                    TRASCIENDE: { strength: 1.0, bidirectional: false },
                    IMITA: { strength: 0.7, bidirectional: false }
                }
            }
        };

        // Mapeo de dominios a tipos de relación preferidos
        this.domainRelationPreferences = {
            'Filosofía': ['EPISTEMIC', 'TRANSCENDENTAL', 'ANALOGICAL'],
            'Matemáticas': ['HIERARCHICAL', 'ANALOGICAL', 'EPISTEMIC'],
            'Física': ['CAUSAL', 'ANALOGICAL', 'TEMPORAL'],
            'Teología': ['TRANSCENDENTAL', 'ANALOGICAL', 'HIERARCHICAL'],
            'Metafísica': ['TRANSCENDENTAL', 'EPISTEMIC', 'ANALOGICAL']
        };
    }

    // Obtener tipo de relación óptimo dados dos dominios
    getOptimalRelationType(sourceDomain, targetDomain, context = '') {
        const sourcePrefs = this.domainRelationPreferences[sourceDomain] || [];
        const targetPrefs = this.domainRelationPreferences[targetDomain] || [];
        
        // Buscar tipos de relación comunes
        const commonTypes = sourcePrefs.filter(type => targetPrefs.includes(type));
        
        if (commonTypes.length > 0) {
            return commonTypes[0]; // Retornar el más prioritario
        }
        
        // Si no hay comunes, usar heurísticas basadas en contexto
        if (context.includes('causa') || context.includes('efecto')) {
            return 'CAUSAL';
        }
        if (context.includes('similar') || context.includes('como')) {
            return 'ANALOGICAL';
        }
        if (context.includes('contiene') || context.includes('tipo')) {
            return 'HIERARCHICAL';
        }
        
        // Default: analógica (más universal)
        return 'ANALOGICAL';
    }

    // Validar si un tipo de relación es válido
    isValidRelationType(relationType) {
        for (const category of Object.values(this.relationshipHierarchy)) {
            if (category.subcategories[relationType]) {
                return true;
            }
        }
        return false;
    }

    // Obtener metadatos de un tipo de relación
    getRelationMetadata(relationType) {
        for (const [categoryKey, category] of Object.entries(this.relationshipHierarchy)) {
            if (category.subcategories[relationType]) {
                return {
                    category: category.category,
                    categoryKey: categoryKey,
                    ...category.subcategories[relationType]
                };
            }
        }
        return null;
    }

    // Sugerir tipos de relación para conexiones existentes sin tipo
    suggestRelationTypeUpgrade(sourceNode, targetNode, existingType = null) {
        const suggestions = [];
        
        // Analizar dominios
        const optimalType = this.getOptimalRelationType(
            sourceNode.domain, 
            targetNode.domain, 
            `${sourceNode.summary} ${targetNode.summary}`
        );
        
        suggestions.push({
            type: optimalType,
            confidence: 0.8,
            reason: `Óptimo para dominios ${sourceNode.domain} ↔ ${targetNode.domain}`
        });

        // Analizar contenido semántico
        const semanticSuggestions = this.analyzeSemanticRelations(sourceNode, targetNode);
        suggestions.push(...semanticSuggestions);

        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }

    // Análisis semántico básico para sugerir tipos de relación
    analyzeSemanticRelations(sourceNode, targetNode) {
        const suggestions = [];
        const sourceText = `${sourceNode.label} ${sourceNode.summary}`.toLowerCase();
        const targetText = `${targetNode.label} ${targetNode.summary}`.toLowerCase();
        
        // Detectar patrones causales
        if (sourceText.includes('causa') && targetText.includes('efecto')) {
            suggestions.push({
                type: 'CAUSA_DIRECTA',
                confidence: 0.9,
                reason: 'Patrón causa-efecto detectado'
            });
        }

        // Detectar patrones jerárquicos
        if (sourceText.includes('general') && targetText.includes('específico')) {
            suggestions.push({
                type: 'GENERALIZA',
                confidence: 0.8,
                reason: 'Relación general-específico detectada'
            });
        }

        // Detectar patrones analógicos
        if (sourceText.includes('similar') || targetText.includes('similar')) {
            suggestions.push({
                type: 'ANALOGIA_ESTRUCTURAL',
                confidence: 0.7,
                reason: 'Similitud estructural detectada'
            });
        }

        return suggestions;
    }

    // Generar esquema Cypher para crear constraints
    generateDatabaseConstraints() {
        const constraints = [];
        
        // Constraint para tipos de relación válidos
        const validTypes = [];
        for (const category of Object.values(this.relationshipHierarchy)) {
            validTypes.push(...Object.keys(category.subcategories));
        }
        
        constraints.push(`
            // Constraint para tipos de relación válidos
            CREATE CONSTRAINT valid_relation_types IF NOT EXISTS
            FOR ()-[r:RELATES]-() 
            REQUIRE r.type IN [${validTypes.map(t => `'${t}'`).join(', ')}]
        `);

        // Constraint para metadatos requeridos
        constraints.push(`
            // Constraint para metadatos de relación
            CREATE CONSTRAINT relation_metadata IF NOT EXISTS
            FOR ()-[r:RELATES]-() 
            REQUIRE r.category IS NOT NULL AND r.strength IS NOT NULL
        `);

        return constraints.join('\n\n');
    }
}

module.exports = RelationshipTypes;