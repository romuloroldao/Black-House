// DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Inicializar Runtime Shield ANTES do React render
// Isso garante que erros de runtime sejam capturados desde o início
import { initializeRuntimeShield } from './lib/runtime-shield';

// DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Inicializar blindagem global de erros
// Ordem: Runtime Shield → React Render
initializeRuntimeShield();

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// DESIGN-CHECKPOINT-FAILSAFE-CLIENT-DELIVERY-001: Montar React e sinalizar sucesso
const rootElement = document.getElementById("root");
if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(<App />);
    
    // DESIGN-CHECKPOINT-FAILSAFE-CLIENT-DELIVERY-001: Sinalizar que React montou com sucesso
    // Isso garante que o Fail-Safe UI seja escondido
    window.__REACT_MOUNTED__ = true;
    
    // DESIGN-CHECKPOINT-FAILSAFE-CLIENT-DELIVERY-001: Esconder Fail-Safe UI após React montar
    // Pequeno delay para garantir que o DOM foi atualizado
    setTimeout(() => {
      const failsafeUI = document.getElementById('failsafe-ui');
      if (failsafeUI) {
        failsafeUI.classList.add('hidden');
      }
    }, 100);
  } catch (error) {
    // DESIGN-CHECKPOINT-FAILSAFE-CLIENT-DELIVERY-001: Se React falhar, Fail-Safe UI permanece visível
    console.error('[DESIGN-CHECKPOINT-FAILSAFE-CLIENT-DELIVERY-001] Erro ao montar React. Fail-Safe UI permanecerá visível:', error);
    // Não lançar erro - Fail-Safe UI já está visível para o cliente
  }
} else {
  console.error('[DESIGN-CHECKPOINT-FAILSAFE-CLIENT-DELIVERY-001] Elemento root não encontrado. Fail-Safe UI permanecerá visível.');
}
