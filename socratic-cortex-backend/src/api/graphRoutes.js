// src/api/graphRoutes.js (VERSIÓN CORREGIDA PARA EXPRESS 5)

const express = require('express');
const router = express.Router();
const { driver } = require('../db/neo4j');
const OpenAI = require('openai');

// --- CONFIGURACIÓN DEL CLIENTE DE IA ---
const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Socratic Cortex",
    },
});

// ===================================================
// === ENDPOINT 1: "EL CARTÓGRAFO" (INGESTA)      ===
// ===================================================
router.post('/ingest', async (req, res) => {
    const session = driver.session();
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'El campo "text" es requerido.' });

    try {
        const systemPrompt = `
            Tu rol es "El Cartógrafo de Ideas". Analiza el siguiente texto y extráelo en un formato JSON estructurado.
            El JSON debe tener dos claves principales: "primaryNode" y "edges".

            1.  "primaryNode": Representa la idea o entidad principal del texto. Debe tener: "id", "label", "type", "domain", "summary".
            2.  "edges": Un array de objetos, donde cada objeto representa una relación del nodo primario con otros nodos. Cada objeto de relación debe tener: "targetNode" (con id, label, type, domain, summary) y "relationship" (ej. 'INFLUENCIA_A', 'CRITICA_A').
            
            RESPONDE ÚNICAMENTE CON EL OBJETO JSON VÁLIDO. NO INCLUYAS TEXTO ADICIONAL.`;

        const aiResponse = await openrouter.chat.completions.create({ 
            model: "deepseek/deepseek-r1-0528-qwen3-8b:free", 
            messages: [
                { role: "system", content: systemPrompt }, 
                { role: "user", content: text }
            ] 
        });
        
        const resultJson = JSON.parse(aiResponse.choices[0].message.content);
        
        const { primaryNode, edges } = resultJson;
        const query = `
            MERGE (p:KnowledgeNode {id: $primaryNode.id})
            SET p.label = $primaryNode.label, p.type = $primaryNode.type, p.domain = $primaryNode.domain, p.summary = $primaryNode.summary
            WITH p
            UNWIND $edges AS edge
            MERGE (t:KnowledgeNode {id: edge.targetNode.id})
            SET t.label = edge.targetNode.label, t.type = edge.targetNode.type, t.domain = edge.targetNode.domain, t.summary = edge.targetNode.summary
            MERGE (p)-[r:RELATES]->(t)
            SET r.type = edge.relationship, r.label = edge.relationship, r.source = p.id, r.target = t.id`;
            
        await session.run(query, { primaryNode, edges });
        res.status(200).json({ success: true, message: 'Conocimiento ingerido.', graph: resultJson });
    } catch (error) {
        console.error('Error en ingesta:', error);
        res.status(500).json({ error: 'Error interno.' });
    } finally {
        await session.close();
    }
});

// ===================================================
// === ENDPOINT 2: OBTENER GRAFO COMPLETO         ===
// ===================================================
router.get('/', async (req, res) => {
    const session = driver.session();
    try {
        const nodesResult = await session.run('MATCH (n:KnowledgeNode) RETURN n');
        const nodes = nodesResult.records.map(record => record.get('n').properties);

        const relsResult = await session.run('MATCH ()-[r:RELATES]->() RETURN r');
        const edges = relsResult.records.map(record => record.get('r').properties);

        res.json({ nodes, edges });
    } catch (error) {
        console.error('Error al obtener el grafo:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        await session.close();
    }
});

// ===================================================
// === ENDPOINT 3: "EL PROFESOR" (EXPLICACIÓN)    ===
// === RUTA CORREGIDA PARA EXPRESS 5              ===
// ===================================================
router.post('/explain/:nodeId', async (req, res) => {  // CAMBIADO: /nodes/:id/explain → /explain/:nodeId
    const session = driver.session();
    const { nodeId } = req.params;  // CAMBIADO: id → nodeId
    const { level } = req.body;
    
    if (!level) {
        return res.status(400).json({ error: 'El campo "level" es requerido.' });
    }

    try {
        const contextQuery = `
            MATCH (n:KnowledgeNode {id: $nodeId}) 
            OPTIONAL MATCH (n)-[r:RELATES]-(m:KnowledgeNode) 
            RETURN n, collect({relation: r, neighbor: m}) as context
        `;
        
        const result = await session.run(contextQuery, { nodeId });

        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Nodo no encontrado.' });
        }
        
        const record = result.records[0];
        const mainNode = record.get('n').properties;
        const contextList = record.get('context');
        
        let contextSummary = 'No tiene relaciones conocidas.';
        // Asegurarse de que el contexto no esté vacío y el primer elemento tenga una relación
        if (contextList && contextList.length > 0 && contextList[0].relation) {
             contextSummary = contextList.map(item => 
                `- Tiene una relación '${item.relation.properties.type}' con '${item.neighbor.properties.label}'`
             ).join('\n');
        }

        const systemPrompt = `
            Tu rol es "El Profesor", un experto en ${mainNode.domain}.
            Explica el concepto "${mainNode.label}" (cuyo resumen es: ${mainNode.summary}) de forma clara para un nivel de audiencia "${level}".
            Contexto de sus relaciones en el grafo del conocimiento:
            ${contextSummary}
            
            Instrucciones:
            - Genera una explicación en formato Markdown.
            - Si el nivel es "beginner", usa analogías.
            - Si el nivel es "expert", usa terminología técnica.
            - No digas que eres una IA.`;

        const aiResponse = await openrouter.chat.completions.create({ 
            model: "deepseek/deepseek-r1-0528-qwen3-8b:free", 
            messages: [
                { role: "system", content: systemPrompt }, 
                { role: "user", content: `Explícame "${mainNode.label}".` }
            ] 
        });
        
        const explanation = aiResponse.choices[0].message.content;
        
        res.json({ explanation });
    } catch (error) {
        console.error('Error al generar la explicación:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        await session.close();
    }
});

module.exports = router;