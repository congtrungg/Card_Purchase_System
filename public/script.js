// Format date to show DD/MM/YYYY
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');   // Get day and pad with leading 0 if necessary
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed, so +1
    const year = String(date.getFullYear());  // Get full year

    return `${day}/${month}/${year}`; // Return formatted date
}
// Function to format date and time
function formatDateTime(dateTime) {
    // Create a date object from the input string
    const date = new Date(dateTime);

    // Check if the date is valid
    if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateTime);
        return 'Invalid date'; // Return an error message if the date is invalid
    }

    // Adjust for UTC +7 (Vietnam time)
    const localDate = new Date(date.getTime() + (-7 * 60 * 60 * 1000)); // Add 7 hours

    // Get day, month, year, hour, and minute
    const day = localDate.getDate(); // 1-31
    const month = localDate.getMonth() + 1; // 0-11, so add 1
    const year = localDate.getFullYear(); // 4-digit year
    const hours = localDate.getHours(); // 0-23
    const minutes = localDate.getMinutes(); // 0-59

    // Format hour to 12-hour format and determine AM/PM
    const formattedHour = hours % 12 || 12; // Convert to 12-hour format
    const ampm = hours >= 12 ? 'PM' : 'AM'; // Determine AM/PM

    // Pad minutes with leading zero if needed
    const formattedMinutes = String(minutes).padStart(2, '0'); 

    // Construct the final formatted date string
    return `${day}/${month}/${year} ${formattedHour}:${formattedMinutes} ${ampm}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const outlet = localStorage.getItem('outlet');
    
    if (outlet) {
        document.getElementById('outlet').value = outlet; // Set the outlet in the transaction section
    }
});

// Format number to currency with commas
function formatCurrency(amount) {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 0 });
}
// Format input
function formatCurrencyInput(event) {
    let input = event.target.value;

    // Allow negative values by handling the "-" sign
    let isNegative = input.startsWith('-');
    
    // Remove everything except digits
    input = input.replace(/[^\d]/g, '');

    // If input has a value, format it with commas
    if (input) {
        input = parseInt(input, 10).toLocaleString('en-US');
    }

    // Restore the negative sign if needed
    event.target.value = isNegative ? '-' + input : input;
}

//Delete card
function deleteCard() {   
    // Clear the input fields in the Card Information section
    document.getElementById("cardNumberIMEI").value = "";
    document.getElementById('cardOwner').value = "";
    document.getElementById('balanceLabel').value = "";
    document.getElementById('expireDate').value = "";
    document.getElementById('cardtype').value = "";
    document.getElementById('cardStatus').value = "";
    document.getElementById('expiredLabel').style.display = 'none';
    document.getElementById('inactiveLabel').style.display = 'none';
    document.getElementById('transaction').value = "";
    document.getElementById('billnumber').value = "";
    // Clear the transaction table
    const transactionTable = document.getElementById('transactionTable');
    transactionTable.innerHTML = `
        <tr>
            <th>Card Number</th>
            <th>Card IMEI</th>
            <th>Card Owner</th>
            <th>Card Type</th>
            <th>Opening Balance</th>
            <th>Transaction Amount</th>
            <th>Balance</th>
            <th>Transaction Date</th>
            <th>Bill Number</th>
            <th>Cashier</th>
        </tr>
    `; // Reset the table content to just the headers
    // Set focus to the card number IMEI input
    document.getElementById("cardNumberIMEI").focus();
    // Alert the user
    alert("Card deleted. Please enter a new one.");
}

// Modified fetchCardInfo to format transaction amounts
async function fetchCardInfo() {
    const cardIMEI = document.getElementById('cardNumberIMEI').value;
    try {
        const response = await fetch(`/api/card/${cardIMEI}`);
        if (!response.ok) {
            alert('Card not found');
            return;
        }

        const data = await response.json();

        // Populate card info
        document.getElementById('cardOwner').value = data.card.CardOwner;
        document.getElementById('cardStatus').value = data.card.CardStatus;
        document.getElementById('cardtype').value = data.card.CardTypeName;
        document.getElementById('expireDate').value = formatDate(data.card.ExpireDate);
        document.getElementById('balanceLabel').value = formatCurrency(data.currentBalance || 0); 

        // Check if the card is expired or inactive
        const expireDate = new Date(data.card.ExpireDate);
        const currentDate = new Date();

        // Add one day to the expiration date to check if it’s expired the day a  fter
        expireDate.setDate(expireDate.getDate() + 1);

        const isExpired = currentDate >= expireDate;
        const isInactive = data.card.CardStatus.toLowerCase() === 'inactive';

        // Display the "Expired" label if the card is expired
        document.getElementById('expiredLabel').style.display = isExpired ? 'inline' : 'none';

        // Display the "Inactive" label if the card is inactive
        document.getElementById('inactiveLabel').style.display = isInactive ? 'inline' : 'none';

        // Blur the Submit button if the card is expired or inactive
        const submitButton = document.querySelector('button[onclick="submitTransaction()"]');
        if (isExpired || isInactive) {
            submitButton.disabled = true;
            submitButton.style.filter = 'blur(2px)'; // Add blur effect
        } else {
            submitButton.disabled = false;
            submitButton.style.filter = 'none'; // Remove blur effect
        }

        // Populate transaction table
        const table = document.getElementById('transactionTable');
        table.innerHTML = `
            <tr>
                <th>Card Number</th>
                <th>Card Owner</th>
                <th>Card Type</th>
                <th>Opening Balance</th>
                <th>Transaction Amount</th>
                <th>Balance</th>
                <th>Transaction Date</th>
                <th>Bill Number</th>
                <th>Cashier</th>
                <th>Outlet</th> 
            </tr>
        `;

        data.transactions.forEach(transaction => {
            const row = table.insertRow();
            row.insertCell(0).innerText = data.card.CardNumber;
            row.insertCell(1).innerText = data.card.CardOwner;
            row.insertCell(2).innerText = data.card.CardTypeName;
            row.insertCell(3).innerText = formatCurrency(transaction.TransactionBalance);
            row.insertCell(4).innerText = formatCurrency(transaction.TransactionAmount);
            row.insertCell(5).innerText = formatCurrency(transaction.Balance);
            row.insertCell(6).innerText = formatDateTime(transaction.TransactionDate);
            row.insertCell(7).innerText = transaction.BillNumber;
            row.insertCell(8).innerText = transaction.CreatedBy || 'Unknown';
            row.insertCell(9).innerText = transaction.Outlet  
        });
        document.getElementById('transaction').focus();
    } catch (error) {
        console.error('Error fetching card info:', error);
    }
}

// Show custom confirmation dialog
function showConfirmDialog(message, onYes, onNo) {
    const confirmDialog = document.getElementById('confirmDialog');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');

    confirmMessage.textContent = message;
    confirmDialog.style.display = 'block';

    // Handle the "Yes" button click
    confirmYes.onclick = function() {
        confirmDialog.style.display = 'none';
        if (onYes) onYes();
    };

    // Handle the "No" button click
    confirmNo.onclick = function() {
        confirmDialog.style.display = 'none';
        if (onNo) onNo();
    };
}

// Modified submitTransaction function
async function submitTransaction() {
    const cardIMEI = document.getElementById('cardNumberIMEI').value;
    const transactionAmount = parseFloat(document.getElementById('transaction').value.replace(/,/g, '')); 

    if (isNaN(transactionAmount) || Math.abs(transactionAmount) < 10000) {
        alert('Please enter a valid transaction amount greater than 10,000 (absolute value)');
        return;
    }
    
    document.getElementById('transaction').value = formatCurrency(transactionAmount);
    const billNumber = document.getElementById('billnumber').value;
    const outlet = document.getElementById('outlet').value || 'None';
    const cashierUsername = localStorage.getItem('username') || 'Unknown';

    if (!cardIMEI || isNaN(transactionAmount) || !billNumber || !outlet) {
        alert('Please fill all the fields');
        return;
    }

    // Show the custom confirmation dialog
    showConfirmDialog(`Do you want to proceed with the transaction of ${formatCurrency(transactionAmount)} VND?`, async () => {
        try {
            const cardResponse = await fetch(`/api/card/${cardIMEI}`);
            if (!cardResponse.ok) {
                alert('Card not found');
                return;
            }
  
            const cardData = await cardResponse.json();
            let currentBalance = cardData.currentBalance || cardData.card.OpeningBalance;
            const transactionBalance = currentBalance;
            const newBalance = currentBalance + transactionAmount;

            const response = await fetch('/api/transaction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    cardIMEI,
                    transactionAmount, 
                    billNumber, 
                    outlet,
                    transactionBalance,
                    newBalance,
                    createdBy: cashierUsername,
                })
            });

            if (response.ok) {
                alert('Transaction successful');
                fetchCardInfo();
                await fetchLatestBill();

                const latestBill = {
                    billNumber: billNumber,
                    cardNumber: cardData.card.CardNumber,
                    cardOwner: cardData.card.CardOwner,
                    cardType: cardData.card.CardTypeName,  
                    transactionDate: new Date().toLocaleString(),
                    transactionBalance: transactionBalance.toLocaleString(),
                    transactionAmount: transactionAmount.toLocaleString(),
                    currentBalance: newBalance.toLocaleString(),
                    cashier: cashierUsername,
                    outlet: outlet,
                };
                
                
                localStorage.setItem('latestBill', JSON.stringify(latestBill));
                printBill(latestBill);

                // Clear the transaction section after printing the bill
                clearTransactionSection();

            } else {
                const errorMsg = await response.text();
                alert(`Transaction failed: ${errorMsg}`);
            }
        } catch (error) {
            console.error('Error processing transaction:', error);
        }
    }, () => {
        // Clear the transaction section when the user presses "No"
        clearTransactionSection();
    });
}

// Function to clear the transaction section
function clearTransactionSection() {
    document.getElementById('transaction').value = '';
    document.getElementById('billnumber').value = '';
    document.getElementById('transaction').focus(); 
}

// Function to print the bill using a hidden iframe
function printBill(billData) {
    // Create a hidden iframe to print the bill
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;

    // Write the bill content into the iframe
    doc.open();
doc.write(`
    <html>
    <head>
        <style>
            @media print {
                @page {
                    size: 76mm auto; /* Set the width to 76mm and height as auto */
                    margin: 0; /* Remove margins for better usage of space */
                }
                body {
                    font-family: 'Verdana', sans-serif; /* Change font to Verd       ana for better clarity */
                    text-align: justify; /* Ensure justified text alignment */
                    padding: 5mm; /* Add padding around content */
                    width: 100%; /* Ensure body takes full width */
                    box-sizing: border-box; /* Include padding in width calculation */
                }
                .bill {
                    padding: 10px; 
                    width: 100%; /* Ensure bill takes full width */
                    box-sizing: border-box; /* Include padding in width calculation */
                }
                .bill h2 { 
                    margin-top: 0; 
                    text-align: center; /* Center the heading */
                    font-size: 2em; /* Slightly larger for better visibility */
                    font-weight: bold; /* Make the heading bold */
                }
                .bill p {
                    white-space: normal; /* Allow text to wrap */
                    margin: 8px 0; /* Add margin between paragraphs */
                    text-align: justify; /* Ensure justified text alignment */
                    font-size: 1em; /* Standard font size */
                    font-weight: normal; /* Regular weight for paragraphs */
                    text-shadow: 0.1px 0.1px 0.1px rgba(0, 0, 0, 0.5); /* Optional: subtle shadow for clarity */
                }
        </style>
    </head>
    <body>
        <div class="bill">
            <h2>Bill Information</h2>
            <p>Bill Number: ${billData.billNumber}</p>
            <p>Card Number: ${billData.cardNumber}</p>
            <p>Card Owner: ${billData.cardOwner}</p>
            <p>Card Type: ${billData.cardType}</p>
            <p>Transaction Date: ${billData.transactionDate}</p>
            <p>Opening Balance: ${billData.transactionBalance} VND</p>
            <p>Transaction Amount: ${billData.transactionAmount} VND</p>
            <p>Current Balance: ${billData.currentBalance} VND</p>
            <p>Outlet: ${billData.outlet}</p>
            <p>Cashier: ${billData.cashier}</p>
        </div>
    </body>
    </html>
`);
doc.close();


    // Wait for the content to load, then print and remove the iframe
    iframe.contentWindow.focus();
    iframe.contentWindow.print();          

    setTimeout(() => {
        document.body.removeChild(iframe);
    }, 1000);  // Remove the iframe after printing
}

// Fetch and display the latest bill automatically after a transaction
async function fetchLatestBill() {
    try {
        const response = await fetch('/api/bills');
        const bills = await response.json();

        if (bills.length === 0) {
            console.error('No bills found');
            return;
        }

        const latestBillID = bills[0].TransactionID;  // Get the latest bill (first in the sorted list)

        const billResponse = await fetch(`/api/bill/${latestBillID}`);
        const bill = await billResponse.json();

        // Populate the bill info
        document.getElementById('billNumer').innerText = bill.BillNumber;
        document.getElementById('cardNumber').innerText = bill.CardNumber;
        document.getElementById('cardOwner').innerText = bill.CardOwner;
        document.getElementById('transactionDate').innerText = formatDate(bill.TransactionDate).toLocaleDateString();
        document.getElementById('transactionAmount').innerText = `${bill.TransactionAmount.toLocaleString()} VND`;
        document.getElementById('transactionBalance').innerText = `${bill.TransactionBalance.toLocaleString()} VND`;
        document.getElementById('balanceLabel').innerText = `${bill.CurrentBalance.toLocaleString()} VND`;
        document.getElementById('outlet').innerText = bill.Outlet;
        document.getElementById('cardType').innerText = bill.CardTypeName;

        // Display cashier info: prefer backend response, fallback to localStorage
        const cashierUsername = bill.CreatedBy || localStorage.getItem('username') || 'Unknown';
        document.getElementById('cashierprintbill').innerText = cashierUsername;

    } catch (error) {
        console.error('Error fetching latest bill:', error);
    }
}

// Automatically print the current bill information
function printBillInfo() {
    // Delay the window.print() function slightly to allow the UI to update
    setTimeout(() => {
        window.print();
    }, 50); // 500ms delay to ensure the bill is displayed before printing
}

// Report script
async function fetchReportData() {
    try {
        const response = await fetch('/api/transactions');
        const transactions = await response.json();

        const tableBody = document.getElementById('reportTableBody');
        tableBody.innerHTML = ''; // Clear current table content

        transactions.forEach(transaction => {
            const row = tableBody.insertRow();
            row.insertCell(0).innerText = transaction.TransactionID;
            row.insertCell(1).innerText = transaction.BillNumber;
            row.insertCell(2).innerText = transaction.CardNumber;
            row.insertCell(3).innerText = transaction.CardIMEI;  // Correctly display the CardIMEI
            row.insertCell(4).innerText = transaction.CardOwner;
            row.insertCell(5).innerText = transaction.Outlet || 'N/A';
            row.insertCell(6).innerText = formatCurrency(transaction.TransactionBalance);
            row.insertCell(7).innerText = formatCurrency(transaction.TransactionAmount);
            row.insertCell(8).innerText = formatCurrency(transaction.CurrentBalance);
            row.insertCell(9).innerText = formatDateTime(transaction.TransactionDate);
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
    }
}

// Filtering logic similar to Excel
// Helper function to format currency for display (optional, used for future enhancements)
function formatCurrency(value) {
    if (value === null || value === undefined) return value;

    // Parse the value as a float to handle negative/positive amounts
    const number = parseFloat(value);

    // Format the number with commas, no decimal places
    const formattedValue = number.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    return formattedValue;
}

// Debounce function to limit how often filterTable gets called
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}
   
// Core filter function
// Function to validate the date range
function validateDateRange() {
    const fromDateInput = document.getElementById('filterFromDate').value;
    const toDateInput = document.getElementById('filterToDate').value;
    const errorMessage = document.getElementById('dateError');

    // Parse dates from input
    const fromDate = parseDateFromString(fromDateInput);
    const toDate = parseDateFromString(toDateInput);

    // Check if From Date is after To Date
    if (fromDate && toDate && fromDate > toDate) {
        errorMessage.style.display = 'block';
    } else {
        errorMessage.style.display = 'none';
    }

    // Call the filterTable function after validating
    filterTable();
}

function filterTable() {
    const transactionID = document.getElementById('filterTransactionID').value.toLowerCase();
    const billNumber = document.getElementById('filterBillNumber').value.toLowerCase();
    const cardNumber = document.getElementById('filterCardNumber').value.toLowerCase();
    const cardIMEI = document.getElementById('filterCardImei').value.toLowerCase();
    const cardOwner = document.getElementById('filterCardOwner').value.toLowerCase();
    const outlet = document.getElementById('filterOutlet').value.toLowerCase();
    const transactionDate = document.getElementById('filterTransactionDate').value.toLowerCase();
    let transactionBalanceInput = document.getElementById('filterTransactionBalance').value.trim();
    let transactionAmountInput = document.getElementById('filterTransactionAmount').value.trim();

    // Remove commas from input values
    transactionBalanceInput = transactionBalanceInput.replace(/,/g, '');
    transactionAmountInput = transactionAmountInput.replace(/,/g, '');

    const filterBalanceValue = transactionBalanceInput === "" || !isNaN(transactionBalanceInput) ? parseFloat(transactionBalanceInput) : NaN;
    const filterAmountValue = transactionAmountInput === "" || !isNaN(transactionAmountInput) ? parseFloat(transactionAmountInput) : NaN;

    // Get date inputs and parse them
    const fromDateInput = document.getElementById('filterFromDate').value;
    const toDateInput = document.getElementById('filterToDate').value;

    const table = document.getElementById('reportTableBody');
    const rows = table.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagName('td');
        
        const transactionDateCellString = cells[9].innerText; // Assuming transaction date is in the 10th column (index 9)
        const transactionDateCell = parseDateFromString(transactionDateCellString); // Convert d/m/y string to a Date object

        // Parse the user input dates, setting "From Date" to the start of the day (00:00:00)
        const fromDate = fromDateInput ? new Date(fromDateInput) : null;
        if (fromDate) {
            fromDate.setHours(0, 0, 0, 0); // Ensure from date starts at 00:00:00
        }

        // Parse "To Date" and set it to the end of the day (23:59:59)
        const toDate = toDateInput ? new Date(toDateInput) : null;
        if (toDate) {
            toDate.setHours(23, 59, 59, 999); // Ensure to date ends at 23:59:59
        }
        
        if (fromDate && toDate && fromDate > toDate) {
            document.getElementById('dateErrorMsg').style.display = 'block'; // Show error message
            return;
        } else {
            document.getElementById('dateErrorMsg').style.display = 'none'; // Hide error message
        }
        // Check if the transaction date is within the date range
        const isDateInRange = (!fromDate || transactionDateCell >= fromDate) && (!toDate || transactionDateCell <= toDate);

        const matches = [
            cells[0].innerText.toLowerCase().includes(transactionID),
            cells[1].innerText.toLowerCase().includes(billNumber),
            cells[2].innerText.toLowerCase().includes(cardNumber),
            cells[3].innerText.toLowerCase().includes(cardIMEI),
            cells[4].innerText.toLowerCase().includes(cardOwner),
            cells[5].innerText.toLowerCase().includes(outlet),
            isNaN(filterBalanceValue) || parseFloat(cells[6].innerText.replace(/,/g, '')) === filterBalanceValue,
            isNaN(filterAmountValue) || parseFloat(cells[7].innerText.replace(/,/g, '')) === filterAmountValue,
            cells[9].innerText.toLowerCase().includes(transactionDate),
            isDateInRange,// Ensure transaction is within date range
        ];

        // Show the row if all conditions match, otherwise hide it
        rows[i].style.display = matches.every(Boolean) ? '' : 'none';
    }
}

// Helper function to parse d/m/y format into a Date object
function parseDateFromString(dateString) {
    const [day, month, year] = dateString.split('/').map(part => parseInt(part, 10));
    return new Date(year, month - 1, day); // Month is 0-based
}

// Debounce the filterTable function to limit how often it runs during typing
const debouncedFilterTable = debounce(filterTable, 300);

// Fetch report data on page load
document.addEventListener('DOMContentLoaded', fetchReportData);

//Create Account script
document.getElementById('AccountForm').addEventListener('submit', async function (e) {
    e.preventDefault();  // Prevent the form from reloading the page

    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const role = document.getElementById('registerRole').value;
    const outlet = document.getElementById('registerOutlet').value;

    const accountData = {
        username,
        password,
        role,
        outlet: outlet === 'none' ? null : outlet
    };
    try {
        const response = await fetch('/api/create-account', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(accountData)
        });

        if (response.ok) {
            alert('Account created successfully!');
        } else {
            alert('Error creating account. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error creating account. Please try again.');
    }
});


// Export Report to Excel
function exportTableToExcel(tableID, filename = '') {
    const table = document.getElementById(tableID);
    const worksheet = XLSX.utils.table_to_sheet(table);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    
    // Generate Excel file
    const excelFile = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });

    // Convert the binary string into a Blob
    const blob = new Blob([s2ab(excelFile)], { type: 'application/octet-stream' });

    // Create a link element to trigger the download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename ? `${filename}.xlsx` : 'report.xlsx';
    
    // Append the link to the body and click it to download the file
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
    return buf;
}


