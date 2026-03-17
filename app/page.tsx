"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Chat from "./components/Chat";

const NeuralSphere = dynamic(() => import("./components/NeuralSphere"), {
  ssr: false,
});

export default function Home() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);

  const handleStreamStart = useCallback(() => {
    setIsStreaming(true);
    setTokenCount(0);
  }, []);

  const handleStreamEnd = useCallback(() => {
    setIsStreaming(false);
  }, []);

  const handleToken = useCallback(() => {
    setTokenCount((prev) => prev + 1);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left: Chat */}
      <div className="w-1/2 h-full border-r border-white/10">
        <Chat
          onStreamStart={handleStreamStart}
          onStreamEnd={handleStreamEnd}
          onToken={handleToken}
        />
      </div>

      {/* Right: Neural Sphere */}
      <div className="w-1/2 h-full relative bg-[#0a0a0a]">
        <NeuralSphere isStreaming={isStreaming} tokenCount={tokenCount} />
      </div>
    </div>
  );
}
