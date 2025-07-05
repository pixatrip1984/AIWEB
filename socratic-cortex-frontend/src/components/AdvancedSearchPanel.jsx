// socratic-cortex-frontend/src/components/AdvancedSearchPanel.jsx
// Panel de búsqueda avanzada con funcionalidades de Fase 1.2

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdvancedSearchPanel.css';

const AdvancedSearchPanel = ({ isVisible, onConnectionsFound, onToggle }) => {
  // Estados del panel
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [metadataReport, setMetadataReport] = useState(null);
  
  // Estados de filtros
  const [filters, setFilters] = useState({
    category: '',
    epistemicLevel: '',
    minStrength: 50,
    minUniversality: 0,
    domainBridge: false,
    limit: 10
  });

  // Opciones disponibles
  const categories = [
    { value: '', label: 'Todas las categorías' },
    { value: 'similarity', label: 'Similitud' },
    { value: 'causality', label: 'Causalidad' },
    { value: 'hierarchy', label: 'Jerarquía' },
    { value: 'knowledge', label: 'Epistémica' },
    { value: 'temporality', label: 'Temporal' },
    { value: 'transcendence', label: 'Trascendental' }
  ];

  const epistemicLevels = [
    { value: '', label: 'Todos los niveles' },
    { value: 'empirical', label: 'Empírico' },
    { value: 'theoretical', label: 'Teórico' },
    { value: 'conceptual', label: 'Conceptual' },
    { value: 'metaphysical', label: 'Metafísico' },
    { value: 'transcendental', label: 'Trascendental' }
  ];

  // Cargar reporte de metadatos al abrir
  useEffect(() => {
    if (isExpanded && !metadataReport) {
      loadMetadataReport();
    }
  }, [isExpanded]);

  // Cargar reporte de metadatos
  const loadMetadataReport = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/enhanced/metadata-report');
      if (response.data.success) {
        setMetadataReport(response.data);
      }
    } catch (error) {
      console.error('❌ Error cargando reporte de metadatos:', error);
    }
  };

  // Ejecutar búsqueda avanzada
  const executeAdvancedSearch = async () => {
    setIsLoading(true);
    try {
      // Construir parámetros de búsqueda
      const params = new URLSearchParams();
      
      if (filters.category) params.append('category', filters.category);
      if (filters.epistemicLevel) params.append('epistemicLevel', filters.epistemicLevel);
      if (filters.minStrength > 0) params.append('minStrength', filters.minStrength / 100);
      if (filters.minUniversality > 0) params.append('minUniversality', filters.minUniversality / 100);
      if (filters.domainBridge) params.append('domainBridge', 'true');
      params.append('limit', filters.limit);

      console.log('🔍 Ejecutando búsqueda avanzada:', params.toString());

      const response = await axios.get(`http://127.0.0.1:5000/api/enhanced/search-by-metadata?${params}`);
      
      if (response.data.success) {
        setSearchResults(response.data.connections);
        onConnectionsFound(response.data.connections);
        console.log(`✅ Encontradas ${response.data.connections.length} conexiones`);
      }
    } catch (error) {
      console.error('❌ Error en búsqueda avanzada:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar cambios en filtros
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Limpiar filtros
  const clearFilters = () => {
    setFilters({
      category: '',
      epistemicLevel: '',
      minStrength: 50,
      minUniversality: 0,
      domainBridge: false,
      limit: 10
    });
    setSearchResults([]);
  };

  if (!isVisible) return null;

  return (
    <div className={`advanced-search-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Header del panel */}
      <div className="panel-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-content">
          <span className="panel-icon">🔍</span>
          <span className="panel-title">Búsqueda Avanzada</span>
          <span className="results-count">
            {searchResults.length > 0 && `(${searchResults.length} resultados)`}
          </span>
        </div>
        <button className="expand-btn" title={isExpanded ? 'Colapsar' : 'Expandir'}>
          {isExpanded ? '⬆️' : '⬇️'}
        </button>
      </div>

      {/* Contenido expandido */}
      {isExpanded && (
        <div className="panel-content">
          {/* Resumen de metadatos */}
          {metadataReport && (
            <div className="metadata-summary">
              <h4>📊 Estado del Grafo</h4>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="label">Categorías:</span>
                  <span className="value">{metadataReport.summary.totalCategories}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Niveles:</span>
                  <span className="value">{metadataReport.summary.totalEpistemicLevels}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Puentes:</span>
                  <span className="value">{metadataReport.summary.totalDomainBridges}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Dominante:</span>
                  <span className="value">{metadataReport.summary.mostConnectedCategory}</span>
                </div>
              </div>
            </div>
          )}

          {/* Filtros de búsqueda */}
          <div className="search-filters">
            <h4>🎛️ Filtros de Búsqueda</h4>
            
            {/* Categoría de relación */}
            <div className="filter-group">
              <label>Categoría de Relación:</label>
              <select 
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Nivel epistémico */}
            <div className="filter-group">
              <label>Nivel Epistémico:</label>
              <select 
                value={filters.epistemicLevel}
                onChange={(e) => handleFilterChange('epistemicLevel', e.target.value)}
              >
                {epistemicLevels.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Fuerza mínima */}
            <div className="filter-group">
              <label>Fuerza Mínima: {filters.minStrength}%</label>
              <input 
                type="range"
                min="0"
                max="100"
                value={filters.minStrength}
                onChange={(e) => handleFilterChange('minStrength', parseInt(e.target.value))}
                className="slider"
              />
            </div>

            {/* Universalidad mínima */}
            <div className="filter-group">
              <label>Universalidad Mínima: {filters.minUniversality}%</label>
              <input 
                type="range"
                min="0"
                max="100"
                value={filters.minUniversality}
                onChange={(e) => handleFilterChange('minUniversality', parseInt(e.target.value))}
                className="slider"
              />
            </div>

            {/* Solo puentes entre dominios */}
            <div className="filter-group checkbox-group">
              <label>
                <input 
                  type="checkbox"
                  checked={filters.domainBridge}
                  onChange={(e) => handleFilterChange('domainBridge', e.target.checked)}
                />
                Solo puentes interdisciplinarios
              </label>
            </div>

            {/* Límite de resultados */}
            <div className="filter-group">
              <label>Límite de resultados:</label>
              <select 
                value={filters.limit}
                onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
              >
                <option value={5}>5 resultados</option>
                <option value={10}>10 resultados</option>
                <option value={20}>20 resultados</option>
                <option value={50}>50 resultados</option>
              </select>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="action-buttons">
            <button 
              className="search-btn primary"
              onClick={executeAdvancedSearch}
              disabled={isLoading}
            >
              {isLoading ? '🔄 Buscando...' : '🔍 Buscar'}
            </button>
            <button 
              className="clear-btn secondary"
              onClick={clearFilters}
            >
              🧹 Limpiar
            </button>
          </div>

          {/* Resultados de búsqueda */}
          {searchResults.length > 0 && (
            <div className="search-results">
              <h4>🎯 Resultados ({searchResults.length})</h4>
              <div className="results-list">
                {searchResults.map((connection, index) => (
                  <div key={index} className="result-item">
                    <div className="connection-header">
                      <span className="source">{connection.source.label}</span>
                      <span className="arrow">→</span>
                      <span className="target">{connection.target.label}</span>
                    </div>
                    <div className="connection-meta">
                      <span className="category">{connection.metadata.category}</span>
                      <span className="strength">{(connection.metadata.strength * 100).toFixed(0)}%</span>
                      <span className="level">{connection.metadata.epistemicLevel}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estado vacío */}
          {searchResults.length === 0 && !isLoading && (
            <div className="empty-state">
              <p>🔍 Configura los filtros y presiona "Buscar" para encontrar conexiones específicas</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedSearchPanel;