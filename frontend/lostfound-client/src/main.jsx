import { createRoot } from 'react-dom/client';
import AppRouter from './App';
import './index.css';
import './styles/ui.css';

import { AuthProvider } from './AuthContext';

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <AppRouter />
  </AuthProvider>
);
// createRoot(document.getElementById('root')).render(<AppRouter />);