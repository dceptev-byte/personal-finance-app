import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Card><CardContent className="pt-6 space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </CardContent></Card>
      <Card><CardContent className="pt-6 space-y-3">
        {[0, 1].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </CardContent></Card>
    </div>
  );
}
