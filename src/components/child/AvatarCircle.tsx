import { cn } from "@/lib/utils";

/**
 * The avatar-in-a-ring image (S-13 primitive — absorbed the four near-identical
 * inline `<img>`s on start/picker/wizard/report). Ring color is the primary
 * brand ring per the mockups' circular avatar crops.
 */
interface AvatarCircleProps {
  src: string;
  alt: string;
  size?: 12 | 14 | 16;
  className?: string;
}

const SIZE_CLASS = { 12: "size-12", 14: "size-14", 16: "size-16" } as const;

export function AvatarCircle({ src, alt, size = 14, className }: AvatarCircleProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn("border-primary rounded-full border-2 object-cover", SIZE_CLASS[size], className)}
    />
  );
}
