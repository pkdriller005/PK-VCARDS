const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8000;
const db = new sqlite3.Database('./contacts.db');

// Initialize database with unique constraint
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    country_code TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(country_code, phone) ON CONFLICT IGNORE
  )`);
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.post('/upload', (req, res) => {
  const { name, phone, country_code } = req.body;
  
  // Validate phone number (6-10 digits)
  if (!/^\d{6,10}$/.test(phone)) {
    return res.status(400).json({ error: 'Phone number must be 6-10 digits (without country code or leading zero)' });
  }

  db.run(
    'INSERT INTO contacts (name, phone, country_code) VALUES (?, ?, ?)',
    [name, phone, country_code],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(409).json({ error: 'Contact already exists' });
      }
      
      res.json({ success: true });
    }
  );
});

app.post('/check-contact', (req, res) => {
  const { phone, country_code } = req.body;
  
  db.get(
    'SELECT 1 FROM contacts WHERE phone = ? AND country_code = ?',
    [phone, country_code],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ exists: !!row });
    }
  );
});

app.get('/contacts', (req, res) => {
  db.all('SELECT * FROM contacts ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error fetching contacts' });
    res.json(rows);
  });
});

app.get('/download', (req, res) => {
  db.all('SELECT * FROM contacts', [], (err, contacts) => {
    if (err) return res.status(500).json({ error: 'Error generating VCF' });
    
    const vcfData = contacts.map(contact => 
      `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name}\nTEL:${contact.country_code}${contact.phone}\nEND:VCARD`
    ).join('\n');
    
    res.set({
      'Content-Type': 'text/vcard',
      'Content-Disposition': 'attachment; filename="pk_tech_Contacts.vcf"'
    });
    res.send(vcfData);
  });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Create public directory if it doesn't exist
  if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'));
  }
});
