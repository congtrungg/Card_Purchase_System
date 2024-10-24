const express = require('express');
const path = require('path');
const session = require('express-session');
const { connectToDatabase, sql } = require('./db');
const app = express();
const bcrypt = require('bcrypt');
const port = 3000;

// Configure session
app.use(session({
    secret: '123456789',  
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 }  //auto logout after 
}));
// Store the server start time to detect restarts
const serverStartTime = Date.now();

app.get('/api/server-status', (req, res) => {
    res.json({ startTime: serverStartTime });
});

//authenticator
function isAuthenticated(req, res, next) {
    // Check if user is authenticated (you can replace this with your actual logic)
    if (req.session.user) {
        return next(); // User is authenticated, proceed to the next middleware
    }

    // If not authenticated, send an alert and redirect to login
    res.send(`
        <script>
            alert('You must log in to access this page.');
            window.location.href = '/login.html';
        </script>
    `);
}

// Protect routes
app.get('/create_card.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/create_card.html'));
});

app.get('/index.html', isAuthenticated, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/report.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/report.html'));
});

app.get('/create_acc.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/create_acc.html'));
});
app.get('/card_management.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/card_management.html'));
});

// Parse incoming JSON requests
app.use(express.json());

app.get('/', (req, res) => {
    return res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/card/:cardIMEI', async (req, res) => {
    const cardIMEI = req.params.cardIMEI;

    try {
        let pool = await connectToDatabase();
        
        // Fetch card details with CardTypeName
        let cardResult = await pool.request()
            .input('cardIMEI', sql.VarChar, cardIMEI)
            .query(`
                SELECT 
                    Card.*, 
                    CardType.CardTypeName  -- Get CardTypeName from CardType table
                FROM 
                    Card
                LEFT JOIN 
                    CardType ON Card.CardTypeID = CardType.CardTypeID  -- Join to fetch CardTypeName
                WHERE 
                    CardIMEI = @cardIMEI
            `);
        
        if (cardResult.recordset.length === 0) {
            return res.status(404).send('Card not found');
        }

        const card = cardResult.recordset[0];
        console.log("Card Result: ", card); // Log the card data for debugging

        // Fetch transaction details
        let transactionResult = await pool.request()
            .input('cardID', sql.Int, card.CardID)
            .query('SELECT * FROM [Transaction] WHERE CardID = @cardID ORDER BY TransactionDate DESC');

        const transactions = transactionResult.recordset;
        console.log("Transaction Result: ", transactions); // Log transaction data for debugging
 
        const currentBalance = transactions.length > 0 
            ? transactions[0].Balance
            : card.OpeningBalance;

        res.json({
            card,
            transactions,
            currentBalance
        });
    } catch (error) {
        console.error('Error fetching card and transactions:', error);
        res.status(500).send('Server error');
    }
});

// Route to handle transaction updates
app.post('/api/transaction', async (req, res) => {
    // Destructure the necessary fields from the request body
    const { cardIMEI, transactionAmount, billNumber, outlet, transactionBalance, newBalance, createdBy } = req.body;

    try {
        // Establish a connection to the database
        let pool = await connectToDatabase();

        // Fetch current card details based on cardIMEI
        let cardResult = await pool.request()
            .input('cardIMEI', sql.VarChar, cardIMEI)
            .query('SELECT * FROM Card WHERE CardIMEI = @cardIMEI');

        // Check if the card exists
        if (cardResult.recordset.length === 0) {
            return res.status(404).send('Card not found');
        }

        const card = cardResult.recordset[0];

        // Validate the balance to prevent overdraft
        if (newBalance < 0) {
            return res.status(400).send('Insufficient balance');
        }

        // Insert the new transaction into the Transaction table
        await pool.request()
            .input('cardID', sql.Int, card.CardID) // Get the CardID from the fetched card
            .input('transactionAmount', sql.Decimal(10, 2), transactionAmount)
            .input('transactionBalance', sql.Decimal(10, 2), transactionBalance)
            .input('newBalance', sql.Decimal(10, 2), newBalance)
            .input('billNumber', sql.VarChar, billNumber)
            .input('outlet', sql.VarChar, outlet || 'None') // Use 'Unknown' if outlet is not provided
            .input('createdBy', sql.VarChar, createdBy)  // Include the cashier's username
            .query('INSERT INTO [Transaction] (CardID, TransactionAmount, TransactionBalance, Balance, BillNumber, Outlet, CreatedBy) VALUES (@cardID, @transactionAmount, @transactionBalance, @newBalance, @billNumber, @outlet, @createdBy)');

        // Send a success response
        res.send('Transaction successful');
    } catch (error) {
        console.error('Error processing transaction:', error);
        res.status(500).send('Server error');
    }
});

