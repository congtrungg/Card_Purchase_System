const sql = require('mssql');

// Database configuration
const config = {
    server: 'DESKTOP-13Q6S8H',
    database: 'PurchaseSystem',
    driver: 'msnodesqlv8',
    options: {
        encrypt: false,                  // Encryption for Azure or SQL
        trustServerCertificate: true     
    },
    user: 'sa',                          
    password: 'root'                     
};

// Function to connect to the database
async function connectToDatabase() {
    try {
        let pool = await sql.connect(config);
        console.log('Connected to SQL Server');
        return pool;
    } catch (error) {
        console.error('Database connection error:', error);
    }
}

module.exports = {
    connectToDatabase,
    sql
};
