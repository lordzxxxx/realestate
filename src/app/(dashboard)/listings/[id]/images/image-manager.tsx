'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Star, Trash2, Upload, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  registerListingImageAction,
  reorderListingImagesAction,
  setCoverImageAction,
  updateListingImageAction,
  deleteListingImageAction,
} from './actions';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;

export interface ImageRecord {
  id: string;
  storage_path: string;
  sort_order: number;
  is_cover: boolean;
  alt_text: string | null;
  caption: string | null;
  url: string;
}

function sanitizeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
}

export function ImageManager({ listingId, initialImages }: { listingId: string; initialImages: ImageRecord[] }) {
  const [images, setImages] = useState(initialImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const list = Array.from(files);
      const invalid = list.find((f) => !ACCEPTED_TYPES.includes(f.type) || f.size > MAX_SIZE);
      if (invalid) {
        setError(`${invalid.name}: only JPEG/PNG/WebP images up to 10MB are allowed.`);
        return;
      }

      setUploading(true);
      const supabase = createClient();

      for (const file of list) {
        const path = `${listingId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
        const { error: uploadError } = await supabase.storage.from('listing-images').upload(path, file);
        if (uploadError) {
          setError(uploadError.message);
          continue;
        }

        const result = await registerListingImageAction(listingId, path);
        if (result.error || !result.id) {
          setError(result.error ?? 'Failed to save image');
          continue;
        }

        const { data: urlData } = supabase.storage.from('listing-images').getPublicUrl(path);
        setImages((prev) => [
          ...prev,
          {
            id: result.id!,
            storage_path: path,
            sort_order: prev.length,
            is_cover: prev.length === 0,
            alt_text: null,
            caption: null,
            url: urlData.publicUrl,
          },
        ]);
      }

      setUploading(false);
    },
    [listingId]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setImages((prev) => {
      const oldIndex = prev.findIndex((img) => img.id === active.id);
      const newIndex = prev.findIndex((img) => img.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      void reorderListingImagesAction(
        listingId,
        reordered.map((img) => img.id)
      );
      return reordered;
    });
  };

  const setCover = async (imageId: string) => {
    setImages((prev) => prev.map((img) => ({ ...img, is_cover: img.id === imageId })));
    await setCoverImageAction(listingId, imageId);
  };

  const remove = async (image: ImageRecord) => {
    setImages((prev) => prev.filter((img) => img.id !== image.id));
    await deleteListingImageAction(listingId, image.id, image.storage_path);
  };

  const updateCaption = async (imageId: string, caption: string) => {
    setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, caption } : img)));
    await updateListingImageAction(listingId, imageId, { caption });
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files.length > 0) void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isDragOver ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
        )}
      >
        {uploading ? (
          <Loader2 className="mb-2 h-6 w-6 animate-spin text-slate-400" />
        ) : (
          <Upload className="mb-2 h-6 w-6 text-slate-400" strokeWidth={1.5} />
        )}
        <p className="text-sm text-slate-600">Drag and drop photos here, or click to browse</p>
        <p className="text-xs text-slate-400">JPEG, PNG, or WebP — up to 10MB each</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) void uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {images.length > 0 && (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {images.map((image) => (
                <SortableImage
                  key={image.id}
                  image={image}
                  onSetCover={() => setCover(image.id)}
                  onRemove={() => remove(image)}
                  onCaptionChange={(caption) => updateCaption(image.id, caption)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableImage({
  image,
  onSetCover,
  onRemove,
  onCaptionChange,
}: {
  image: ImageRecord;
  onSetCover: () => void;
  onRemove: () => void;
  onCaptionChange: (caption: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative overflow-hidden rounded-lg border border-slate-200 bg-white',
        isDragging && 'opacity-50'
      )}
    >
      <div {...attributes} {...listeners} className="relative aspect-[4/3] cursor-grab bg-slate-100">
        <Image src={image.url} alt={image.alt_text ?? ''} fill className="object-cover" unoptimized />
        {image.is_cover && (
          <span className="absolute left-1.5 top-1.5 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Cover
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 border-t border-slate-100 p-1.5">
        <input
          type="text"
          placeholder="Caption"
          defaultValue={image.caption ?? ''}
          onBlur={(e) => onCaptionChange(e.target.value)}
          className="min-w-0 flex-1 rounded border-0 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300"
        />
        <button
          type="button"
          title="Set as cover"
          onClick={onSetCover}
          className={cn('p-1 text-slate-400 hover:text-amber-500', image.is_cover && 'text-amber-500')}
        >
          <Star className="h-3.5 w-3.5" fill={image.is_cover ? 'currentColor' : 'none'} />
        </button>
        <button type="button" title="Delete" onClick={onRemove} className="p-1 text-slate-400 hover:text-red-600">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
