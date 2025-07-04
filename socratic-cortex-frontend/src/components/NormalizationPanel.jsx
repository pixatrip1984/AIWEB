// socratic-cortex-frontend/src/components/NormalizationPanel.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './NormalizationPanel.css';

const NormalizationPanel = ({ isOpen, onClose }) => {
    const [stats, setStats] = useState(null);
    const [duplicates, setDuplicates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        if (isOpen) {
            loadInitialData();
        }
    }, [isOpen]);

    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                loadStats(),
                loadDuplicates(),
                loadReport()
            ]);
        } catch (error) {
            console.error('Error cargando datos iniciales:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const response = await axios.get('http://127.0.0.1:5000/api/normalization/graph-stats');
            setStats(response.data.stats);
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    };

    const loadDuplicates = async () => {
        try {
            const response = await axios.get('http://127.0.0.1:5000/api/normalization/detect-duplicates');
            setDuplicates(response.data.duplicateGroups);
        } catch (error) {
            console.error('Error detectando duplicados:', error);
        }
    };

    const loadReport = async () => {
        try {
            const response = await axios.get('http://127.0.0.1:5000/api/normalization/normalization-report');
            setReport(response.data.report);
        } catch (error) {
            console.error('Error cargando reporte:', error);
        }
    };

    const executeFullNormalization = async () => {
        if (!window.confirm('¿Estás seguro de que quieres normalizar todo el grafo? Esta acción fusionará nodos duplicados.')) {
            return;
        }

        setIsLoading(true);
        try {
            const response = await axios.post('http://127.0.0.1:5000/api/normalization/normalize-graph');
            alert(`Normalización completada: ${response.data.report.mergedNodes} nodos fusionados`);
            await loadInitialData(); // Recargar datos
        } catch (error) {
            console.error('Error en normalización:', error);
            alert('Error durante la normalización: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const mergeSpecificGroup = async (group) => {
        const nodeIds = group.nodes.map(n => n.id);
        const primaryId = group.suggestedMerge.id;

        try {
            await axios.post('http://127.0.0.1:5000/api/normalization/merge-group', {
                nodeIds,
                primaryNodeId: primaryId
            });
            
            alert(`Grupo fusionado exitosamente en: ${group.suggestedMerge.label}`);
            await loadDuplicates(); // Recargar duplicados
        } catch (error) {
            console.error('Error fusionando grupo:', error);
            alert('Error fusionando grupo: ' + error.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="normalization-overlay">
            <div className="normalization-panel">
                <div className="panel-header">
                    <h2>🧠 Control de Normalización del Conocimiento</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="panel-tabs">
                    <button 
                        className={activeTab === 'overview' ? 'tab active' : 'tab'}
                        onClick={() => setActiveTab('overview')}
                    >
                        📊 Resumen
                    </button>
                    <button 
                        className={activeTab === 'duplicates' ? 'tab active' : 'tab'}
                        onClick={() => setActiveTab('duplicates')}
                    >
                        🔍 Duplicados ({duplicates.length})
                    </button>
                    <button 
                        className={activeTab === 'report' ? 'tab active' : 'tab'}
                        onClick={() => setActiveTab('report')}
                    >
                        📋 Reporte
                    </button>
                </div>

                <div className="panel-content">
                    {isLoading && (
                        <div className="loading-indicator">
                            <div className="spinner"></div>
                            <p>Procesando datos del grafo...</p>
                        </div>
                    )}

                    {activeTab === 'overview' && stats && (
                        <div className="overview-section">
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <h3>{stats.totalNodes}</h3>
                                    <p>Nodos Totales</p>
                                </div>
                                <div className="stat-card">
                                    <h3>{stats.totalRelationships}</h3>
                                    <p>Relaciones</p>
                                </div>
                                <div className="stat-card">
                                    <h3>{duplicates.length}</h3>
                                    <p>Grupos Duplicados</p>
                                </div>
                                <div className="stat-card">
                                    <h3>{report?.quality?.domainCompleteness || '0%'}</h3>
                                    <p>Completitud de Dominios</p>
                                </div>
                            </div>

                            <div className="domains-section">
                                <h3>📚 Distribución por Dominios</h3>
                                <div className="domain-list">
                                    {stats.nodesByDomain.map(domain => (
                                        <div key={domain.domain} className="domain-item">
                                            <span className="domain-name">{domain.domain}</span>
                                            <span className="domain-count">{domain.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="actions-section">
                                <button 
                                    className="action-btn primary"
                                    onClick={executeFullNormalization}
                                    disabled={isLoading || duplicates.length === 0}
                                >
                                    🚀 Ejecutar Normalización Completa
                                </button>
                                <button 
                                    className="action-btn secondary"
                                    onClick={loadDuplicates}
                                    disabled={isLoading}
                                >
                                    🔄 Redetectar Duplicados
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'duplicates' && (
                        <div className="duplicates-section">
                            <p className="section-description">
                                Se detectaron {duplicates.length} grupos de conceptos duplicados. 
                                Puedes fusionar cada grupo individualmente o ejecutar la normalización completa.
                            </p>
                            
                            {duplicates.map((group, index) => (
                                <div key={index} className="duplicate-group">
                                    <div className="group-header">
                                        <h4>Grupo {index + 1} - Confianza: {(group.confidence * 100).toFixed(1)}%</h4>
                                        <button 
                                            className="merge-btn"
                                            onClick={() => mergeSpecificGroup(group)}
                                        >
                                            Fusionar
                                        </button>
                                    </div>
                                    
                                    <div className="group-content">
                                        <div className="original-nodes">
                                            <h5>Nodos Originales:</h5>
                                            {group.nodes.map(node => (
                                                <div key={node.id} className="node-item">
                                                    <span className="node-id">{node.id}</span>
                                                    <span className="node-label">{node.label}</span>
                                                    <span className="node-domain">{node.domain}</span>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <div className="arrow">→</div>
                                        
                                        <div className="merged-result">
                                            <h5>Resultado Fusionado:</h5>
                                            <div className="merged-node">
                                                <strong>{group.suggestedMerge.label}</strong>
                                                <p>{group.suggestedMerge.domain}</p>
                                                <p className="summary">{group.suggestedMerge.summary}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'report' && report && (
                        <div className="report-section">
                            <div className="quality-metrics">
                                <h3>📈 Métricas de Calidad</h3>
                                <div className="metrics-grid">
                                    <div className="metric">
                                        <label>Completitud de Dominios:</label>
                                        <div className="progress-bar">
                                            <div 
                                                className="progress-fill"
                                                style={{ width: report.quality.domainCompleteness }}
                                            ></div>
                                            <span>{report.quality.domainCompleteness}</span>
                                        </div>
                                    </div>
                                    <div className="metric">
                                        <label>Completitud de Resúmenes:</label>
                                        <div className="progress-bar">
                                            <div 
                                                className="progress-fill"
                                                style={{ width: report.quality.summaryCompleteness }}
                                            ></div>
                                            <span>{report.quality.summaryCompleteness}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {report.recentNormalizations.length > 0 && (
                                <div className="recent-normalizations">
                                    <h3>🔄 Normalizaciones Recientes</h3>
                                    {report.recentNormalizations.map(norm => (
                                        <div key={norm.id} className="normalization-item">
                                            <strong>{norm.label}</strong>
                                            <p>Fusionado desde: {norm.mergedFrom.join(', ')}</p>
                                            <span className="confidence">Confianza: {(norm.confidence * 100).toFixed(1)}%</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {report.nodesNeedingReview.length > 0 && (
                                <div className="review-needed">
                                    <h3>⚠️ Nodos que Requieren Revisión</h3>
                                    {report.nodesNeedingReview.map(node => (
                                        <div key={node.id} className="review-item">
                                            <span>{node.label}</span>
                                            <span className="orphaned">Huérfano desde: {new Date(node.orphanedAt).toLocaleDateString()}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NormalizationPanel;