// socratic-cortex-backend/src/services/knowledgeNormalizer.js

class KnowledgeNormalizer {
    constructor() {
        // Diccionario de términos equivalentes
        this.conceptEquivalents = new Map([
            // Filosofía - equivalencias
            ['ideas_platonicas', 'teoria-de-las-formas'],
            ['el_motor_inmovil', 'motor_inmovible'],
            ['alegoria_de_la_caverna', 'allegory_of_the_cave'],
            
            // Dominios estandarizados
            ['philosophy', 'filosofia'],
            ['ancient_philosophy', 'filosofia_antigua'],
            ['metaphysics', 'metafisica'],
            ['platonic_metaphysics', 'metafisica_platonica']
        ]);

        // Jerarquía de dominios estandarizada
        this.domainHierarchy = {
            'Filosofía': {
                subdomains: [
                    'Filosofía Antigua',
                    'Filosofía Medieval', 
                    'Filosofía Moderna',
                    'Filosofía Contemporánea'
                ]
            },
            'Metafísica': {
                parent: 'Filosofía',
                subdomains: [
                    'Ontología',
                    'Cosmología',
                    'Teología Natural'
                ]
            },
            'Matemáticas': {
                subdomains: [
                    'Álgebra',
                    'Geometría',
                    'Análisis',
                    'Lógica Matemática'
                ]
            },
            'Física': {
                subdomains: [
                    'Mecánica Clásica',
                    'Mecánica Cuántica',
                    'Relatividad',
                    'Termodinámica'
                ]
            },
            'Teología': {
                subdomains: [
                    'Teología Natural',
                    'Teología Revelada',
                    'Filosofía de la Religión'
                ]
            }
        };

        // Patrones de normalización de IDs
        this.idPatterns = {
            // Convertir espacios y caracteres especiales
            normalize: (text) => {
                return text
                    .toLowerCase()
                    .replace(/\s+/g, '-')
                    .replace(/[áàäâ]/g, 'a')
                    .replace(/[éèëê]/g, 'e')
                    .replace(/[íìïî]/g, 'i')
                    .replace(/[óòöô]/g, 'o')
                    .replace(/[úùüû]/g, 'u')
                    .replace(/[ñ]/g, 'n')
                    .replace(/[^a-z0-9\-]/g, '')
                    .replace(/\-+/g, '-')
                    .replace(/^\-|\-$/g, '');
            }
        };
    }

    // Detectar duplicados conceptuales
    detectDuplicates(nodes) {
        const duplicateGroups = [];
        const processed = new Set();

        for (const node of nodes) {
            if (processed.has(node.id)) continue;

            const duplicates = [node];
            processed.add(node.id);

            // Buscar por equivalencias exactas
            const canonical = this.conceptEquivalents.get(node.id);
            if (canonical) {
                const canonicalNode = nodes.find(n => n.id === canonical);
                if (canonicalNode && !processed.has(canonical)) {
                    duplicates.push(canonicalNode);
                    processed.add(canonical);
                }
            }

            // Buscar por similitud de nombres
            for (const otherNode of nodes) {
                if (processed.has(otherNode.id)) continue;
                
                if (this.areSimilarConcepts(node, otherNode)) {
                    duplicates.push(otherNode);
                    processed.add(otherNode.id);
                }
            }

            if (duplicates.length > 1) {
                duplicateGroups.push(duplicates);
            }
        }

        return duplicateGroups;
    }

    // Determinar si dos conceptos son similares
    areSimilarConcepts(node1, node2) {
        // Normalizar labels para comparación
        const label1 = this.normalizeLabel(node1.label);
        const label2 = this.normalizeLabel(node2.label);

        // Similitud exacta después de normalización
        if (label1 === label2) return true;

        // Similitud de Levenshtein (85% o más)
        const similarity = this.calculateSimilarity(label1, label2);
        if (similarity >= 0.85) return true;

        // Verificar si uno contiene al otro (para casos como "ideas platónicas" vs "teoría de las formas")
        const words1 = label1.split(' ');
        const words2 = label2.split(' ');
        const commonWords = words1.filter(word => words2.includes(word));
        
        return commonWords.length >= Math.min(words1.length, words2.length) * 0.7;
    }

    // Normalizar etiquetas para comparación
    normalizeLabel(label) {
        return label
            .toLowerCase()
            .replace(/[áàäâ]/g, 'a')
            .replace(/[éèëê]/g, 'e')
            .replace(/[íìïî]/g, 'i')
            .replace(/[óòöô]/g, 'o')
            .replace(/[úùüû]/g, 'u')
            .replace(/[ñ]/g, 'n')
            .replace(/[^a-z0-9\s]/g, '')
            .trim();
    }

    // Calcular similitud de Levenshtein
    calculateSimilarity(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));

        for (let i = 0; i <= len1; i++) matrix[i][0] = i;
        for (let j = 0; j <= len2; j++) matrix[0][j] = j;

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,     // deletion
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }

        const maxLen = Math.max(len1, len2);
        return maxLen === 0 ? 1 : (maxLen - matrix[len1][len2]) / maxLen;
    }

    // Fusionar nodos duplicados
    mergeNodes(duplicateGroup) {
        // Seleccionar el nodo principal (más completo o con mejor ID)
        const primaryNode = this.selectPrimaryNode(duplicateGroup);
        
        // Combinar información de todos los nodos
        const mergedNode = {
            id: primaryNode.id,
            label: this.selectBestLabel(duplicateGroup),
            domain: this.normalizeDomain(primaryNode.domain),
            summary: this.combineSummaries(duplicateGroup),
            type: primaryNode.type,
            // Metadatos sobre la fusión
            mergedFrom: duplicateGroup.filter(n => n.id !== primaryNode.id).map(n => n.id),
            confidence: this.calculateMergeConfidence(duplicateGroup)
        };

        return mergedNode;
    }

    // Seleccionar el nodo primario de un grupo de duplicados
    selectPrimaryNode(nodes) {
        // Priorizar por completitud de información
        return nodes.reduce((best, current) => {
            const bestScore = this.scoreNodeCompleteness(best);
            const currentScore = this.scoreNodeCompleteness(current);
            return currentScore > bestScore ? current : best;
        });
    }

    // Puntuar completitud de un nodo
    scoreNodeCompleteness(node) {
        let score = 0;
        if (node.summary && node.summary.length > 50) score += 3;
        if (node.domain && node.domain !== 'Sin Dominio') score += 2;
        if (node.label && node.label.length > 5) score += 1;
        if (this.idPatterns.normalize(node.label) === node.id) score += 2; // ID consistente
        return score;
    }

    // Seleccionar la mejor etiqueta
    selectBestLabel(nodes) {
        // Priorizar etiquetas en español si están disponibles
        const spanishLabels = nodes.filter(n => this.isSpanish(n.label));
        if (spanishLabels.length > 0) {
            return spanishLabels.reduce((best, current) => 
                current.label.length > best.label.length ? current : best
            ).label;
        }
        
        // Si no hay español, tomar la más descriptiva
        return nodes.reduce((best, current) => 
            current.label.length > best.label.length ? current : best
        ).label;
    }

    // Detectar si un texto está en español
    isSpanish(text) {
        const spanishIndicators = /[áéíóúñü]|de la|de los|que el|es una|del /i;
        return spanishIndicators.test(text);
    }

    // Combinar resúmenes
    combineSummaries(nodes) {
        const summaries = nodes.filter(n => n.summary && n.summary.length > 20);
        if (summaries.length === 0) return '';
        
        // Tomar el resumen más completo, o combinar si son complementarios
        const longest = summaries.reduce((best, current) => 
            current.summary.length > best.summary.length ? current : best
        );
        
        return longest.summary;
    }

    // Normalizar dominio
    normalizeDomain(domain) {
        if (!domain || domain === 'Sin Dominio') return 'Sin Dominio';
        
        // Mapear dominios en inglés a español
        const domainMap = {
            'Philosophy': 'Filosofía',
            'Ancient Philosophy': 'Filosofía Antigua',
            'Literary Philosophy': 'Filosofía Literaria',
            'Metaphysics': 'Metafísica',
            'Platonic Metaphysics': 'Metafísica Platónica'
        };
        
        return domainMap[domain] || domain;
    }

    // Calcular confianza de la fusión
    calculateMergeConfidence(nodes) {
        if (nodes.length <= 1) return 1.0;
        
        // Base en similitud promedio de etiquetas
        let totalSimilarity = 0;
        let comparisons = 0;
        
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                totalSimilarity += this.calculateSimilarity(
                    this.normalizeLabel(nodes[i].label),
                    this.normalizeLabel(nodes[j].label)
                );
                comparisons++;
            }
        }
        
        return comparisons > 0 ? totalSimilarity / comparisons : 0.5;
    }

    // Generar reporte de normalización
    generateNormalizationReport(duplicateGroups, mergedNodes) {
        return {
            timestamp: new Date().toISOString(),
            duplicatesFound: duplicateGroups.length,
            nodesProcessed: duplicateGroups.reduce((sum, group) => sum + group.length, 0),
            mergedNodes: mergedNodes.length,
            confidence: mergedNodes.reduce((sum, node) => sum + node.confidence, 0) / mergedNodes.length,
            details: duplicateGroups.map(group => ({
                originalNodes: group.map(n => ({ id: n.id, label: n.label })),
                mergedInto: this.selectPrimaryNode(group).id,
                confidence: this.calculateMergeConfidence(group)
            }))
        };
    }
}

module.exports = KnowledgeNormalizer;