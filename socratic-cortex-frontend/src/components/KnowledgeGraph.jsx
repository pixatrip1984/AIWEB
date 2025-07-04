// src/components/KnowledgeGraph.jsx (Versión Completa con Mejoras Visuales)

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './KnowledgeGraph.css';

const KnowledgeGraph = () => {
  // --- ESTADOS ---
  const [fullGraphData, setFullGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [domains, setDomains] = useState([]);
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [explanationsCache, setExplanationsCache] = useState({});
  const [currentLevel, setCurrentLevel] = useState(null);
  const fgRef = useRef();

  // --- LÓGICA DE DATOS Y EFECTOS ---

  // 1. Carga inicial de datos desde el backend
  useEffect(() => {
    const controller = new AbortController();
    axios.get('http://127.0.0.1:5000/api/graph', { signal: controller.signal })
      .then(response => {
        const data = { nodes: response.data.nodes, links: response.data.edges };
        setFullGraphData(data);
        const uniqueDomains = [...new Set(data.nodes.map(node => node.domain || 'Sin Dominio'))].sort();
        setDomains(uniqueDomains);
        setActiveFilters(new Set(uniqueDomains));
      })
      .catch(error => {
        if (error.name !== 'CanceledError') console.error("Error al obtener el grafo:", error);
      });
    return () => controller.abort();
  }, []);

  // 2. Filtrado y enriquecimiento del grafo (usando useMemo para eficiencia)
  const processedGraphData = useMemo(() => {
    // Primero, filtramos los nodos según los dominios activos
    const filteredNodes = fullGraphData.nodes.filter(node => activeFilters.has(node.domain || 'Sin Dominio'));
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    
    // Luego, filtramos los enlaces para que solo conecten nodos visibles
    const filteredLinks = fullGraphData.links.filter(link => 
        filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target)
    );

    // MEJORA VISUAL: Calculamos la "importancia" de cada nodo (número de conexiones)
    const nodeImportance = {};
    filteredLinks.forEach(link => {
        nodeImportance[link.source] = (nodeImportance[link.source] || 0) + 1;
        nodeImportance[link.target] = (nodeImportance[link.target] || 0) + 1;
    });

    // Añadimos el valor de la importancia a cada nodo para que la librería pueda usarlo
    const sizedNodes = filteredNodes.map(node => ({
        ...node,
        // El tamaño base es 4, y aumenta con la importancia. Máximo de 15.
        val: Math.min(4 + (nodeImportance[node.id] || 0) * 2, 15) 
    }));

    return { nodes: sizedNodes, links: filteredLinks };
  }, [fullGraphData, activeFilters]);

  // 3. Efecto para la búsqueda en tiempo real
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }
    const results = fullGraphData.nodes.filter(node =>
        node.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSearchResults(results);
  }, [searchTerm, fullGraphData.nodes]);

  // --- MANEJADORES DE EVENTOS ---
  
  const getExplanation = async (nodeId, level, forceRegenerate = false) => {
    setCurrentLevel(level);
    if (!forceRegenerate && explanationsCache[nodeId]?.[level]) return;
    setIsLoadingExplanation(true);
    try {
      const response = await axios.post(`http://127.0.0.1:5000/api/graph/nodes/${nodeId}/explain`, { level });
      setExplanationsCache(prev => ({
        ...prev,
        [nodeId]: { ...(prev[nodeId] || {}), [level]: response.data.explanation }
      }));
    } catch (error) {
      console.error("Error al obtener la explicación:", error);
    } finally {
      setIsLoadingExplanation(false);
    }
  };
  
  const handleNodeClick = useCallback(node => {
    if (node) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(2.5, 1000);
      setSelectedNode(node);
      setCurrentLevel(null);
    }
  }, [fgRef]);
  
  const centerOnNode = (nodeId) => {
    const node = fullGraphData.nodes.find(n => n.id === nodeId);
    if (node) handleNodeClick(node);
    setSearchTerm('');
    setSearchResults([]);
  };
  
  const handleFilterChange = (domain) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(domain)) newFilters.delete(domain);
      else newFilters.add(domain);
      return newFilters;
    });
  };
  
  // --- RENDERIZADO DEL COMPONENTE ---
  
  return (
    <div className="graph-container">
      <div className="ui-controls">
        <div className="search-container">
          <input type="text" placeholder="Buscar un concepto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          {searchResults.length > 0 && (
            <ul className="search-results">
              {searchResults.map(node => (
                <li key={node.id} onClick={() => centerOnNode(node.id)}>{node.label}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="filter-container">
          <h4>Dominios</h4>
          {domains.map(domain => (
            <div key={domain} className="filter-item">
              <input type="checkbox" id={domain} checked={activeFilters.has(domain)} onChange={() => handleFilterChange(domain)} />
              <label htmlFor={domain}>{domain}</label>
            </div>
          ))}
        </div>
      </div>
      
      <ForceGraph2D
        ref={fgRef}
        graphData={processedGraphData} // Usamos los datos procesados con tamaño
        nodeId="id"
        nodeLabel="label"
        nodeAutoColorBy="domain"
        onNodeClick={handleNodeClick}
        
        // --- MEJORAS VISUALES ---
        nodeVal="val" // Le dice a la librería que use la propiedad 'val' para el tamaño del nodo
        
        // Colorea el enlace según el tipo de relación
        linkColor={link => {
            const type = link.type?.toUpperCase();
            if (type?.includes('CRITICA')) return 'rgba(255, 100, 100, 0.8)';
            if (type?.includes('INFLUENCIA')) return 'rgba(100, 255, 100, 0.8)';
            if (type?.includes('EXPLICA')) return 'rgba(100, 100, 255, 0.8)';
            return 'rgba(255, 255, 255, 0.3)'; // Color por defecto
        }}
        
        // Grosor del enlace
        linkWidth={1}
        
        // Etiqueta del enlace
        linkLabel="label"
        
        // Propiedades de la flecha direccional
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.25}
        
        // Renderiza el texto de la etiqueta del nodo directamente sobre el grafo
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.label;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillText(label, node.x, node.y + node.val + 5); // Posiciona el texto debajo del nodo
        }}
        nodeCanvasObjectMode={() => 'after'} // Dibuja el texto después del nodo
      />
      
      {selectedNode && (
        <div className="explanation-panel">
          <button className="close-btn" onClick={() => setSelectedNode(null)}>X</button>
          <h2>{selectedNode.label}</h2>
          <p><em>Dominio: {selectedNode.domain}</em></p>
          <p><strong>Resumen:</strong> {selectedNode.summary}</p>
          <div className="explanation-controls">
            <span>Explicar para:</span>
            <button onClick={() => getExplanation(selectedNode.id, 'beginner')}>Principiante</button>
            <button onClick={() => getExplanation(selectedNode.id, 'intermediate')}>Intermedio</button>
            <button onClick={() => getExplanation(selectedNode.id, 'expert')}>Experto</button>
          </div>
          <div className="explanation-content">
            {isLoadingExplanation && <p>Generando explicación...</p>}
            {currentLevel && explanationsCache[selectedNode.id]?.[currentLevel] && (
              <>
                <ReactMarkdown>{explanationsCache[selectedNode.id][currentLevel]}</ReactMarkdown>
                <button className="regenerate-btn" onClick={() => getExplanation(selectedNode.id, currentLevel, true)} disabled={isLoadingExplanation}>Regenerar</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraph;