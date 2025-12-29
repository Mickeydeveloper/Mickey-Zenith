const express = require('express')
const app = express()

app.get('/', (req, res) => res.send('OK'))

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`✅ Server listening on port ${port}`))

// Start the bot after the HTTP server is listening so Heroku sees a bound port
try {
  require('./index')
} catch (err) {
  console.error('Failed to start bot from server.js:', err)
}
