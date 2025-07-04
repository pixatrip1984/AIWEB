// src/db/neo4j.js
const neo4j = require('neo4j-driver');

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASSWORD;

// --- LÍNEAS DE DEPURACIÓN ---
console.log("--- Variables de Entorno para Neo4j ---");
console.log("URI:", uri);
console.log("USER:", user);
console.log("PASSWORD:", password);
console.log("-----------------------------------------");
// --- FIN DE LÍNEAS DE DEPURACIÓN ---

if (!uri || !user || !password) {
    throw new Error('Asegúrate de que las variables de entorno NEO4J_URI, NEO4J_USER y NEO4J_PASSWORD están definidas en tu archivo .env');
}

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

// Función para verificar la conexión al inicio
const checkConnection = async () => {
    try {
        await driver.verifyConnectivity();
        console.log('Conexión con Neo4j establecida correctamente.');
    } catch (error) {
        console.error('No se pudo conectar a Neo4j:', error);
        process.exit(1); // Salir si la DB no está disponible
    }
};

module.exports = { driver, checkConnection };