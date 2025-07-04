// socratic-cortex-frontend/src/components/KnowledgeGraph.jsx
// VERSIÓN ACTUALIZADA CON PANELES DE FASE 1.2

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import NormalizationPanel from './NormalizationPanel';
import AdvancedSearchPanel from './AdvancedSearchPanel';
import KnowledgeIngestPanel from './KnowledgeIngestPanel';
import './KnowledgeGraph.css';

const KnowledgeGraph = () => {
  // --- ESTADOS EXISTENTES ---
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

  // --- NUEVOS ESTADOS PARA FASE 1.2 ---
  const [showDomainsPanel, setShowDomainsPanel] = useState(true);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(true);
  const [showIngestPanel, setShowIngestPanel] = useState(true);
  const [highlightedConnections, setHighlightedConnections] = useState([]);

  // --- FUNCIONES EXISTENTES ---
  const loadGraphData = useCallback(async () => {
    setIsLoadingGraph(true);
    try {
      console.log('🔄 Cargando datos del grafo...');
      const response = await axios.get('http://127.0.0.1:5000/api/graph');
      const data = { nodes: response.data.nodes, links: response.data.edges };
      
      setFullGraphData(data);
      
      const uniqueDomains = [...new Set(data.nodes.map(node => node.domain || 'Sin Dominio'))].sort();
      setDomains(uniqueDomains);
      setActiveFilters(new Set(uniqueDomains));
      
      console.log(`✅ Grafo cargado: ${data.nodes.length} nodos, ${data.links.length} enlaces`);
      
    } catch (error) {
      console.error('❌ Error al obtener el grafo:', error);
      setFullGraphData({ nodes: [], links: [] });
      setDomains([]);
      setActiveFilters(new Set());
    } finally {
      setIsLoadingGraph(false);
    }
  }, []);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  const processedGraphData = useMemo(() => {
    if (fullGraphData.nodes.length === 0) {
      return { nodes: [], links: [] };
    }

    const filteredNodes = fullGraphData.nodes.filter(node => 
      activeFilters.has(node.domain || 'Sin Dominio')
    );
    
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    
    let filteredLinks = fullGraphData.links.filter(link => 
      filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target)
    );

    // Destacar conexiones de búsqueda avanzada
    if (highlightedConnections.length > 0) {
      const highlightedIds = new Set(
        highlightedConnections.map(conn => `${conn.source.id}-${conn.target.id}`)
      );
      
      filteredLinks = filteredLinks.map(link => ({
        ...link,
        highlighted: highlightedIds.has(`${link.source}-${link.target}`)
      }));
    }

    const nodeImportance = {};
    filteredLinks.forEach(link => {
      nodeImportance[link.source] = (nodeImportance[link.source] || 0) + 1;
      nodeImportance[link.target] = (nodeImportance[link.target] || 0) + 1;
    });

    const sizedNodes = filteredNodes.map(node => ({
      ...node,
      val: Math.min(4 + (nodeImportance[node.id] || 0) * 2, 15)
    }));

    return { nodes: sizedNodes, links: filteredLinks };
  }, [fullGraphData, activeFilters, highlightedConnections]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    const results = fullGraphData.nodes.filter(node =>
      node.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSearchResults(results.slice(0, 10));
  }, [searchTerm, fullGraphData.nodes]);

  // --- MANEJADORES EXISTENTES ---
  const getExplanation = async (nodeId, level, forceRegenerate = false) => {
    setCurrentLevel(level);
    
    if (!forceRegenerate && explanationsCache[nodeId]?.[level]) {
      return;
    }
    
    setIsLoadingExplanation(true);
    try {
      const response = await axios.post(
        `http://127.0.0.1:5000/api/graph/explain/${nodeId}`,
        { level }
      );
      
      setExplanationsCache(prev => ({
        ...prev,
        [nodeId]: { 
          ...(prev[nodeId] || {}), 
          [level]: response.data.explanation 
        }
      }));
      
    } catch (error) {
      console.error('❌ Error al obtener la explicación:', error);
    } finally {
      setIsLoadingExplanation(false);
    }
  };
  
  const handleNodeClick = useCallback(node => {
    if (node && fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(2.5, 1000);
      setSelectedNode(node);
      setCurrentLevel(null);
    }
  }, []);
  
  const centerOnNode = (nodeId) => {
    const node = fullGraphData.nodes.find(n => n.id === nodeId);
    if (node) {
      handleNodeClick(node);
      setSearchTerm('');
      setSearchResults([]);
    }
  };
  
  const handleFilterChange = (domain) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(domain)) {
        newFilters.delete(domain);
      } else {
        newFilters.add(domain);
      }
      return newFilters;
    });
  };

  // --- NUEVOS MANEJADORES PARA FASE 1.2 ---
  const handleConnectionsFound = (connections) => {
    setHighlightedConnections(connections);
    console.log(`🔍 Destacando ${connections.length} conexiones encontradas`);
  };

  const handleKnowledgeAdded = (result) => {
    console.log('📝 Conocimiento agregado, recargando grafo...');
    loadGraphData(); // Recargar el grafo
    
    // Opcionalmente centrar en el nuevo nodo
    if (result.graph && result.graph.primaryNode) {
      setTimeout(() => {
        centerOnNode(result.graph.primaryNode.id);
      }, 1000);
    }
  };

  const handleNormalizationComplete = () => {
    loadGraphData();
    setShowNormalizationPanel(false);
  };

  // Toggle panels
  const toggleDomainsPanel = () => setShowDomainsPanel(!showDomainsPanel);
  const toggleAdvancedSearch = () => setShowAdvancedSearch(!showAdvancedSearch);
  const toggleIngestPanel = () => setShowIngestPanel(!showIngestPanel);

  return (
    <div className="graph-container">
      {/* Controles de UI en la parte superior izquierda */}
      <div className="ui-controls">
        {/* Controles de paneles */}
        <div className="panel-controls">
          <button 
            className={`panel-toggle ${showDomainsPanel ? 'active' : ''}`}
            onClick={toggleDomainsPanel}
            title="Mostrar/Ocultar panel de dominios"
          >
            📚 Dominios
          </button>
          <button 
            className={`panel-toggle ${showAdvancedSearch ? 'active' : ''}`}
            onClick={toggleAdvancedSearch}
            title="Mostrar/Ocultar búsqueda avanzada"
          >
            🔍 Avanzada
          </button>
          <button 
            className={`panel-toggle ${showIngestPanel ? 'active' : ''}`}
            onClick={toggleIngestPanel}
            title="Mostrar/Ocultar panel de ingesta"
          >
            📝 Agregar
          </button>
        </div>

        {/* Barra de búsqueda básica */}
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

        {/* Panel de filtros por dominios */}
        {showDomainsPanel && (
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
            
            <button 
              className="normalization-btn"
              onClick={() => setShowNormalizationPanel(true)}
              disabled={isLoadingGraph}
              title="Abrir panel de normalización del conocimiento"
            >
              🧠 Normalizar Grafo
            </button>
          </div>
        )}
      </div>

      {/* Paneles de Fase 1.2 en la parte derecha */}
      <div className="enhanced-panels">
        {/* Panel de Búsqueda Avanzada */}
        <AdvancedSearchPanel 
          isVisible={showAdvancedSearch}
          onConnectionsFound={handleConnectionsFound}
          onToggle={toggleAdvancedSearch}
        />

        {/* Panel de Ingesta de Conocimiento */}
        <KnowledgeIngestPanel 
          isVisible={showIngestPanel}
          onKnowledgeAdded={handleKnowledgeAdded}
          onToggle={toggleIngestPanel}
        />
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
        
        nodeVal="val"
        
        // Enlaces con destacado mejorado
        linkColor={link => {
          // Conexiones destacadas de búsqueda avanzada
          if (link.highlighted) {
            return 'rgba(0, 209, 255, 0.9)';
          }
          
          // Colores por tipo de relación
          const type = link.type?.toUpperCase();
          if (type?.includes('CRITICA')) return 'rgba(255, 100, 100, 0.8)';
          if (type?.includes('INFLUENCIA')) return 'rgba(100, 255, 100, 0.8)';
          if (type?.includes('EXPLICA')) return 'rgba(100, 100, 255, 0.8)';
          return 'rgba(255, 255, 255, 0.3)';
        }}
        
        linkWidth={link => link.highlighted ? 3 : 1}
        linkLabel="label"
        
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
          onClose={() => setShowNormalizationPanel(false)}
          onNormalizationComplete={handleNormalizationComplete}
        />
      )}
    </div>
  );
};

export default KnowledgeGraph;