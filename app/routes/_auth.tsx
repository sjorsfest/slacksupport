import { Outlet } from 'react-router';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4A154B] via-[#3D1141] to-[#2C0E30] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Support Widget</h1>
          <p className="text-white/60 mt-1">Customer support, powered by Slack</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

