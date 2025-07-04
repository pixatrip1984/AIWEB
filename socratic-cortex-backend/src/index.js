// src/index.js (VERSIÓN ACTUALIZADA CON NORMALIZACIÓN)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { checkConnection } = require('./db/neo4j');
const graphRoutes = require('./api/graphRoutes');
const normalizationRoutes = require('./api/normalizationRoutes'); // NUEVA IMPORTACIÓN

const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE ---
// Configuración de CORS para permitir peticiones desde el frontend
const corsOptions = {
  origin: 'http://localhost:5173', // La URL de tu app React
  methods: "GET,POST,PUT,DELETE", // Añadidos métodos adicionales
};
app.use(cors(corsOptions));

// Middleware para parsear el cuerpo de las peticiones JSON
app.use(express.json());

// Middleware de logging para debugging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// --- RUTAS ---
// Rutas principales del grafo
app.use('/api/graph', graphRoutes);

// NUEVAS RUTAS DE NORMALIZACIÓN
app.use('/api/normalization', normalizationRoutes);

// Ruta raíz para verificar que el servidor está vivo
app.get('/', (req, res) => {
    res.json({
        message: 'Socratic Cortex Backend está operativo',
        version: '1.1.0',
        features: ['Knowledge Graph', 'AI Explanations', 'Intelligent Normalization'],
        timestamp: new Date().toISOString()
    });
});

// Ruta de estado del sistema
app.get('/health', async (req, res) => {
    try {
        // Verificar conexión a Neo4j
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

// --- MANEJO DE ERRORES ---
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
    });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        path: req.originalUrl,
        method: req.method
    });
});

// --- ARRANQUE DEL SERVIDOR ---
const startServer = async () => {
    try {
        // Primero nos aseguramos de que la base de datos está conectada
        await checkConnection();

        // Luego, iniciamos el servidor para que escuche peticiones
        app.listen(PORT, '127.0.0.1', () => {
            console.log(`🚀 Socratic Cortex Backend v1.1.0 ejecutándose en http://127.0.0.1:${PORT}`);
            console.log(`📚 Funcionalidades disponibles:`);
            console.log(`   • Grafo de Conocimiento: /api/graph`);
            console.log(`   • Explicaciones por IA: /api/graph/nodes/:id/explain`);
            console.log(`   • Normalización Inteligente: /api/normalization`);
            console.log(`   • Estado del Sistema: /health`);
            console.log(`🔧 Panel de desarrollo disponible para testing de APIs`);
        });
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
};

// Manejo graceful de cierre
process.on('SIGTERM', async () => {
    console.log('🛑 Cerrando servidor gracefully...');
    const { driver } = require('./db/neo4j');
    await driver.close();
    process.exit(0);
});

startServer();