//Bill route
app.get('/api/bills', async (req, res) => {
    try {
        let pool = await connectToDatabase();
        let result = await pool.request().query('SELECT TransactionID, BillNumber, TransactionDate FROM [Transaction] ORDER BY TransactionDate DESC');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching bills:', error);
        res.status(500).send('Server error');
    }
});

// Fetch a specific bill's details by TransactionID
app.get('/api/bill/:id', async (req, res) => {
    const billID = req.params.id;

    try {
        let pool = await connectToDatabase();
        let result = await pool.request()
            .input('transactionID', sql.Int, billID)
            .query(`
                SELECT 
                    c.CardNumber, 
                    c.CardOwner, 
                    ct.CardTypeName,  -- Fetch CardTypeName
                    t.TransactionAmount, 
                    t.TransactionDate,
                    t.TransactionBalance, 
                    t.Balance AS CurrentBalance,
                    t.CreatedBy, 
                    t.BillNumber
                FROM [Transaction] t
                JOIN Card c ON t.CardID = c.CardID
                JOIN CardType ct ON c.CardTypeID = ct.CardTypeID  -- Join with CardType table
                WHERE t.TransactionID = @transactionID
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).send('Bill not found');
        }

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching bill details:', error);
        res.status(500).send('Server error');
    }
});

// Report route
// Fetch all transactions for the report
app.get('/api/transactions', async (req, res) => {
    try {
        let pool = await connectToDatabase();
        let result = await pool.request().query(`
            SELECT 
                t.TransactionID, 
                t.BillNumber, 
                t.TransactionAmount, 
                t.TransactionDate, 
                c.CardNumber, 
                c.CardOwner, 
                c.CardIMEI,
                t.TransactionBalance,  
                t.Balance AS CurrentBalance,           
                t.Outlet
            FROM [Transaction] t
            JOIN Card c ON t.CardID = c.CardID
            ORDER BY t.TransactionDate DESC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).send('Server error');
    }
});

// Route for creating an account
app.post('/api/create-account', async (req, res) => {
    const { username, password, role, outlet } = req.body;

    // Ensure all fields are provided
    if (!username || !password || !role) {
        return res.status(400).json({ message: 'Username, password, and role are required.' });
    }

    try {
        // Connect to the database
        let pool = await connectToDatabase();

        // Insert account details into the Users table
        let result = await pool.request()
            .input('username', sql.VarChar, username)
            .input('password', sql.VarChar, password)
            .input('role', sql.VarChar, role)
            .input('outlet', sql.VarChar, outlet)
            .query(`
                INSERT INTO Users (Username, Password, Role, Outlet)
                VALUES (@username, @password, @role, @outlet)
            `);

        // Return success message
        res.status(200).json({ message: 'Account created successfully.' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ message: 'Error creating account.' });
    }
});

app.post('/api/create-card', async (req, res) => {
    const { cardNumber, cardIMEI, cardOwner, cardTypeID, position, openingBalance, cardStatus, expireDate } = req.body;

    // Input validation
    if (!cardNumber || !cardIMEI || !cardOwner || !cardTypeID || !position || openingBalance === undefined || !cardStatus || !expireDate) {
        return res.status(400).send('All fields are required');
    }

    try {
        let pool = await connectToDatabase();

        // Check if card already exists
        let existingCardResult = await pool.request()
            .input('cardIMEI', sql.VarChar, cardIMEI)
            .query('SELECT * FROM Card WHERE CardIMEI = @cardIMEI');

        if (existingCardResult.recordset.length > 0) {
            return res.status(409).send('Card with this IMEI already exists');
        }

        // Convert the date format to yyyy-mm-dd for SQL insertion
        const [day, month, year] = expireDate.split('/');
        const formattedExpireDate = `${year}-${month}-${day}`; // Convert to yyyy-mm-dd

        // Insert the new card into the database with CardTypeID
        await pool.request()
            .input('cardNumber', sql.VarChar, cardNumber)
            .input('cardIMEI', sql.VarChar, cardIMEI)
            .input('cardOwner', sql.NVarChar, cardOwner)
            .input('cardTypeID', sql.Int, cardTypeID) // Insert CardTypeID
            .input('position', sql.VarChar, position)
            .input('openingBalance', sql.Decimal(10, 2), parseFloat(openingBalance))
            .input('cardStatus', sql.VarChar, cardStatus)
            .input('expireDate', sql.Date, formattedExpireDate) // Use the formatted date for SQL
            .query(`
                INSERT INTO Card 
                (CardNumber, CardIMEI, CardOwner, CardTypeID, Position, OpeningBalance, CardStatus, ExpireDate) 
                VALUES 
                (@cardNumber, @cardIMEI, @cardOwner, @cardTypeID, @position, @openingBalance, @cardStatus, @expireDate)
            `);

        res.status(201).send('Card created successfully');
    } catch (error) {
        console.error('Error creating card:', error);
        res.status(500).send('Server error');
    }
});

