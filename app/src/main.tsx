import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { VoiceDebug } from './audio/VoiceDebug.tsx';
import './styles.css';

const voices = new URLSearchParams(location.search).has('voices');
createRoot(document.getElementById('root')!).render(voices ? <VoiceDebug /> : <App />);
