import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import fallbackForklift from "@/assets/hero-forklift-hall.jpg";
import { cn } from "@/lib/utils";

export function EquipmentPhoto({ photoPath, unitNumber, className }: {
  photoPath?: string | null;
  unitNumber: string;
  className?: string;
}) {
  const { data: photoUrl } = useQuery({
    queryKey: ["equipment-photo", photoPath],
    enabled: !!photoPath,
    staleTime: 45 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("equipment-photos").createSignedUrl(photoPath!, 3600);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
  });

  return <img
    src={photoUrl ?? fallbackForklift}
    alt={photoPath ? `${unitNumber} forklift` : `Representative forklift for ${unitNumber}`}
    className={cn("bg-muted object-cover", className)}
  />;
}
