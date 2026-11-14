import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import './styles.css';
import { App } from './App';

const queryClient = new QueryClient();
const storedColorScheme = window.localStorage.getItem('charges-tba-color-scheme');
const initialColorScheme =
    storedColorScheme === 'light' || storedColorScheme === 'dark'
        ? storedColorScheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
document.documentElement.classList.toggle('dark', initialColorScheme === 'dark');

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>,
);
