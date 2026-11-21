import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {installImeInputGuard} from './utils/imeInputGuard';

installImeInputGuard();

createRoot(document.getElementById('root')!).render(<App />);
