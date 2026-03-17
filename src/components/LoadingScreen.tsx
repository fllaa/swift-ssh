import { Loader2, Server, Shield } from "lucide-react";
import { getDistroIcon } from "../utils/distroIcon";
import { HostProfile } from "../store/useStore";

interface LoadingScreenProps {
  readonly host?: HostProfile;
  readonly message?: string;
}

export default function LoadingScreen({ host, message = "Establishing secure connection..." }: LoadingScreenProps) {
  const osIcon = host ? getDistroIcon(host.osIcon) : null;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-[#0f1117] text-slate-300 animate-in fade-in duration-500">
      <div className="relative mb-12">
        {/* Pulsing Aura Background */}
        <div className="absolute inset-0 bg-blue-600/20 blur-[60px] rounded-full scale-150 animate-pulse duration-[3000ms]" />
        
        {/* Main Icon Container */}
        <div className="relative flex items-center justify-center size-24 bg-slate-900 border border-slate-800 rounded-3xl shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] overflow-visible">
          {/* Static Sharper Border */}
          <div className="absolute -inset-px border border-blue-500/30 rounded-3xl z-10" />
          
          {/* Rotating Light Beam (Orbiting Glow) */}
          <div className="absolute -inset-4 animate-[spin_3s_linear_infinite] z-20 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-blue-400 blur-2xl rounded-full opacity-60" />
          </div>

          {/* Secondary rotating light (slower, opposite) */}
          <div className="absolute -inset-2 animate-[spin_8s_linear_infinite_reverse] z-0 pointer-events-none opacity-30">
            <div className="absolute bottom-0 right-1/2 translate-x-1/2 w-10 h-10 bg-indigo-500 blur-2xl rounded-full" />
          </div>
          
          {/* Content */}
          <div className="relative z-30 flex items-center justify-center w-full h-full">
            {osIcon ? (
              <img src={osIcon} className="size-12 opacity-95 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" alt="OS Icon" />
            ) : (
              <Server className="size-12 text-blue-400" />
            )}
          </div>
        </div>
        
        {/* Secondary Icon (Shield/Security) */}
        <div className="absolute -bottom-2 -right-2 p-1.5 bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
          <Shield className="size-4 text-emerald-400" />
        </div>
      </div>

      <div className="text-center space-y-3">
        <h3 className="text-xl font-bold text-white tracking-tight">
          {host?.label || host?.hostname || "Connecting"}
        </h3>
        <div className="flex items-center justify-center space-x-2 text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          <p className="text-sm font-medium animate-pulse">{message}</p>
        </div>
      </div>

      {/* Connection Steps/Indicator */}
      <div className="absolute bottom-12 flex space-x-1">
        {[0, 1, 2].map((i) => (
          <div 
            key={i} 
            className="size-1.5 rounded-full bg-blue-500/20 animate-bounce" 
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
