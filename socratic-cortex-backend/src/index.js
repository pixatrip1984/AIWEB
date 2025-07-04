// src/index.js (VERSIÓN FINAL Y LIMPIA)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { checkConnection } = require('./db/neo4j');
const graphRoutes = require('./api/graphRoutes'); // Importamos el router

const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE ---
// Configuración de CORS para permitir peticiones desde el frontend
const corsOptions = {
  origin: 'http://localhost:5173', // La URL de tu app React
  methods: "GET,POST",
};
app.use(cors(corsOptions));

// Middleware para parsear el cuerpo de las peticiones JSON
app.use(express.json());


// --- RUTAS ---
// Todas las rutas que empiecen con /api/graph serán manejadas por graphRoutes.js
app.use('/api/graph', graphRoutes);

// Ruta raíz para verificar que el servidor está vivo
app.get('/', (req, res) => {
    res.send('Socratic Cortex Backend está operativo.');
});


// --- ARRANQUE DEL SERVIDOR ---
const startServer = async () => {
    // Primero nos aseguramos de que la base de datos está conectada
    await checkConnection();

    // Luego, iniciamos el servidor para que escuche peticiones
    app.listen(PORT, '127.0.0.1', () => {
        console.log(`Servidor escuchando en http://127.0.0.1:${PORT}`);
    });
};

startServer();