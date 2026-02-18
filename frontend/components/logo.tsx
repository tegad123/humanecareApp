export function CredentisLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shieldGrad" x1="20" y1="2" x2="20" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4F7CFF" />
          <stop offset="100%" stopColor="#3B5BDB" />
        </linearGradient>
      </defs>
      <path d="M20 3L6 9.5V18.5C6 27.6 12 35.4 20 37.5C28 35.4 34 27.6 34 18.5V9.5L20 3Z" fill="url(#shieldGrad)" />
      <path d="M14 20.5L18 24.5L26.5 16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
