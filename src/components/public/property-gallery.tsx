'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export function PropertyGallery({
  images,
  propertyName,
}: {
  images: { id: string; url: string; alt_text: string | null; caption: string | null }[];
  propertyName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-400">
        No photos yet
      </div>
    );
  }

  const active = images[activeIndex];

  return (
    <div>
      <div className="relative mb-2 aspect-[16/10] overflow-hidden rounded-lg bg-slate-100">
        <Image
          src={active.url}
          alt={active.alt_text ?? propertyName}
          fill
          unoptimized
          priority
          className="object-cover"
        />
        {active.caption && (
          <span className="absolute bottom-2 left-2 rounded bg-slate-900/75 px-2 py-1 text-xs text-white">
            {active.caption}
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={cn(
                'relative h-16 w-20 shrink-0 overflow-hidden rounded border-2',
                i === activeIndex ? 'border-slate-900' : 'border-transparent'
              )}
            >
              <Image src={img.url} alt={img.alt_text ?? ''} fill unoptimized className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
