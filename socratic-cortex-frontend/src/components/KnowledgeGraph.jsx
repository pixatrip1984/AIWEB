// src/components/KnowledgeGraph.jsx (VERSIÓN FINAL COMPLETA CON NORMALIZACIÓN)

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import NormalizationPanel from './NormalizationPanel';
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
  const [showNormalizationPanel, setShowNormalizationPanel] = useState(false);
  const [isLoadingGraph, setIsLoadingGraph] = useState(true);
  const fgRef = useRef();

  // --- FUNCIONES DE CARGA DE DATOS ---

  // Función para cargar datos del grafo
  const loadGraphData = useCallback(async () => {
    setIsLoadingGraph(true);
    try {
      console.log('🔄 Cargando datos del grafo...');
      const response = await axios.get('http://127.0.0.1:5000/api/graph');
      const data = { nodes: response.data.nodes, links: response.data.edges };
      
      setFullGraphData(data);
      
      // Extraer dominios únicos y ordenarlos
      const uniqueDomains = [...new Set(data.nodes.map(node => node.domain || 'Sin Dominio'))].sort();
      setDomains(uniqueDomains);
      setActiveFilters(new Set(uniqueDomains));
      
      console.log(`✅ Grafo cargado: ${data.nodes.length} nodos, ${data.links.length} enlaces`);
      console.log(`📚 Dominios encontrados: ${uniqueDomains.join(', ')}`);
      
    } catch (error) {
      console.error('❌ Error al obtener el grafo:', error);
      // En caso de error, inicializar con datos vacíos
      setFullGraphData({ nodes: [], links: [] });
      setDomains([]);
      setActiveFilters(new Set());
    } finally {
      setIsLoadingGraph(false);
    }
  }, []);

  // --- EFECTOS ---

  // Carga inicial de datos
  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  // Filtrado y enriquecimiento del grafo (usando useMemo para eficiencia)
  const processedGraphData = useMemo(() => {
    if (fullGraphData.nodes.length === 0) {
      return { nodes: [], links: [] };
    }

    // Filtrar nodos según dominios activos
    const filteredNodes = fullGraphData.nodes.filter(node => 
      activeFilters.has(node.domain || 'Sin Dominio')
    );
    
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    
    // Filtrar enlaces para que solo conecten nodos visibles
    const filteredLinks = fullGraphData.links.filter(link => 
      filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target)
    );

    // Calcular importancia de cada nodo (número de conexiones)
    const nodeImportance = {};
    filteredLinks.forEach(link => {
      nodeImportance[link.source] = (nodeImportance[link.source] || 0) + 1;
      nodeImportance[link.target] = (nodeImportance[link.target] || 0) + 1;
    });

    // Enriquecer nodos con tamaño basado en importancia
    const sizedNodes = filteredNodes.map(node => ({
      ...node,
      val: Math.min(4 + (nodeImportance[node.id] || 0) * 2, 15)
    }));

    return { nodes: sizedNodes, links: filteredLinks };
  }, [fullGraphData, activeFilters]);

  // Búsqueda en tiempo real
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    const results = fullGraphData.nodes.filter(node =>
      node.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSearchResults(results.slice(0, 10)); // Limitar a 10 resultados
  }, [searchTerm, fullGraphData.nodes]);

  // --- MANEJADORES DE EVENTOS ---
  
  // Obtener explicación de un nodo
  const getExplanation = async (nodeId, level, forceRegenerate = false) => {
    setCurrentLevel(level);
    
    // Si ya tenemos la explicación en caché y no forzamos regeneración
    if (!forceRegenerate && explanationsCache[nodeId]?.[level]) {
      return;
    }
    
    setIsLoadingExplanation(true);
    try {
      console.log(`🤖 Generando explicación ${level} para: ${nodeId}`);
      const response = await axios.post(
        `http://127.0.0.1:5000/api/graph/explain/${nodeId}`, // RUTA CORREGIDA
        { level }
      );
      
      setExplanationsCache(prev => ({
        ...prev,
        [nodeId]: { 
          ...(prev[nodeId] || {}), 
          [level]: response.data.explanation 
        }
      }));
      
      console.log('✅ Explicación generada exitosamente');
    } catch (error) {
      console.error('❌ Error al obtener la explicación:', error);
    } finally {
      setIsLoadingExplanation(false);
    }
  };
  
  // Manejar click en nodo
  const handleNodeClick = useCallback(node => {
    if (node && fgRef.current) {
      console.log(`🎯 Nodo seleccionado: ${node.label} [${node.id}]`);
      
      // Centrar y hacer zoom al nodo
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(2.5, 1000);
      
      // Actualizar estado
      setSelectedNode(node);
      setCurrentLevel(null);
    }
  }, []);
  
  // Centrar en un nodo específico desde la búsqueda
  const centerOnNode = (nodeId) => {
    const node = fullGraphData.nodes.find(n => n.id === nodeId);
    if (node) {
      handleNodeClick(node);
      setSearchTerm('');
      setSearchResults([]);
    }
  };
  
  // Manejar cambio de filtros
  const handleFilterChange = (domain) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(domain)) {
        newFilters.delete(domain);
      } else {
        newFilters.add(domain);
      }
      console.log(`🔍 Filtro ${domain}: ${newFilters.has(domain) ? 'activado' : 'desactivado'}`);
      return newFilters;
    });
  };

  // Manejar cierre del panel de normalización
  const handleNormalizationPanelClose = () => {
    setShowNormalizationPanel(false);
  };

  // Manejar cuando se completa la normalización
  const handleNormalizationComplete = () => {
    console.log('🔄 Normalización completada, recargando grafo...');
    loadGraphData(); // Recargar datos del grafo
    setShowNormalizationPanel(false);
  };
  
  // --- RENDERIZADO DEL COMPONENTE ---
  
  return (
    <div className="graph-container">
      {/* Controles de UI en la parte superior izquierda */}
      <div className="ui-controls">
        {/* Barra de búsqueda */}
        <div className="search-container">
          <input 
            type="text" 
            placeholder="Buscar un concepto..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            disabled={isLoadingGraph}
          />
          {searchResults.length > 0 && (
            <ul className="search-results">
              {searchResults.map(node => (
                <li key={node.id} onClick={() => centerOnNode(node.id)}>
                  <strong>{node.label}</strong>
                  <span className="search-domain">{node.domain}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Panel de filtros */}
        <div className="filter-container">
          <h4>Dominios ({domains.length})</h4>
          {domains.map(domain => (
            <div key={domain} className="filter-item">
              <input 
                type="checkbox" 
                id={`domain-${domain}`}
                checked={activeFilters.has(domain)} 
                onChange={() => handleFilterChange(domain)}
                disabled={isLoadingGraph}
              />
              <label htmlFor={`domain-${domain}`}>{domain}</label>
            </div>
          ))}
          
          {/* Botón de normalización */}
          <button 
            className="normalization-btn"
            onClick={() => setShowNormalizationPanel(true)}
            disabled={isLoadingGraph}
            title="Abrir panel de normalización del conocimiento"
          >
            🧠 Normalizar Grafo
          </button>
        </div>
      </div>

      {/* Indicador de carga */}
      {isLoadingGraph && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Cargando grafo del conocimiento...</p>
          </div>
        </div>
      )}
      
      {/* Grafo principal */}
      <ForceGraph2D
        ref={fgRef}
        graphData={processedGraphData}
        nodeId="id"
        nodeLabel="label"
        nodeAutoColorBy="domain"
        onNodeClick={handleNodeClick}
        
        // Configuración visual avanzada
        nodeVal="val"
        
        // Colorear enlaces según tipo de relación
        linkColor={link => {
          const type = link.type?.toUpperCase();
          if (type?.includes('CRITICA')) return 'rgba(255, 100, 100, 0.8)';
          if (type?.includes('INFLUENCIA')) return 'rgba(100, 255, 100, 0.8)';
          if (type?.includes('EXPLICA')) return 'rgba(100, 100, 255, 0.8)';
          return 'rgba(255, 255, 255, 0.3)';
        }}
        
        linkWidth={1}
        linkLabel="label"
        
        // Flechas direccionales
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.25}
        
        // Renderizado personalizado de etiquetas
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.label;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillText(label, node.x, node.y + node.val + 5);
        }}
        nodeCanvasObjectMode={() => 'after'}
        
        // Configuración de física
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        cooldownTicks={100}
        warmupTicks={50}
      />
      
      {/* Panel de explicación del nodo seleccionado */}
      {selectedNode && (
        <div className="explanation-panel">
          <button 
            className="close-btn" 
            onClick={() => setSelectedNode(null)}
            title="Cerrar panel"
          >
            ×
          </button>
          
          <h2>{selectedNode.label}</h2>
          <p><em>Dominio: {selectedNode.domain || 'Sin Dominio'}</em></p>
          <p><strong>Resumen:</strong> {selectedNode.summary || 'Sin resumen disponible'}</p>
          
          <div className="explanation-controls">
            <span>Explicar para:</span>
            <button 
              onClick={() => getExplanation(selectedNode.id, 'beginner')}
              disabled={isLoadingExplanation}
            >
              Principiante
            </button>
            <button 
              onClick={() => getExplanation(selectedNode.id, 'intermediate')}
              disabled={isLoadingExplanation}
            >
              Intermedio
            </button>
            <button 
              onClick={() => getExplanation(selectedNode.id, 'expert')}
              disabled={isLoadingExplanation}
            >
              Experto
            </button>
          </div>
          
          <div className="explanation-content">
            {isLoadingExplanation && (
              <div className="loading-explanation">
                <div className="spinner-small"></div>
                <p>Generando explicación...</p>
              </div>
            )}
            
            {currentLevel && explanationsCache[selectedNode.id]?.[currentLevel] && (
              <>
                <ReactMarkdown>
                  {explanationsCache[selectedNode.id][currentLevel]}
                </ReactMarkdown>
                <button 
                  className="regenerate-btn" 
                  onClick={() => getExplanation(selectedNode.id, currentLevel, true)} 
                  disabled={isLoadingExplanation}
                >
                  🔄 Regenerar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Panel de normalización */}
      {showNormalizationPanel && (
        <NormalizationPanel 
          isOpen={showNormalizationPanel}
          onClose={handleNormalizationPanelClose}
          onNormalizationComplete={handleNormalizationComplete}
        />
      )}
    </div>
  );
};

export default KnowledgeGraph;