// Route to fetch all cards
app.get('/api/cards', async (req, res) => {
    try {
        let pool = await connectToDatabase();
        let result = await pool.request().query(`
            SELECT 
                c.CardNumber, 
                c.CardIMEI, 
                c.CardOwner, 
                ct.CardTypeName, 
                c.Position, 
                c.OpeningBalance, 
                ISNULL((
                    SELECT TOP 1 t.Balance
                    FROM [Transaction] t
                    WHERE t.CardID = c.CardID
                    ORDER BY t.TransactionDate DESC
                ), c.OpeningBalance) AS CurrentBalance, -- Using the CurrentBalance logic from the second query
                c.CardStatus, 
                c.ExpireDate, 
                c.CreatedDate
            FROM 
                Card c
            JOIN 
                CardType ct ON c.CardTypeID = ct.CardTypeID -- Joining with CardType table
            ORDER BY 
                c.CreatedDate DESC;
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching cards:', error);
        res.status(500).send('Server error');
    }
});

// Route to search for a card based on cardNumber or cardIMEI
app.get('/api/cards/search', async (req, res) => {
    const searchQuery = req.query.query;  // Get the search input from query parameters

    try {
        const query = `
            SELECT c.CardNumber, c.CardIMEI, c.CardOwner, ct.CardTypeName, c.Position, c.OpeningBalance, c.CardStatus, c.ExpireDate
            FROM Card c
            JOIN CardType ct ON c.CardTypeID = ct.CardTypeID
            WHERE c.CardNumber = @searchQuery OR c.CardIMEI = @searchQuery`;

        const request = new sql.Request();
        request.input('searchQuery', sql.NVarChar, searchQuery); // Use parameterized input

        const result = await request.query(query);
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "Card not found" });
        }
        res.json(result.recordset[0]);  // Return the first matching record
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// Route to update card details
app.post('/api/cards/update', async (req, res) => {
    const { cardNumber, cardOwner, cardTypeID, position, cardStatus, expireDate, openingBalance } = req.body;

    // Input validation
    if (!cardNumber || !cardOwner || !cardTypeID || !position || !cardStatus || !expireDate || openingBalance === undefined) {
        return res.status(400).json({ message: "All fields are required." });
    }
    try {
        const request = new sql.Request();
        request.input('cardNumber', sql.NVarChar, cardNumber);
        request.input('cardOwner', sql.NVarChar, cardOwner);
        request.input('cardTypeID', sql.Int, cardTypeID); // Use CardTypeID
        request.input('position', sql.NVarChar, position);
        request.input('cardStatus', sql.NVarChar, cardStatus);
        request.input('expireDate', sql.Date, expireDate);
        request.input('openingBalance', sql.Decimal(18, 2), openingBalance); // Specify precision and scale
        
        const result = await request.query(`
            UPDATE Card SET
                CardOwner = @cardOwner,
                CardTypeID = @cardTypeID,  -- Use CardTypeID
                Position = @position,
                CardStatus = @cardStatus,
                ExpireDate = @expireDate,
                OpeningBalance = @openingBalance
            WHERE CardNumber = @cardNumber
        `);
        
        // Check if any rows were affected
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: "Card not found." });
        }

        res.json({ message: "Card updated successfully" });
    } catch (error) {
        console.error('Error updating card:', error);
        res.status(500).json({ message: "Server error" });
    }
});

// Login route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        let pool = await connectToDatabase();

        let result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, password)
            .query('SELECT username, role, outlet FROM Users WHERE username = @username AND password = @password');  

        if (result.recordset.length === 0) {
            return res.status(401).send('Invalid username or password');
        }

        const user = result.recordset[0];

        // Store session data
        req.session.user = {
            username: user.username,
            role: user.role,
            outlet: user.outlet
        };

        res.json({ username: user.username, role: user.role, outlet: user.outlet });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send('Server error');
    }
});

//Log out route
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Logout error');
        }
        res.status(200).send('Logged out');
    });
});

// Route to fetch all card types
app.get('/api/cardtypes', async (req, res) => {
    try {
        let pool = await connectToDatabase();
        let result = await pool.request().query(`SELECT CardTypeID, CardTypeName, OpeningBalance FROM CardType`);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching card types:', error);
        res.status(500).send('Server error');
    }
});

// Add new card type
app.post('/api/cardtypes', async (req, res) => {
    const { cardTypeName, openingBalance } = req.body;

    try {
        let pool = await connectToDatabase();
        const request = pool.request();
        request.input('cardTypeName', sql.NVarChar, cardTypeName);
        request.input('openingBalance', sql.Decimal(18, 2), openingBalance); // Adjust precision/scale as needed

        const result = await request.query(`
            INSERT INTO CardType (CardTypeName, OpeningBalance) 
            VALUES (@cardTypeName, @openingBalance)
        `);
        
        res.json({ message: 'Card type added successfully' });
    } catch (error) {
        console.error('Error adding card type:', error);
        res.status(500).json({ message: 'Failed to add card type' });
    }
});

// Route to search for a card type based on CardTypeName
app.get('/api/cardtypes/search', async (req, res) => {
    const searchQuery = req.query.query;  // Get the search input from query parameters

    try {
        const query = `
            SELECT * 
            FROM CardType 
            WHERE CardTypeName = @searchQuery`;

        const request = new sql.Request();
        request.input('searchQuery', sql.NVarChar, searchQuery); // Use parameterized input

        const result = await request.query(query);
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "Card type not found" });
        }
        res.json(result.recordset[0]);  // Return the first matching record
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// Route to update card type details
app.put('/api/cardtypes/update', async (req, res) => {
    const { cardTypeID, cardTypeName, openingBalance } = req.body;

    // Input validation
    if (!cardTypeID || !cardTypeName || !openingBalance) {
        return res.status(400).json({ message: "All fields are required." });
    }

    try {
        const request = new sql.Request();
        request.input('cardTypeID', sql.Int, cardTypeID); // Assuming cardTypeID is an integer
        request.input('cardTypeName', sql.NVarChar, cardTypeName);
        request.input('openingBalance', sql.Decimal(18, 2), openingBalance); // Specify precision and scale
        
        const result = await request.query(`
            UPDATE CardType SET
                CardTypeName = @cardTypeName,
                OpeningBalance = @openingBalance
            WHERE CardTypeID = @cardTypeID
        `);
        
        // Check if any rows were affected
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: "Card type not found." });
        }

        res.json({ message: "Card type updated successfully" });
    } catch (error) {
        console.error('Error updating card type:', error);
        res.status(500).json({ message: "Server error" });
    }
});


// Delete card type
app.delete('/api/cardtypes/:id', async (req, res) => {
    const { id } = req.params;

    try {
        let pool = await connectToDatabase();
        const request = pool.request();
        request.input('id', sql.Int, id);

        const result = await request.query(`
            DELETE FROM CardType WHERE CardTypeID = @id
        `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Card type not found' });
        }

        res.json({ message: 'Card type deleted successfully' });
    } catch (error) {
        console.error('Error deleting card type:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Route to check if card type exists
app.get('/api/cardtypes/exist', async (req, res) => {
    const cardTypeName = req.query.cardTypeName;

    try {
        const query = `
            SELECT COUNT(*) AS count 
            FROM CardType 
            WHERE CardTypeName = @cardTypeName
        `;

        const request = new sql.Request();
        request.input('cardTypeName', sql.NVarChar, cardTypeName); // Use parameterized input

        const result = await request.query(query);
        const exists = result.recordset[0].count > 0;

        res.json({ exists });
    } catch (error) {
        console.error('Error checking for existing card type:', error);
        res.status(500).send('Server error');
    }
});

// Example API route to fetch card types
app.get('/api/card-types', async (req, res) => {
    try {
        let pool = await connectToDatabase();
        let result = await pool.request().query(`SELECT CardTypeID, CardTypeName, OpeningBalance FROM CardType`);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching card types:', error);
        res.status(500).send('Server error');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
