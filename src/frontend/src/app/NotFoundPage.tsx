import { Link } from 'react-router';

/** `*` route (SPEC 6.1). */
export function NotFoundPage() {
  return (
    <>
      <h1>Page not found</h1>
      <p>The page you&apos;re looking for doesn&apos;t exist.</p>
      <p>
        <Link to="/today">Go to Today</Link>
      </p>
    </>
  );
}
