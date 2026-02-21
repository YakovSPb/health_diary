import Image from 'next/image';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<Size, string> = {
  sm: 'w-12 h-12 sm:w-14 sm:h-14',
  md: 'w-20 h-20 sm:w-24 sm:h-24',
  lg: 'w-28 h-28 sm:w-36 sm:h-36',
  xl: 'h-10 w-10 sm:h-12 sm:w-12',
};

interface CapybaraMascotProps {
  size?: Size;
  className?: string;
  title?: string;
  src?: string;
}

export default function CapybaraMascot({
  size = 'md',
  className = '',
  title = 'Талисман DiaBalance',
  src = '/copy_king.png',
}: CapybaraMascotProps) {
  const dim = size === 'xl' ? 48 : size === 'lg' ? 144 : size === 'md' ? 96 : 56;
  const bgNav = 'bg-white dark:bg-gray-800';
  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 rounded overflow-hidden leading-none ${sizeClasses[size]} ${className}`}
      title={title}
      role="img"
      aria-label={title}
    >
      <span
        className={`absolute inset-0 rounded ${bgNav}`}
        aria-hidden
      />
      <Image
        src={src}
        alt={title}
        width={dim}
        height={dim}
        className="relative z-10 w-full h-full object-contain object-center select-none -scale-x-100"
        unoptimized
      />
    </span>
  );
}
