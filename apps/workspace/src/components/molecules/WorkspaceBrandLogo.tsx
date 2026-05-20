'use client';

import Image from 'next/image';
import { workspace_logo_is_remote } from '@/src/utils/workspace_logo';

type WorkspaceBrandLogoProps = {
  src: string;
  alt: string;
  className?: string;
  /** Used with `next/image` for local/static sources */
  width?: number;
  height?: number;
};

export function WorkspaceBrandLogo({
  src,
  alt,
  className,
  width = 150,
  height = 40,
}: WorkspaceBrandLogoProps) {
  if (workspace_logo_is_remote(src)) {
    return <img src={src} alt={alt} className={className} />;
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );
}
