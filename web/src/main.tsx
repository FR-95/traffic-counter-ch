import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './design/intersys.css';
import './design/additions.css';
import './index.css';
import { App } from './App.tsx';
import { InfoPage } from './InfoPage.tsx';
import { INFO_PATH } from './routes.ts';

const isInfo = window.location.pathname.replace(/\/$/, '') === INFO_PATH;

createRoot(document.getElementById('root')!).render(<StrictMode>{isInfo ? <InfoPage /> : <App />}</StrictMode>);
