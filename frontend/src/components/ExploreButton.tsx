"use client";

export default function ExploreButton() {
  return (
    <button
      onClick={() =>
        document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })
      }
      className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 px-10 py-4 rounded-2xl font-bold transition-all"
    >
      Explore More
    </button>
  );
}
