import Link from "next/link";

export default function NotFound() {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold mb-4 text-blue-900">Page Not Found</h2>
        <p className="text-lg text-gray-700 mb-8">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/"
          className="inline-block bg-blue-900 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
        >
          Return to Homepage
        </Link>
      </div>
    </section>
  );
}
