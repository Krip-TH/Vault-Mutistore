import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { CartProvider } from './cart/CartContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></React.StrictMode>,
);
