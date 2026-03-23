import { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Database, CheckCircle } from 'lucide-react';

export const ApiStatus = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch data from our Express server
    axios.get('http://localhost:5000/api/status')
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Connection failed", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6 max-w-md mx-auto bg-slate-800 rounded-2xl border border-slate-700 shadow-xl text-white mt-10">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="text-blue-400" />
        <h2 className="text-xl font-bold">System Status</h2>
      </div>

      {loading ? (
        <p className="text-gray-400 animate-pulse">Checking connection...</p>
      ) : data ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-slate-900 p-3 rounded-lg">
            <span className="text-gray-400">Backend:</span>
            <span className="text-green-400 font-mono font-bold">{data.status}</span>
          </div>
          <div className="flex justify-between items-center bg-slate-900 p-3 rounded-lg">
            <span className="text-gray-400">Database:</span>
            <span className="flex items-center gap-2 text-green-400 font-mono font-bold">
              <Database size={14}/> {data.db_status}
            </span>
          </div>
          <p className="text-xs text-blue-300 italic">"{data.message}"</p>
        </div>
      ) : (
        <div className="text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-400/20">
          !!**!! Server Unreachable. Is the backend running?
        </div>
      )}
    </div>
  );
};