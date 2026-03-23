import { ApiStatus } from './components/ApiStatus';

function App() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-black text-white mb-2 italic uppercase">Hackathon Pre- setup </h1>
      <p className="text-slate-400 mb-8 text-center">  MERN environment is configured and ready for building.</p>
      
      <ApiStatus />
    </div>
  );
}

export default App;