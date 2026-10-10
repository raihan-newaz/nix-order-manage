import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import App from './App';
import '@flaticon/flaticon-uicons/css/regular/rounded.css';
import './styles.css';
import './footerResponsive.css';
import './searchFocus.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><CustomerAuthProvider><CartProvider><App /></CartProvider></CustomerAuthProvider></BrowserRouter></React.StrictMode>,
);
