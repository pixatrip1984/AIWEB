// socratic-cortex-frontend/src/components/KnowledgeIngestPanel.jsx
// Panel de ingesta directa de conocimiento

import React, { useState } from 'react';
import axios from 'axios';
import './KnowledgeIngestPanel.css';

const KnowledgeIngestPanel = ({ isVisible, onKnowledgeAdded, onToggle }) => {
  // Estados del panel
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [inputMode, setInputMode] = useState('text'); // 'text' o 'topic'

  // Ejemplos predefinidos
  const examples = [
    {
      title: "Concepto Filosófico",
      text: "Las Ideas de Platón representan la realidad verdadera, más allá del mundo físico que percibimos. Estas formas perfectas e inmutables son el fundamento de todo conocimiento y existencia."
    },
    {
      title: "Concepto Científico", 
      text: "La superposición cuántica es un principio fundamental de la mecánica cuántica donde una partícula puede existir en múltiples estados simultáneamente hasta que es observada."
    },
    {
      title: "Concepto Teológico",
      text: "La Trinidad Divina representa la naturaleza de Dios como tres personas distintas pero una sola esencia: Padre, Hijo y Espíritu Santo, unidos en perfecta unidad."
    }
  ];

  // Sugerencias de temas
  const topicSuggestions = [
    "Inteligencia Artificial y Consciencia",
    "Ética en la Biotecnología",
    "Filosofía del Tiempo",
    "Mecánica Cuántica y Realidad",
    "Neurociencia y Libre Albedrío",
    "Matemáticas y Platonismo",
    "Cosmología y Existencia"
  ];

  // Procesar conocimiento
  const processKnowledge = async () => {
    if (!inputText.trim()) {
      alert('Por favor, ingresa texto para procesar');
      return;
    }

    setIsLoading(true);
    try {
      console.log('📝 Procesando conocimiento:', inputMode);
      
      // Preparar el texto según el modo
      let textToProcess = inputText;
      if (inputMode === 'topic') {
        textToProcess = `Explica y analiza el concepto de "${inputText}", incluyendo sus principales características, relaciones con otros conceptos, y su importancia en el conocimiento humano.`;
      }

      const response = await axios.post('http://127.0.0.1:5000/api/graph/ingest', {
        text: textToProcess
      });

      if (response.data.success) {
        setLastResult(response.data);
        onKnowledgeAdded(response.data);
        console.log('✅ Conocimiento procesado exitosamente');
        
        // Opcional: Limpiar el input después del éxito
        // setInputText('');
      }
    } catch (error) {
      console.error('❌ Error procesando conocimiento:', error);
      setLastResult({
        success: false,
        error: error.response?.data?.error || 'Error de conexión'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar ejemplo
  const loadExample = (example) => {
    setInputText(example.text);
    setInputMode('text');
  };

  // Cargar sugerencia de tema
  const loadTopicSuggestion = (topic) => {
    setInputText(topic);
    setInputMode('topic');
  };

  // Limpiar input
  const clearInput = () => {
    setInputText('');
    setLastResult(null);
  };

  if (!isVisible) return null;

  return (
    <div className={`knowledge-ingest-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Header del panel */}
      <div className="panel-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-content">
          <span className="panel-icon">📝</span>
          <span className="panel-title">Agregar Conocimiento</span>
          {lastResult?.success && (
            <span className="success-indicator">✅</span>
          )}
        </div>
        <button className="expand-btn" title={isExpanded ? 'Colapsar' : 'Expandir'}>
          {isExpanded ? '⬆️' : '⬇️'}
        </button>
      </div>

      {/* Contenido expandido */}
      {isExpanded && (
        <div className="panel-content">
          {/* Selector de modo */}
          <div className="mode-selector">
            <h4>🎯 Modo de Entrada</h4>
            <div className="mode-buttons">
              <button 
                className={`mode-btn ${inputMode === 'text' ? 'active' : ''}`}
                onClick={() => setInputMode('text')}
              >
                📄 Texto Completo
              </button>
              <button 
                className={`mode-btn ${inputMode === 'topic' ? 'active' : ''}`}
                onClick={() => setInputMode('topic')}
              >
                🎯 Solo Tema
              </button>
            </div>
            <div className="mode-description">
              {inputMode === 'text' ? (
                <p>Ingresa un texto completo con explicaciones detalladas del concepto</p>
              ) : (
                <p>Ingresa solo el nombre del tema y la IA lo expandirá automáticamente</p>
              )}
            </div>
          </div>

          {/* Área de texto principal */}
          <div className="input-section">
            <h4>
              {inputMode === 'text' ? '📝 Texto a Procesar' : '🎯 Tema a Explorar'}
            </h4>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                inputMode === 'text' 
                  ? 'Ingresa el texto que describe el concepto que quieres agregar al grafo del conocimiento...'
                  : 'Ingresa el nombre del tema que quieres explorar (ej: "Superposición Cuántica")'
              }
              className="knowledge-input"
              rows={inputMode === 'text' ? 8 : 3}
              disabled={isLoading}
            />
            <div className="char-counter">
              {inputText.length} caracteres
            </div>
          </div>

          {/* Botones de acción */}
          <div className="action-buttons">
            <button 
              className="process-btn primary"
              onClick={processKnowledge}
              disabled={isLoading || !inputText.trim()}
            >
              {isLoading ? '🔄 Procesando...' : '🚀 Procesar'}
            </button>
            <button 
              className="clear-btn secondary"
              onClick={clearInput}
              disabled={isLoading}
            >
              🧹 Limpiar
            </button>
          </div>

          {/* Ejemplos rápidos */}
          {inputMode === 'text' && (
            <div className="examples-section">
              <h4>📚 Ejemplos Rápidos</h4>
              <div className="examples-grid">
                {examples.map((example, index) => (
                  <div key={index} className="example-item">
                    <div className="example-header">
                      <span className="example-title">{example.title}</span>
                      <button 
                        className="load-example-btn"
                        onClick={() => loadExample(example)}
                        disabled={isLoading}
                      >
                        📥 Cargar
                      </button>
                    </div>
                    <p className="example-preview">
                      {example.text.substring(0, 100)}...
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sugerencias de temas */}
          {inputMode === 'topic' && (
            <div className="suggestions-section">
              <h4>💡 Sugerencias de Temas</h4>
              <div className="suggestions-grid">
                {topicSuggestions.map((topic, index) => (
                  <button
                    key={index}
                    className="suggestion-btn"
                    onClick={() => loadTopicSuggestion(topic)}
                    disabled={isLoading}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resultado del procesamiento */}
          {lastResult && (
            <div className="result-section">
              <h4>📊 Resultado del Procesamiento</h4>
              {lastResult.success ? (
                <div className="success-result">
                  <div className="result-header">
                    <span className="success-icon">✅</span>
                    <span>Conocimiento agregado exitosamente</span>
                  </div>
                  
                  {lastResult.graph && (
                    <div className="graph-info">
                      <div className="primary-node">
                        <h5>🎯 Nodo Principal</h5>
                        <div className="node-details">
                          <strong>{lastResult.graph.primaryNode.label}</strong>
                          <div className="node-meta">
                            <span className="domain">{lastResult.graph.primaryNode.domain}</span>
                            <span className="type">{lastResult.graph.primaryNode.type}</span>
                          </div>
                          <p className="summary">{lastResult.graph.primaryNode.summary}</p>
                        </div>
                      </div>
                      
                      {lastResult.graph.edges && lastResult.graph.edges.length > 0 && (
                        <div className="connections">
                          <h5>🔗 Conexiones Creadas ({lastResult.graph.edges.length})</h5>
                          <div className="connections-list">
                            {lastResult.graph.edges.slice(0, 3).map((edge, index) => (
                              <div key={index} className="connection-item">
                                <span className="connection-type">{edge.relationship}</span>
                                <span className="target-node">{edge.targetNode.label}</span>
                              </div>
                            ))}
                            {lastResult.graph.edges.length > 3 && (
                              <div className="more-connections">
                                +{lastResult.graph.edges.length - 3} conexiones más
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="error-result">
                  <div className="result-header">
                    <span className="error-icon">❌</span>
                    <span>Error al procesar</span>
                  </div>
                  <div className="error-details">
                    {lastResult.error || 'Error desconocido'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Consejos de uso */}
          <div className="tips-section">
            <h4>💡 Consejos de Uso</h4>
            <div className="tips-list">
              <div className="tip-item">
                <span className="tip-icon">📄</span>
                <span>Para mejores resultados, incluye definiciones y relaciones claras</span>
              </div>
              <div className="tip-item">
                <span className="tip-icon">🎯</span>
                <span>En modo tema, usa nombres específicos y descriptivos</span>
              </div>
              <div className="tip-item">
                <span className="tip-icon">🔗</span>
                <span>Menciona conexiones con otros conceptos para crear enlaces</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeIngestPanel;