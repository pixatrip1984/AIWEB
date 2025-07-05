// src/index.js (VERSIÓN ACTUALIZADA CON NORMALIZACIÓN Y ENHANCED)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { checkConnection } = require('./db/neo4j');
const graphRoutes = require('./api/graphRoutes');           // ← AGREGAR ESTA LÍNEA
const enhancedGraphRoutes = require('./api/enhancedGraphRoutes');
const normalizationRoutes = require('./api/normalizationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE ---
const corsOptions = {
  origin: 'http://localhost:5173',
  methods: "GET,POST,PUT,DELETE",
};
app.use(cors(corsOptions));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// --- RUTAS ---
app.use('/api/graph', graphRoutes);              // ← AGREGAR ESTA LÍNEA
app.use('/api/enhanced', enhancedGraphRoutes);      // ← AGREGAR ESTA LÍNEA
app.use('/api/normalization', normalizationRoutes);

// Ruta raíz
app.get('/', (req, res) => {
    res.json({
        message: 'Socratic Cortex Backend está operativo',
        version: '1.2.0',  // ← ACTUALIZAR VERSIÓN
        features: ['Knowledge Graph', 'AI Explanations', 'Intelligent Normalization', 'Enhanced Architecture'],
        timestamp: new Date().toISOString()
    });
});

// Ruta de salud
app.get('/health', async (req, res) => {
    try {
        const { driver } = require('./db/neo4j');
        const session = driver.session();
        await session.run('RETURN 1');
        await session.close();
        
        res.json({
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
    });
});

app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        path: req.originalUrl,
        method: req.method
    });
});

// Arranque del servidor
const startServer = async () => {
    try {
        await checkConnection();
        app.listen(PORT, '127.0.0.1', () => {
            console.log(`🚀 Socratic Cortex Backend v1.2.0 ejecutándose en http://127.0.0.1:${PORT}`);
            console.log(`📚 Funcionalidades disponibles:`);
            console.log(`   • Grafo de Conocimiento: /api/graph`);
            console.log(`   • Explicaciones por IA: /api/graph/explain/:nodeId`);
            console.log(`   • Normalización Inteligente: /api/normalization`);
            console.log(`   • Arquitectura Extendida: /api/graph/enrich-connections`);
            console.log(`   • Estado del Sistema: /health`);
        });
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', async () => {
    console.log('🛑 Cerrando servidor gracefully...');
    const { driver } = require('./db/neo4j');
    await driver.close();
    process.exit(0);
});

startServer();