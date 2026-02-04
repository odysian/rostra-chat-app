import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-amber-900/10 via-zinc-950 to-zinc-950" />

      <div className="relative flex-1 flex flex-col md:flex-row md:min-h-0">
        <div className="flex-1 flex flex-col justify-center px-6 py-16 md:py-24 md:pl-16 lg:pl-24 md:pr-12 max-w-2xl">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-cinzel font-bold text-amber-500 tracking-wide mb-3">
            ROSTRA
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl mb-4">
            Lead the Discussion
          </p>
          <p className="text-zinc-300 text-base max-w-lg mb-10">
            A real-time chat app. Send messages instantly and see who’s in the
            conversation.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/login")}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-zinc-900 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate("/register")}
              className="px-6 py-3 border border-zinc-600 hover:border-amber-500/50 text-amber-500 hover:bg-amber-500/10 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              Get Started
            </button>
          </div>
        </div>

      </div>

      <footer className="relative border-t border-zinc-800 py-4 px-6 text-center">
        <p className="text-zinc-600 text-xs">
          Real-time chat application
        </p>
      </footer>
    </div>
  );
}
