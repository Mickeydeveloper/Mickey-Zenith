import React, { useState } from 'react';

const BotWeb = () => {
  const [meterNumber, setMeterNumber] = useState('');
  const [reading, setReading] = useState('');
  const [bill, setBill] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const calculatedBill = parseFloat(reading) * 1.25;
    setBill(`Estimated bill for meter ${meterNumber}: TZS ${calculatedBill.toFixed(2)}`);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>💧 Water Billing Bot</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>Meter Number:</label>
        <input type="text" value={meterNumber} onChange={(e) => setMeterNumber(e.target.value)} style={styles.input} required />

        <label style={styles.label}>Current Reading:</label>
        <input type="number" value={reading} onChange={(e) => setReading(e.target.value)} style={styles.input} required />

        <button type="submit" style={styles.button}>Generate Bill</button>
      </form>

      {bill && <p style={styles.result}>{bill}</p>}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '500px',
    margin: 'auto',
    padding: '2rem',
    background: '#f9f9f9',
    borderRadius: '10px',
    boxShadow: '0 0 10px rgba(0,0,0,0.1)',
    fontFamily: 'Arial, sans-serif',
  },
  title: {
    textAlign: 'center',
    marginBottom: '1.5rem',
    color: '#007bff',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    marginBottom: '0.5rem',
    fontWeight: 'bold',
  },
  input: {
    padding: '0.5rem',
    marginBottom: '1rem',
    borderRadius: '5px',
    border: '1px solid #ccc',
  },
  button: {
    padding: '0.7rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  result: {
    marginTop: '1.5rem',
    fontWeight: 'bold',
    color: '#28a745',
    textAlign: 'center',
  },
};

export default BotWeb;
